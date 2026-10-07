// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Collections.Concurrent;
using AiInterviewer.Business;

namespace AiInterviewer.Adapters;

// Tier 3 data adapters. Nothing is persisted: a restart forgets everything. The storage
// technology is an open item in decision 0003.

public abstract class InMemoryDocumentStore<TId>(Func<string, Outcome<TId>> makeId) : IDocumentStore<TId>
    where TId : notnull
{
    private readonly ConcurrentDictionary<TId, StoredDocument<TId>> documents = new();

    public Task<IReadOnlyList<StoredDocument<TId>>> ListAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<StoredDocument<TId>>>(
            documents.Values.OrderByDescending(d => d.ProcessedAt).ToList());

    public Task<bool> ContainsAsync(TId id, CancellationToken ct) => Task.FromResult(documents.ContainsKey(id));

    public Task<TId> AddAsync(DisplayName name, string text, DateTimeOffset processedAt, CancellationToken ct)
    {
        // A freshly generated GUID is never blank, so From cannot fail here.
        var id = ((Succeeded<TId>)makeId(Guid.NewGuid().ToString("N"))).Value;
        documents[id] = new StoredDocument<TId>(id, name, processedAt, text);
        return Task.FromResult(id);
    }
}

public sealed class InMemoryResumeStore() : InMemoryDocumentStore<ResumeId>(ResumeId.From), IResumeStore;

public sealed class InMemoryRoleStore() : InMemoryDocumentStore<RoleId>(RoleId.From), IRoleStore;

public sealed class InMemorySessionStore : ISessionStore
{
    private readonly ConcurrentDictionary<SessionId, InterviewSession> sessions = new();

    public Task SaveAsync(InterviewSession session, CancellationToken ct)
    {
        sessions[session.Id] = session;
        return Task.CompletedTask;
    }

    public Task<Outcome<InterviewSession>> FindAsync(SessionId id, CancellationToken ct) =>
        Task.FromResult(sessions.TryGetValue(id, out var session)
            ? Outcome.Success(session)
            : Outcome.Failure<InterviewSession>($"Session \"{id}\" was not found."));
}
