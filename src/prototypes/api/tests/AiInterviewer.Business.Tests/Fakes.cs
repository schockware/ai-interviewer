// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
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

    public Task<Outcome<StoredDocument<TId>>> FindAsync(TId id, CancellationToken ct) =>
        Task.FromResult(Stored.FirstOrDefault(d => d.Id.Equals(id)) is { } found ? Outcome.Success(found) : Outcome.Failure<StoredDocument<TId>>("not found"));

    public Task<bool> ContainsSourceAsync(DocumentSource source, CancellationToken ct) => Task.FromResult(Stored.Any(d => d.Source == source));

    public Task<TId> AddAsync(DisplayName name, string text, DateTimeOffset processedAt, DocumentSource source, CancellationToken ct)
    {
        var id = makeId($"id-{Stored.Count + 1}");
        Stored.Add(new StoredDocument<TId>(id, name, processedAt, text, source));
        return Task.FromResult(id);
    }
}

internal sealed class FakeResumeStore() : IResumeStore
{
    public FakeDocumentStore<ResumeId> Inner { get; } = new(raw => ((Succeeded<ResumeId>)ResumeId.From(raw)).Value);
    public Task<IReadOnlyList<StoredDocument<ResumeId>>> ListAsync(CancellationToken ct) => Inner.ListAsync(ct);
    public Task<bool> ContainsAsync(ResumeId id, CancellationToken ct) => Inner.ContainsAsync(id, ct);
    public Task<Outcome<StoredDocument<ResumeId>>> FindAsync(ResumeId id, CancellationToken ct) => Inner.FindAsync(id, ct);
    public Task<bool> ContainsSourceAsync(DocumentSource source, CancellationToken ct) => Inner.ContainsSourceAsync(source, ct);
    public Task<ResumeId> AddAsync(DisplayName name, string text, DateTimeOffset at, DocumentSource source, CancellationToken ct) => Inner.AddAsync(name, text, at, source, ct);
}

internal sealed class FakeRoleStore() : IRoleStore
{
    public FakeDocumentStore<RoleId> Inner { get; } = new(raw => ((Succeeded<RoleId>)RoleId.From(raw)).Value);
    public Task<IReadOnlyList<StoredDocument<RoleId>>> ListAsync(CancellationToken ct) => Inner.ListAsync(ct);
    public Task<bool> ContainsAsync(RoleId id, CancellationToken ct) => Inner.ContainsAsync(id, ct);
    public Task<Outcome<StoredDocument<RoleId>>> FindAsync(RoleId id, CancellationToken ct) => Inner.FindAsync(id, ct);
    public Task<bool> ContainsSourceAsync(DocumentSource source, CancellationToken ct) => Inner.ContainsSourceAsync(source, ct);
    public Task<RoleId> AddAsync(DisplayName name, string text, DateTimeOffset at, DocumentSource source, CancellationToken ct) => Inner.AddAsync(name, text, at, source, ct);
}

/// <summary>Sets by id; <see cref="Active"/> is each role's current set.</summary>
internal sealed class FakeQuestionStore : IQuestionStore
{
    public Dictionary<QuestionSetId, QuestionSet> Sets { get; } = [];
    public Dictionary<RoleId, QuestionSetId> Active { get; } = [];
    public List<RoleId> Purged { get; } = [];

    public Task<IReadOnlyList<InterviewQuestion>> ListAsync(RoleId role, CancellationToken ct) =>
        Task.FromResult(Active.TryGetValue(role, out var id) ? Sets[id].Questions : (IReadOnlyList<InterviewQuestion>)[]);

    public Task<QuestionSetId> AddSetAsync(RoleId role, QuestionSource source, IReadOnlyList<string> texts, DateTimeOffset createdAt, CancellationToken ct)
    {
        var id = Make.Set($"set-{Sets.Count + 1}");
        Sets[id] = new QuestionSet(id, role, source, createdAt, texts.Select((t, i) => new InterviewQuestion(Make.Question($"{id}-q{i + 1}"), i + 1, t)).ToList());
        return Task.FromResult(id);
    }

    public Task<Outcome<QuestionSet>> FindSetAsync(QuestionSetId id, CancellationToken ct) =>
        Task.FromResult(Sets.TryGetValue(id, out var set) ? Outcome.Success(set) : Outcome.Failure<QuestionSet>("not found"));

    public Task ActivateAsync(QuestionSetId id, CancellationToken ct)
    {
        Active[Sets[id].Role] = id;
        return Task.CompletedTask;
    }

    public Task PurgeAsync(RoleId role, CancellationToken ct)
    {
        Purged.Add(role);
        Active.Remove(role);
        return Task.CompletedTask;
    }

    /// <summary>Gives the role questions directly, as a role loaded from the samples would have.</summary>
    public async Task Give(RoleId role, params string[] texts) => await ActivateAsync(await AddSetAsync(role, QuestionSource.Sample, texts, DateTimeOffset.UnixEpoch, default), default);
}

internal sealed class FakeWriter : IQuestionWriter
{
    public List<RoleId> Written { get; } = [];

    public Task<IReadOnlyList<string>> WriteAsync(StoredDocument<RoleId> role, CancellationToken ct)
    {
        Written.Add(role.Id);
        return Task.FromResult<IReadOnlyList<string>>([$"Why {role.Name}?", "Tell me about a time."]);
    }
}

internal sealed class FakeReader : IDocumentReader
{
    public Task<Outcome<string>> ReadAsync(UploadedFile file, CancellationToken ct) =>
        Task.FromResult(file.FileName.EndsWith(".bad")
            ? Outcome.Failure<string>("unreadable")
            : Outcome.Success(file.FileName.EndsWith(".lines") ? "First question?\nSecond question?" : $"text of {file.FileName}"));
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

internal sealed class FakeUploader : IResumeUploader
{
    /// <summary>Options is null when the default overload was used.</summary>
    public List<(ResumeId Id, DisplayName Name, ResumeUploaderOptions? Options)> Begun { get; } = [];

    public Task BeginAsync(ResumeId id, DisplayName name, CancellationToken ct)
    {
        Begun.Add((id, name, null));
        return Task.CompletedTask;
    }

    public Task BeginAsync(ResumeId id, DisplayName name, ResumeUploaderOptions options, CancellationToken ct)
    {
        Begun.Add((id, name, options));
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
    public static QuestionSetId Set(string raw) => ((Succeeded<QuestionSetId>)QuestionSetId.From(raw)).Value;
    public static QuestionId Question(string raw) => ((Succeeded<QuestionId>)QuestionId.From(raw)).Value;
    public static DisplayName Name(string raw = "My file") => ((Succeeded<DisplayName>)DisplayName.From(raw)).Value;
}
