// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Adapters;
using AiInterviewer.Adapters.Sqlite;
using AiInterviewer.Business;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace AiInterviewer.Api.Tests;

/// <summary>The Storage section picks the adapters, and only the two known providers are accepted.</summary>
public class StorageTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public void Sqlite_is_the_default_provider()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        Assert.IsType<SqliteResumeStore>(server.Services.GetRequiredService<IResumeStore>());
        Assert.IsType<SqliteRoleStore>(server.Services.GetRequiredService<IRoleStore>());
        Assert.IsType<SqliteSessionStore>(server.Services.GetRequiredService<ISessionStore>());
        Assert.True(server.Services.GetRequiredService<SqliteDatabase>().IsInMemory);
    }

    [Fact]
    public void InMemory_can_be_chosen_for_mock_and_test_mode()
    {
        using var server = factory.WithWebHostBuilder(b => b.UseSetting(Storage.ProviderKey, Storage.InMemory));
        Assert.IsType<InMemoryResumeStore>(server.Services.GetRequiredService<IResumeStore>());
        Assert.IsType<InMemoryRoleStore>(server.Services.GetRequiredService<IRoleStore>());
        Assert.IsType<InMemorySessionStore>(server.Services.GetRequiredService<ISessionStore>());
    }

    [Fact]
    public void An_unknown_provider_stops_the_app_from_starting()
    {
        using var server = factory.WithWebHostBuilder(b => b.UseSetting(Storage.ProviderKey, "Postgres"));
        var failure = Assert.Throws<InvalidOperationException>(() => server.Services);
        Assert.Contains("Postgres", failure.Message);
    }
}
