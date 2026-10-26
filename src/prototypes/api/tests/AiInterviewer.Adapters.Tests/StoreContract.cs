// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Adapters.Sqlite;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters.Tests;

/// <summary>
/// The behavior every store adapter must share, written once and run against each one (the same
/// idea as the UI's setupHostContract: if the in-memory one passes and SQLite fails, the mock lies).
/// </summary>
public abstract class StoreContract
{
    protected sealed record Stores(IResumeStore Resumes, IRoleStore Roles, ISessionStore Sessions);

    /// <summary>A fresh, empty set of stores.</summary>
    protected abstract Stores NewStores();

    private static readonly DateTimeOffset T0 = new(2026, 10, 26, 12, 0, 0, TimeSpan.Zero);

    protected static DisplayName Name(string raw) => ((Succeeded<DisplayName>)DisplayName.From(raw)).Value;
    protected static SessionId Session(string raw) => ((Succeeded<SessionId>)SessionId.From(raw)).Value;
    protected static ResumeId Resume(string raw) => ((Succeeded<ResumeId>)ResumeId.From(raw)).Value;
    protected static RoleId Role(string raw) => ((Succeeded<RoleId>)RoleId.From(raw)).Value;

    [Fact]
    public async Task New_stores_list_nothing()
    {
        var stores = NewStores();
        Assert.Empty(await stores.Resumes.ListAsync(default));
        Assert.Empty(await stores.Roles.ListAsync(default));
    }

    [Fact]
    public async Task An_added_document_is_listed_with_what_was_given_and_is_contained()
    {
        var stores = NewStores();
        var id = await stores.Resumes.AddAsync(Name("My CV"), "the text", T0, default);

        var listed = Assert.Single(await stores.Resumes.ListAsync(default));
        Assert.Equal(new StoredDocument<ResumeId>(id, Name("My CV"), T0, "the text"), listed);
        Assert.True(await stores.Resumes.ContainsAsync(id, default));
    }

    [Fact]
    public async Task Each_add_gets_its_own_id_and_an_unknown_id_is_not_contained()
    {
        var stores = NewStores();
        var first = await stores.Roles.AddAsync(Name("A"), "a", T0, default);
        var second = await stores.Roles.AddAsync(Name("B"), "b", T0, default);

        Assert.NotEqual(first, second);
        Assert.False(await stores.Roles.ContainsAsync(Role("nobody"), default));
    }

    [Fact]
    public async Task Documents_are_listed_most_recently_processed_first()
    {
        var stores = NewStores();
        await stores.Roles.AddAsync(Name("older"), "x", T0, default);
        await stores.Roles.AddAsync(Name("newest"), "x", T0.AddMinutes(2), default);
        await stores.Roles.AddAsync(Name("middle"), "x", T0.AddMinutes(1), default);

        Assert.Equal(["newest", "middle", "older"], (await stores.Roles.ListAsync(default)).Select(d => d.Name.Value));
    }

    [Fact]
    public async Task Resumes_and_roles_are_kept_apart()
    {
        var stores = NewStores();
        var resume = await stores.Resumes.AddAsync(Name("CV"), "cv", T0, default);

        Assert.Empty(await stores.Roles.ListAsync(default));
        Assert.False(await stores.Roles.ContainsAsync(Role(resume.Value), default));
    }

    [Fact]
    public async Task A_session_that_was_never_saved_is_not_found()
    {
        var stores = NewStores();
        Assert.IsType<Failed<InterviewSession>>(await stores.Sessions.FindAsync(Session("ghost"), default));
    }

    [Fact]
    public async Task A_saved_session_comes_back_whole()
    {
        var stores = NewStores();
        var session = new InterviewSession(Session("s1"), FullForm, PreparationStatus.Preparing, LogId.Generate());
        await stores.Sessions.SaveAsync(session, default);

        var found = Assert.IsType<Succeeded<InterviewSession>>(await stores.Sessions.FindAsync(session.Id, default));
        Assert.Equal(session, found.Value);
    }

    [Fact]
    public async Task The_initial_form_round_trips_too()
    {
        var stores = NewStores();
        var session = new InterviewSession(Session("s2"), ApplicationSetupForm.Initial, PreparationStatus.Ok, LogId.Generate());
        await stores.Sessions.SaveAsync(session, default);

        Assert.Equal(session, Assert.IsType<Succeeded<InterviewSession>>(await stores.Sessions.FindAsync(session.Id, default)).Value);
    }

    [Fact]
    public async Task Saving_the_same_session_again_replaces_it()
    {
        var stores = NewStores();
        var first = new InterviewSession(Session("s3"), ApplicationSetupForm.Initial, PreparationStatus.Preparing, LogId.Generate());
        await stores.Sessions.SaveAsync(first, default);
        var second = first with { Status = PreparationStatus.Error, LogId = LogId.Generate() };
        await stores.Sessions.SaveAsync(second, default);

        Assert.Equal(second, Assert.IsType<Succeeded<InterviewSession>>(await stores.Sessions.FindAsync(first.Id, default)).Value);
    }

    /// <summary>Every variant the form can hold, so the round trip is checked for each.</summary>
    protected static readonly ApplicationSetupForm FullForm = new(
        new AiSlots(
            Listener: new NamedChoice("Silero VAD + Smart Turn"),
            Transcriber: new CustomLocalChoice(),
            FollowUp: new CloudChoice(),
            Interviewer: new NamedChoice("default"),
            Evaluator: new NamedChoice("interviewer"),
            Speaker: new NamedChoice("Kokoro")),
        new HotInterview(Resume("resume-1")),
        new AnsweredRole(Role("role-1")));
}

public sealed class InMemoryStoreContract : StoreContract
{
    protected override Stores NewStores() => new(new InMemoryResumeStore(), new InMemoryRoleStore(), new InMemorySessionStore());
}

public sealed class SqliteStoreContract : StoreContract, IDisposable
{
    private readonly List<SqliteDatabase> opened = [];

    protected override Stores NewStores()
    {
        var database = new SqliteDatabase(SqliteDatabase.InMemoryPath);
        opened.Add(database);
        return new(new SqliteResumeStore(database), new SqliteRoleStore(database), new SqliteSessionStore(database));
    }

    public void Dispose() => opened.ForEach(d => d.Dispose());
}
