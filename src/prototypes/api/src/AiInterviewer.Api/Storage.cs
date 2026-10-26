// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Adapters;
using AiInterviewer.Adapters.Sqlite;
using AiInterviewer.Business;

namespace AiInterviewer.Api;

/// <summary>
/// Part of the composition root: which store adapters back the ports, from the Storage section
/// of configuration. SQLite is the default and persists across restarts. InMemory is for mock and
/// test mode, which must never reach a real store (decision 0004, mocks in production, point 5).
/// A value that is neither is an error, never a silent fall back.
/// </summary>
public static class Storage
{
    public const string ProviderKey = "Storage:Provider";
    public const string SqlitePathKey = "Storage:Sqlite:Path";
    public const string InMemory = "InMemory";
    public const string Sqlite = "Sqlite";
    public const string DefaultSqlitePath = "data/ai-interviewer.sqlite";

    public static IServiceCollection AddStorage(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var provider = configuration[ProviderKey] ?? Sqlite;
        switch (provider)
        {
            case InMemory:
                services.AddSingleton<IResumeStore, InMemoryResumeStore>();
                services.AddSingleton<IRoleStore, InMemoryRoleStore>();
                services.AddSingleton<ISessionStore, InMemorySessionStore>();
                break;
            case Sqlite:
                var path = configuration[SqlitePathKey] ?? DefaultSqlitePath;
                // A relative path is relative to the content root (the project folder under dotnet run).
                var resolved = path == SqliteDatabase.InMemoryPath ? path : Path.GetFullPath(path, environment.ContentRootPath);
                services.AddSingleton(_ => new SqliteDatabase(resolved));
                services.AddSingleton<IResumeStore, SqliteResumeStore>();
                services.AddSingleton<IRoleStore, SqliteRoleStore>();
                services.AddSingleton<ISessionStore, SqliteSessionStore>();
                break;
            default:
                throw new InvalidOperationException($"{ProviderKey} must be \"{InMemory}\" or \"{Sqlite}\", not \"{provider}\".");
        }
        return services;
    }
}
