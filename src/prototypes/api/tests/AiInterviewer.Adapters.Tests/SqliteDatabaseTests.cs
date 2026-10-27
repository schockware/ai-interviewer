// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Adapters.Sqlite;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;
using Microsoft.Data.Sqlite;

namespace AiInterviewer.Adapters.Tests;

/// <summary>What SQLite adds over the in-memory stores: data survives a restart, unless it was asked not to.</summary>
public sealed class SqliteDatabaseTests : IDisposable
{
    private readonly string folder = Path.Combine(Path.GetTempPath(), "ai-interviewer-tests", Guid.NewGuid().ToString("N"));
    private string FilePath => Path.Combine(folder, "nested", "test.sqlite");

    private static DisplayName Name(string raw) => ((Succeeded<DisplayName>)DisplayName.From(raw)).Value;
    private static SessionId Session(string raw) => ((Succeeded<SessionId>)SessionId.From(raw)).Value;

    [Fact]
    public async Task A_file_database_keeps_documents_and_sessions_across_reopening()
    {
        ResumeId resumeId;
        var session = new InterviewSession(Session("s1"), ApplicationSetupForm.Initial, PreparationStatus.Ok, LogId.Generate());
        using (var first = new SqliteDatabase(FilePath))
        {
            resumeId = await new SqliteResumeStore(first).AddAsync(Name("CV"), "text", DateTimeOffset.UtcNow, DocumentSource.Upload, default);
            var roleId = await new SqliteRoleStore(first).AddAsync(Name("Role"), "jd", DateTimeOffset.UtcNow, DocumentSource.Upload, default);
            var questions = new SqliteQuestionStore(first);
            await questions.ActivateAsync(await questions.AddSetAsync(roleId, QuestionSource.Uploaded, ["Kept?"], DateTimeOffset.UtcNow, default), default);
            await new SqliteSessionStore(first).SaveAsync(session, default);
        }

        using var second = new SqliteDatabase(FilePath);
        Assert.True(await new SqliteResumeStore(second).ContainsAsync(resumeId, default));
        var role = Assert.Single(await new SqliteRoleStore(second).ListAsync(default));
        Assert.Equal("Role", role.Name.Value);
        Assert.Equal("Kept?", Assert.Single(await new SqliteQuestionStore(second).ListAsync(role.Id, default)).Text);
        Assert.Equal(session, Assert.IsType<Succeeded<InterviewSession>>(await new SqliteSessionStore(second).FindAsync(session.Id, default)).Value);
    }

    [Fact]
    public async Task A_file_from_before_document_sources_gains_the_column_and_its_rows_read_as_uploads()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        await using (var old = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = FilePath }.ToString()))
        {
            await old.OpenAsync();
            await using var create = old.CreateCommand();
            create.CommandText = """
                CREATE TABLE roles (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, processed_at TEXT NOT NULL, text TEXT NOT NULL);
                INSERT INTO roles (id, display_name, processed_at, text) VALUES ('r1', 'Old role', '2026-10-26T12:00:00.0000000+00:00', 'jd');
                """;
            await create.ExecuteNonQueryAsync();
        }
        SqliteConnection.ClearAllPools();

        using var database = new SqliteDatabase(FilePath);

        var role = Assert.Single(await new SqliteRoleStore(database).ListAsync(default));
        Assert.Equal(DocumentSource.Upload, role.Source);
        Assert.True(await new SqliteRoleStore(database).ContainsSourceAsync(DocumentSource.Upload, default));
    }

    [Fact]
    public void A_file_database_creates_its_folder()
    {
        using var database = new SqliteDatabase(FilePath);
        Assert.True(File.Exists(FilePath));
    }

    [Fact]
    public async Task An_in_memory_database_is_private_and_forgotten_when_closed()
    {
        using (var first = new SqliteDatabase(SqliteDatabase.InMemoryPath))
        {
            await new SqliteRoleStore(first).AddAsync(Name("Role"), "jd", DateTimeOffset.UtcNow, DocumentSource.Upload, default);
            using var concurrent = new SqliteDatabase(SqliteDatabase.InMemoryPath);
            Assert.Empty(await new SqliteRoleStore(concurrent).ListAsync(default));
        }

        using var second = new SqliteDatabase(SqliteDatabase.InMemoryPath);
        Assert.Empty(await new SqliteRoleStore(second).ListAsync(default));
    }

    [Fact]
    public async Task A_closed_database_reports_the_port_unavailable_instead_of_a_raw_error()
    {
        var database = new SqliteDatabase(SqliteDatabase.InMemoryPath);
        var store = new SqliteRoleStore(database);
        database.Dispose();

        await Assert.ThrowsAsync<PortUnavailableException>(() => store.ListAsync(default));
    }

    public void Dispose()
    {
        if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
    }
}
