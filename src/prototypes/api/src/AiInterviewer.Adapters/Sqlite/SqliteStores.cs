// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Globalization;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;
using Microsoft.Data.Sqlite;

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
        command.CommandText = $"SELECT id, display_name, processed_at, text, source FROM {table} ORDER BY processed_at DESC, rowid DESC";
        var documents = new List<StoredDocument<TId>>();
        await using var reader = await command.ExecuteReaderAsync(token);
        while (await reader.ReadAsync(token)) documents.Add(Read(reader));
        return documents;
    }, ct);

    public Task<bool> ContainsAsync(TId id, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT 1 FROM {table} WHERE id = $id";
        command.Parameters.AddWithValue("$id", id.ToString());
        return await command.ExecuteScalarAsync(token) is not null;
    }, ct);

    public Task<Outcome<StoredDocument<TId>>> FindAsync(TId id, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT id, display_name, processed_at, text, source FROM {table} WHERE id = $id";
        command.Parameters.AddWithValue("$id", id.ToString());
        await using var reader = await command.ExecuteReaderAsync(token);
        return await reader.ReadAsync(token) ? Outcome.Success(Read(reader)) : Outcome.Failure<StoredDocument<TId>>($"\"{id}\" was not found.");
    }, ct);

    public Task<bool> ContainsSourceAsync(DocumentSource source, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT 1 FROM {table} WHERE source = $source LIMIT 1";
        command.Parameters.AddWithValue("$source", source.Key);
        return await command.ExecuteScalarAsync(token) is not null;
    }, ct);

    public Task<TId> AddAsync(DisplayName name, string text, DateTimeOffset processedAt, DocumentSource source, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        var id = Id(Guid.NewGuid().ToString("N"));
        await using var command = connection.CreateCommand();
        command.CommandText = $"INSERT INTO {table} (id, display_name, processed_at, text, source) VALUES ($id, $name, $at, $text, $source)";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.Parameters.AddWithValue("$name", name.Value);
        command.Parameters.AddWithValue("$at", SqliteValues.Stamp(processedAt));
        command.Parameters.AddWithValue("$text", text);
        command.Parameters.AddWithValue("$source", source.Key);
        await command.ExecuteNonQueryAsync(token);
        return id;
    }, ct);

    private StoredDocument<TId> Read(SqliteDataReader reader) =>
        new(Id(reader.GetString(0)), SqliteValues.Name(reader.GetString(1), table), SqliteValues.Stamp(reader.GetString(2)), reader.GetString(3), Source(reader.GetString(4)));

    private TId Id(string raw) => makeId(raw) is Succeeded<TId> ok ? ok.Value : throw new InvalidDataException($"{table}: blank id.");

    private DocumentSource Source(string raw) =>
        DocumentSource.From(raw) is Succeeded<DocumentSource> ok ? ok.Value : throw new InvalidDataException($"{table}: blank source.");
}

public sealed class SqliteResumeStore(SqliteDatabase database) : SqliteDocumentStore<ResumeId>(database, "resumes", ResumeId.From), IResumeStore;

public sealed class SqliteRoleStore(SqliteDatabase database) : SqliteDocumentStore<RoleId>(database, "roles", RoleId.From), IRoleStore;

/// <summary>
/// Question sets in <c>question_sets</c> (one row per set, <c>active</c> marks the role's current
/// one) and their questions in <c>questions</c>. Activating a set deletes the role's previous
/// active set and its questions, which is the purge the spec describes.
/// </summary>
public sealed class SqliteQuestionStore(SqliteDatabase database) : IQuestionStore
{
    public Task<IReadOnlyList<InterviewQuestion>> ListAsync(RoleId role, CancellationToken ct) => database.RunAsync<IReadOnlyList<InterviewQuestion>>(async (connection, token) =>
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT q.id, q.ord, q.text FROM questions q
            JOIN question_sets s ON s.id = q.set_id
            WHERE s.role_id = $role AND s.active = 1
            ORDER BY q.ord
            """;
        command.Parameters.AddWithValue("$role", role.Value);
        return await ReadQuestions(command, token);
    }, ct);

    public Task<QuestionSetId> AddSetAsync(RoleId role, QuestionSource source, IReadOnlyList<string> texts, DateTimeOffset createdAt, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        var id = SetId(Guid.NewGuid().ToString("N"));
        await using var transaction = await connection.BeginTransactionAsync(token);
        await using (var insertSet = connection.CreateCommand())
        {
            insertSet.Transaction = (SqliteTransaction)transaction;
            insertSet.CommandText = "INSERT INTO question_sets (id, role_id, source, created_at, active) VALUES ($id, $role, $source, $at, 0)";
            insertSet.Parameters.AddWithValue("$id", id.Value);
            insertSet.Parameters.AddWithValue("$role", role.Value);
            insertSet.Parameters.AddWithValue("$source", source.ToString());
            insertSet.Parameters.AddWithValue("$at", SqliteValues.Stamp(createdAt));
            await insertSet.ExecuteNonQueryAsync(token);
        }
        for (var i = 0; i < texts.Count; i++)
        {
            await using var insert = connection.CreateCommand();
            insert.Transaction = (SqliteTransaction)transaction;
            insert.CommandText = "INSERT INTO questions (id, set_id, ord, text) VALUES ($id, $set, $ord, $text)";
            insert.Parameters.AddWithValue("$id", Guid.NewGuid().ToString("N"));
            insert.Parameters.AddWithValue("$set", id.Value);
            insert.Parameters.AddWithValue("$ord", i + 1);
            insert.Parameters.AddWithValue("$text", texts[i]);
            await insert.ExecuteNonQueryAsync(token);
        }
        await transaction.CommitAsync(token);
        return id;
    }, ct);

    public Task<Outcome<QuestionSet>> FindSetAsync(QuestionSetId id, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var head = connection.CreateCommand();
        head.CommandText = "SELECT role_id, source, created_at FROM question_sets WHERE id = $id";
        head.Parameters.AddWithValue("$id", id.Value);
        RoleId role;
        QuestionSource source;
        DateTimeOffset createdAt;
        await using (var reader = await head.ExecuteReaderAsync(token))
        {
            if (!await reader.ReadAsync(token)) return Outcome.Failure<QuestionSet>($"Questions \"{id}\" were not found.");
            role = RoleId.From(reader.GetString(0)) is Succeeded<RoleId> ok ? ok.Value : throw new InvalidDataException("question_sets: blank role id.");
            source = Enum.TryParse<QuestionSource>(reader.GetString(1), out var parsed) ? parsed : throw new InvalidDataException($"question_sets: unknown source \"{reader.GetString(1)}\".");
            createdAt = SqliteValues.Stamp(reader.GetString(2));
        }
        await using var list = connection.CreateCommand();
        list.CommandText = "SELECT id, ord, text FROM questions WHERE set_id = $set ORDER BY ord";
        list.Parameters.AddWithValue("$set", id.Value);
        return Outcome.Success(new QuestionSet(id, role, source, createdAt, await ReadQuestions(list, token)));
    }, ct);

    public Task ActivateAsync(QuestionSetId id, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var transaction = await connection.BeginTransactionAsync(token);
        string roleId;
        await using (var find = connection.CreateCommand())
        {
            find.Transaction = (SqliteTransaction)transaction;
            find.CommandText = "SELECT role_id FROM question_sets WHERE id = $id";
            find.Parameters.AddWithValue("$id", id.Value);
            roleId = await find.ExecuteScalarAsync(token) as string ?? throw new InvalidOperationException($"Questions \"{id}\" were not found.");
        }
        await DeleteActive(connection, (SqliteTransaction)transaction, roleId, except: id.Value, token);
        await using (var activate = connection.CreateCommand())
        {
            activate.Transaction = (SqliteTransaction)transaction;
            activate.CommandText = "UPDATE question_sets SET active = 1 WHERE id = $id";
            activate.Parameters.AddWithValue("$id", id.Value);
            await activate.ExecuteNonQueryAsync(token);
        }
        await transaction.CommitAsync(token);
        return true;
    }, ct);

    public Task PurgeAsync(RoleId role, CancellationToken ct) => database.RunAsync(async (connection, token) =>
    {
        await using var transaction = await connection.BeginTransactionAsync(token);
        await DeleteActive(connection, (SqliteTransaction)transaction, role.Value, except: "", token);
        await transaction.CommitAsync(token);
        return true;
    }, ct);

    /// <summary>Deletes the role's active sets, and their questions, other than <paramref name="except"/>.</summary>
    private static async Task DeleteActive(SqliteConnection connection, SqliteTransaction transaction, string roleId, string except, CancellationToken token)
    {
        await using var questions = connection.CreateCommand();
        questions.Transaction = transaction;
        questions.CommandText = "DELETE FROM questions WHERE set_id IN (SELECT id FROM question_sets WHERE role_id = $role AND active = 1 AND id <> $except)";
        questions.Parameters.AddWithValue("$role", roleId);
        questions.Parameters.AddWithValue("$except", except);
        await questions.ExecuteNonQueryAsync(token);
        await using var sets = connection.CreateCommand();
        sets.Transaction = transaction;
        sets.CommandText = "DELETE FROM question_sets WHERE role_id = $role AND active = 1 AND id <> $except";
        sets.Parameters.AddWithValue("$role", roleId);
        sets.Parameters.AddWithValue("$except", except);
        await sets.ExecuteNonQueryAsync(token);
    }

    private static async Task<IReadOnlyList<InterviewQuestion>> ReadQuestions(SqliteCommand command, CancellationToken token)
    {
        var questions = new List<InterviewQuestion>();
        await using var reader = await command.ExecuteReaderAsync(token);
        while (await reader.ReadAsync(token))
        {
            var id = QuestionId.From(reader.GetString(0)) is Succeeded<QuestionId> ok ? ok.Value : throw new InvalidDataException("questions: blank id.");
            questions.Add(new InterviewQuestion(id, reader.GetInt32(1), reader.GetString(2)));
        }
        return questions;
    }

    private static QuestionSetId SetId(string raw) =>
        QuestionSetId.From(raw) is Succeeded<QuestionSetId> ok ? ok.Value : throw new InvalidDataException("question_sets: blank id.");
}

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

/// <summary>How values that are not plain strings are written and read back.</summary>
internal static class SqliteValues
{
    public static string Stamp(DateTimeOffset at) => at.ToString("O", CultureInfo.InvariantCulture);

    public static DateTimeOffset Stamp(string raw) =>
        DateTimeOffset.TryParseExact(raw, "O", CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var at)
            ? at
            : throw new InvalidDataException($"\"{raw}\" is not a timestamp.");

    public static DisplayName Name(string raw, string table) =>
        DisplayName.From(raw) is Succeeded<DisplayName> ok ? ok.Value : throw new InvalidDataException($"{table}: blank display name.");
}
