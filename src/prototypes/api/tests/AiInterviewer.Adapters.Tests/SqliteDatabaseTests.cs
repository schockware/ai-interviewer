// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Adapters.Sqlite;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

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
            resumeId = await new SqliteResumeStore(first).AddAsync(Name("CV"), "text", DateTimeOffset.UtcNow, default);
            await new SqliteRoleStore(first).AddAsync(Name("Role"), "jd", DateTimeOffset.UtcNow, default);
            await new SqliteSessionStore(first).SaveAsync(session, default);
        }

        using var second = new SqliteDatabase(FilePath);
        Assert.True(await new SqliteResumeStore(second).ContainsAsync(resumeId, default));
        Assert.Equal("Role", Assert.Single(await new SqliteRoleStore(second).ListAsync(default)).Name.Value);
        Assert.Equal(session, Assert.IsType<Succeeded<InterviewSession>>(await new SqliteSessionStore(second).FindAsync(session.Id, default)).Value);
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
            await new SqliteRoleStore(first).AddAsync(Name("Role"), "jd", DateTimeOffset.UtcNow, default);
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
