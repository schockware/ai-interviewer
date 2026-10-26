// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Business;
using Microsoft.Data.Sqlite;

namespace AiInterviewer.Adapters.Sqlite;

/// <summary>
/// One SQLite database for every tier 3 store. Opened once per process; the schema is created on
/// open, so there is no migration step yet. A file path persists across restarts. The special
/// path <see cref="InMemoryPath"/> gives a private database that lives only as long as this object,
/// which is what mock and test mode need (decision 0004, mocks in production, point 5).
/// The storage technology itself is still an open item in decision 0003; this is the prototype's pick.
/// </summary>
public sealed class SqliteDatabase : IDisposable
{
    public const string InMemoryPath = ":memory:";

    private const string Schema = """
        CREATE TABLE IF NOT EXISTS resumes (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            processed_at TEXT NOT NULL,
            text TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            processed_at TEXT NOT NULL,
            text TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            form TEXT NOT NULL,
            status TEXT NOT NULL,
            log_id TEXT NOT NULL
        );
        """;

    private readonly string connectionString;
    // An in-memory database is dropped when its last connection closes, so one stays open for the lifetime.
    private readonly SqliteConnection? anchor;
    // A shared-cache in-memory database locks per table and does not wait, so its callers take turns.
    private readonly SemaphoreSlim? turn;
    private bool disposed;

    public SqliteDatabase(string path)
    {
        ConfiguredPath = path;
        if (path == InMemoryPath)
        {
            connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = $"ai-interviewer-{Guid.NewGuid():N}",
                Mode = SqliteOpenMode.Memory,
                Cache = SqliteCacheMode.Shared,
            }.ToString();
            anchor = new SqliteConnection(connectionString);
            anchor.Open();
            turn = new SemaphoreSlim(1, 1);
        }
        else
        {
            var full = Path.GetFullPath(path);
            Directory.CreateDirectory(Path.GetDirectoryName(full)!);
            connectionString = new SqliteConnectionStringBuilder { DataSource = full }.ToString();
        }

        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var create = connection.CreateCommand();
        // Write-ahead logging lets a read proceed while a write is in flight. It has no meaning in memory.
        create.CommandText = anchor is null ? "PRAGMA journal_mode=WAL;" + Schema : Schema;
        create.ExecuteNonQuery();
    }

    /// <summary>The path as configured, for messages. <see cref="InMemoryPath"/> for a private database.</summary>
    public string ConfiguredPath { get; }

    public bool IsInMemory => anchor is not null;

    /// <summary>
    /// Runs one unit of work on its own connection. A database failure surfaces as
    /// <see cref="PortUnavailableException"/>, which the business module turns into the page's
    /// error state, and so does a row this server cannot read.
    /// </summary>
    public async Task<T> RunAsync<T>(Func<SqliteConnection, CancellationToken, Task<T>> work, CancellationToken ct)
    {
        if (disposed) throw new PortUnavailableException($"The database at {ConfiguredPath} is closed.");
        if (turn is not null) await turn.WaitAsync(ct);
        try
        {
            await using var connection = new SqliteConnection(connectionString);
            await connection.OpenAsync(ct);
            return await work(connection, ct);
        }
        catch (SqliteException failure)
        {
            throw new PortUnavailableException($"The database at {ConfiguredPath} failed: {failure.Message}");
        }
        catch (InvalidDataException corrupt)
        {
            throw new PortUnavailableException($"The database at {ConfiguredPath} holds data this server cannot read: {corrupt.Message}");
        }
        finally
        {
            turn?.Release();
        }
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        // Pooled connections would keep the file open, and an in-memory database alive, after this.
        SqliteConnection.ClearPool(new SqliteConnection(connectionString));
        anchor?.Dispose();
        turn?.Dispose();
    }
}
