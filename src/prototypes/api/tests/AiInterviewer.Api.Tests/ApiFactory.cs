// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Adapters.Sqlite;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AiInterviewer.Api.Tests;

/// <summary>
/// The app as the HTTP tests see it: the real SQLite adapter on a private in-memory database, so
/// every server starts empty and nothing touches the file a local run writes.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseSetting(Storage.SqlitePathKey, SqliteDatabase.InMemoryPath);
}
