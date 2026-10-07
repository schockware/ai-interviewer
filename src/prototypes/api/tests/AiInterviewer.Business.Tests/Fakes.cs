// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Business.Tests;

// Recorded stand-ins for every port. The business module runs against these alone, which is the
// point of keeping it free of adapters.

internal sealed class FakeDocumentStore<TId>(Func<string, TId> makeId) : IDocumentStore<TId> where TId : notnull
{
    public List<StoredDocument<TId>> Stored { get; } = [];
    public bool Unavailable { get; set; }

    public Task<IReadOnlyList<StoredDocument<TId>>> ListAsync(CancellationToken ct) =>
        Unavailable
            ? throw new PortUnavailableException("Storage is offline.")
            : Task.FromResult<IReadOnlyList<StoredDocument<TId>>>(Stored.OrderByDescending(d => d.ProcessedAt).ToList());

    public Task<bool> ContainsAsync(TId id, CancellationToken ct) => Task.FromResult(Stored.Any(d => d.Id.Equals(id)));

    public Task<TId> AddAsync(DisplayName name, string text, DateTimeOffset processedAt, CancellationToken ct)
    {
        var id = makeId($"id-{Stored.Count + 1}");
        Stored.Add(new StoredDocument<TId>(id, name, processedAt, text));
        return Task.FromResult(id);
    }
}

internal sealed class FakeResumeStore() : IResumeStore
{
    public FakeDocumentStore<ResumeId> Inner { get; } = new(raw => ((Succeeded<ResumeId>)ResumeId.From(raw)).Value);
    public Task<IReadOnlyList<StoredDocument<ResumeId>>> ListAsync(CancellationToken ct) => Inner.ListAsync(ct);
    public Task<bool> ContainsAsync(ResumeId id, CancellationToken ct) => Inner.ContainsAsync(id, ct);
    public Task<ResumeId> AddAsync(DisplayName name, string text, DateTimeOffset at, CancellationToken ct) => Inner.AddAsync(name, text, at, ct);
}

internal sealed class FakeRoleStore() : IRoleStore
{
    public FakeDocumentStore<RoleId> Inner { get; } = new(raw => ((Succeeded<RoleId>)RoleId.From(raw)).Value);
    public Task<IReadOnlyList<StoredDocument<RoleId>>> ListAsync(CancellationToken ct) => Inner.ListAsync(ct);
    public Task<bool> ContainsAsync(RoleId id, CancellationToken ct) => Inner.ContainsAsync(id, ct);
    public Task<RoleId> AddAsync(DisplayName name, string text, DateTimeOffset at, CancellationToken ct) => Inner.AddAsync(name, text, at, ct);
}

internal sealed class FakeReader : IDocumentReader
{
    public Task<Outcome<string>> ReadAsync(UploadedFile file, CancellationToken ct) =>
        Task.FromResult(file.FileName.EndsWith(".bad")
            ? Outcome.Failure<string>("unreadable")
            : Outcome.Success($"text of {file.FileName}"));
}

internal sealed class FakeSessionStore : ISessionStore
{
    public Dictionary<SessionId, InterviewSession> Sessions { get; } = [];

    public Task SaveAsync(InterviewSession session, CancellationToken ct)
    {
        Sessions[session.Id] = session;
        return Task.CompletedTask;
    }

    public Task<Outcome<InterviewSession>> FindAsync(SessionId id, CancellationToken ct) =>
        Task.FromResult(Sessions.TryGetValue(id, out var s)
            ? Outcome.Success(s)
            : Outcome.Failure<InterviewSession>("not found"));
}

internal sealed class FakePreparer : IInterviewPreparer
{
    public List<InterviewSession> Begun { get; } = [];

    public Task BeginAsync(InterviewSession session, CancellationToken ct)
    {
        Begun.Add(session);
        return Task.CompletedTask;
    }
}

internal sealed class FakeDiagnoser : IPreparationDiagnoser
{
    public Task<string> DiagnoseAsync(InterviewSession session, CancellationToken ct) => Task.FromResult("diagnosis");
}

internal static class Make
{
    public static SessionId Session(string raw = "s1") => ((Succeeded<SessionId>)SessionId.From(raw)).Value;
    public static ResumeId Resume(string raw) => ((Succeeded<ResumeId>)ResumeId.From(raw)).Value;
    public static RoleId Role(string raw) => ((Succeeded<RoleId>)RoleId.From(raw)).Value;
    public static DisplayName Name(string raw = "My file") => ((Succeeded<DisplayName>)DisplayName.From(raw)).Value;
}
