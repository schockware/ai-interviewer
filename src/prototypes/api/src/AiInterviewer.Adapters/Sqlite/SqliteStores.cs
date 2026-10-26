// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Globalization;
using AiInterviewer.Business;

namespace AiInterviewer.Adapters.Sqlite;

// Tier 3 data adapters on SQLite. The business module sees the same ports as the in-memory ones.

public abstract class SqliteDocumentStore<TId>(SqliteDatabase database, string table, Func<string, Outcome<TId>> makeId) : IDocumentStore<TId>
    where TId : notnull
{
    // The table name is a constant chosen by the two subclasses, never user input, so it can sit in the SQL text.

    public Task<IReadOnlyList<StoredDocument<TId>>> ListAsync(CancellationToken ct) => database.RunAsync<IReadOnlyList<StoredDocument<TId>>>(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        // Most recently processed first; a tie goes to the later insert.
        command.CommandText = $"SELECT id, display_name, processed_at, text FROM {table} ORDER BY processed_at DESC, rowid DESC";
        var documents = new List<StoredDocument<TId>>();
        await using var reader = await command.ExecuteReaderAsync(token);
        while (await reader.ReadAsync(token))
            documents.Add(new StoredDocument<TId>(Id(reader.GetString(0)), Name(reader.GetString(1)), Stamp(reader.GetString(2)), reader.GetString(3)));
        return documents;
    }, ct);

    public Task<bool> ContainsAsync(TId id, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT 1 FROM {table} WHERE id = $id";
        command.Parameters.AddWithValue("$id", id.ToString());
        return await command.ExecuteScalarAsync(token) is not null;
    }, ct);

    public Task<TId> AddAsync(DisplayName name, string text, DateTimeOffset processedAt, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        var id = Id(Guid.NewGuid().ToString("N"));
        await using var command = connection.CreateCommand();
        command.CommandText = $"INSERT INTO {table} (id, display_name, processed_at, text) VALUES ($id, $name, $at, $text)";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$name", name.Value);
        command.Parameters.AddWithValue("$at", processedAt.ToString("O", CultureInfo.InvariantCulture));
        command.Parameters.AddWithValue("$text", text);
        await command.ExecuteNonQueryAsync(token);
        return id;
    }, ct);

    private TId Id(string raw) => makeId(raw) is Succeeded<TId> ok ? ok.Value : throw new InvalidDataException($"{table}: blank id.");

    private DisplayName Name(string raw) =>
        DisplayName.From(raw) is Succeeded<DisplayName> ok ? ok.Value : throw new InvalidDataException($"{table}: blank display name.");

    private static DateTimeOffset Stamp(string raw) =>
        DateTimeOffset.TryParseExact(raw, "O", CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var at)
            ? at
            : throw new InvalidDataException($"\"{raw}\" is not a timestamp.");
}

public sealed class SqliteResumeStore(SqliteDatabase database) : SqliteDocumentStore<ResumeId>(database, "resumes", ResumeId.From), IResumeStore;

public sealed class SqliteRoleStore(SqliteDatabase database) : SqliteDocumentStore<RoleId>(database, "roles", RoleId.From), IRoleStore;

public sealed class SqliteSessionStore(SqliteDatabase database) : ISessionStore
{
    public Task SaveAsync(InterviewSession session, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        // Preparing the same session again replaces it (the api README lists this as a proposal).
        command.CommandText = """
            INSERT INTO sessions (id, form, status, log_id) VALUES ($id, $form, $status, $log)
            ON CONFLICT(id) DO UPDATE SET form = excluded.form, status = excluded.status, log_id = excluded.log_id
            """;
        command.Parameters.AddWithValue("$id", session.Id.Value);
        command.Parameters.AddWithValue("$form", SetupFormJson.Write(session.Form));
        command.Parameters.AddWithValue("$status", session.Status.ToString());
        command.Parameters.AddWithValue("$log", session.LogId.Value);
        await command.ExecuteNonQueryAsync(token);
        return true;
    }, ct);

    public Task<Outcome<InterviewSession>> FindAsync(SessionId id, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT form, status, log_id FROM sessions WHERE id = $id";
        command.Parameters.AddWithValue("$id", id.Value);
        await using var reader = await command.ExecuteReaderAsync(token);
        if (!await reader.ReadAsync(token)) return Outcome.Failure<InterviewSession>($"Session \"{id}\" was not found.");

        var form = SetupFormJson.Read(reader.GetString(0)) switch
        {
            Succeeded<ApplicationSetupFormHolder> ok => ok.Value.Form,
            Failed<ApplicationSetupFormHolder> bad => throw new InvalidDataException($"session {id}: {bad.Message}"),
            _ => throw new InvalidOperationException(),
        };
        if (!Enum.TryParse<PreparationStatus>(reader.GetString(1), out var status))
            throw new InvalidDataException($"session {id}: unknown status \"{reader.GetString(1)}\".");
        if (LogId.From(reader.GetString(2)) is not Succeeded<LogId> log)
            throw new InvalidDataException($"session {id}: blank log id.");

        return Outcome.Success(new InterviewSession(id, form, status, log.Value));
    }, ct);
}
