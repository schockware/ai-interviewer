// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Collections.Concurrent;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

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

    public Task<Outcome<StoredDocument<TId>>> FindAsync(TId id, CancellationToken ct) =>
        Task.FromResult(documents.TryGetValue(id, out var document)
            ? Outcome.Success(document)
            : Outcome.Failure<StoredDocument<TId>>($"\"{id}\" was not found."));

    public Task<bool> ContainsSourceAsync(DocumentSource source, CancellationToken ct) =>
        Task.FromResult(documents.Values.Any(d => d.Source == source));

    public Task<TId> AddAsync(DisplayName name, string text, DateTimeOffset processedAt, DocumentSource source, CancellationToken ct)
    {
        // A freshly generated GUID is never blank, so From cannot fail here.
        var id = ((Succeeded<TId>)makeId(Guid.NewGuid().ToString("N"))).Value;
        documents[id] = new StoredDocument<TId>(id, name, processedAt, text, source);
        return Task.FromResult(id);
    }
}

public sealed class InMemoryResumeStore() : InMemoryDocumentStore<ResumeId>(ResumeId.From), IResumeStore;

public sealed class InMemoryRoleStore() : InMemoryDocumentStore<RoleId>(RoleId.From), IRoleStore;

/// <summary>Question sets by id, and which set is each role's current one.</summary>
public sealed class InMemoryQuestionStore : IQuestionStore
{
    private readonly object gate = new();
    private readonly Dictionary<QuestionSetId, QuestionSet> sets = [];
    private readonly Dictionary<RoleId, QuestionSetId> active = [];

    public Task<IReadOnlyList<InterviewQuestion>> ListAsync(RoleId role, CancellationToken ct)
    {
        lock (gate)
        {
            return Task.FromResult(active.TryGetValue(role, out var id) ? sets[id].Questions : (IReadOnlyList<InterviewQuestion>)[]);
        }
    }

    public Task<QuestionSetId> AddSetAsync(RoleId role, QuestionSource source, IReadOnlyList<string> texts, DateTimeOffset createdAt, CancellationToken ct)
    {
        var id = ((Succeeded<QuestionSetId>)QuestionSetId.From(Guid.NewGuid().ToString("N"))).Value;
        var list = texts.Select((text, i) => new InterviewQuestion(((Succeeded<QuestionId>)QuestionId.From(Guid.NewGuid().ToString("N"))).Value, i + 1, text)).ToList();
        lock (gate)
        {
            sets[id] = new QuestionSet(id, role, source, createdAt, list);
        }
        return Task.FromResult(id);
    }

    public Task<Outcome<QuestionSet>> FindSetAsync(QuestionSetId id, CancellationToken ct)
    {
        lock (gate)
        {
            return Task.FromResult(sets.TryGetValue(id, out var set) ? Outcome.Success(set) : Outcome.Failure<QuestionSet>($"Questions \"{id}\" were not found."));
        }
    }

    public Task ActivateAsync(QuestionSetId id, CancellationToken ct)
    {
        lock (gate)
        {
            if (!sets.TryGetValue(id, out var set)) throw new InvalidOperationException($"Questions \"{id}\" were not found.");
            if (active.TryGetValue(set.Role, out var previous) && previous != id) sets.Remove(previous);
            active[set.Role] = id;
        }
        return Task.CompletedTask;
    }

    public Task PurgeAsync(RoleId role, CancellationToken ct)
    {
        lock (gate)
        {
            if (active.Remove(role, out var previous)) sets.Remove(previous);
        }
        return Task.CompletedTask;
    }
}

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
