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
    protected sealed record Stores(IResumeStore Resumes, IRoleStore Roles, ISessionStore Sessions, IQuestionStore Questions);

    /// <summary>A fresh, empty set of stores.</summary>
    protected abstract Stores NewStores();

    private static readonly DateTimeOffset T0 = new(2026, 10, 26, 12, 0, 0, TimeSpan.Zero);
    private static readonly DocumentSource Upload = DocumentSource.Upload;

    protected static DisplayName Name(string raw) => ((Succeeded<DisplayName>)DisplayName.From(raw)).Value;
    protected static SessionId Session(string raw) => ((Succeeded<SessionId>)SessionId.From(raw)).Value;
    protected static ResumeId Resume(string raw) => ((Succeeded<ResumeId>)ResumeId.From(raw)).Value;
    protected static RoleId Role(string raw) => ((Succeeded<RoleId>)RoleId.From(raw)).Value;
    protected static QuestionSetId Set(string raw) => ((Succeeded<QuestionSetId>)QuestionSetId.From(raw)).Value;
    protected static DocumentSource Sample(string key) => ((Succeeded<DocumentSource>)DocumentSource.Sample(key)).Value;

    [Fact]
    public async Task New_stores_list_nothing()
    {
        var stores = NewStores();
        Assert.Empty(await stores.Resumes.ListAsync(default));
        Assert.Empty(await stores.Roles.ListAsync(default));
    }

    [Fact]
    public async Task An_added_document_is_listed_with_what_was_given_and_is_contained_and_found()
    {
        var stores = NewStores();
        var id = await stores.Resumes.AddAsync(Name("My CV"), "the text", T0, Upload, default);

        var expected = new StoredDocument<ResumeId>(id, Name("My CV"), T0, "the text", Upload);
        Assert.Equal(expected, Assert.Single(await stores.Resumes.ListAsync(default)));
        Assert.True(await stores.Resumes.ContainsAsync(id, default));
        Assert.Equal(expected, Assert.IsType<Succeeded<StoredDocument<ResumeId>>>(await stores.Resumes.FindAsync(id, default)).Value);
    }

    [Fact]
    public async Task Each_add_gets_its_own_id_and_an_unknown_id_is_neither_contained_nor_found()
    {
        var stores = NewStores();
        var first = await stores.Roles.AddAsync(Name("A"), "a", T0, Upload, default);
        var second = await stores.Roles.AddAsync(Name("B"), "b", T0, Upload, default);

        Assert.NotEqual(first, second);
        Assert.False(await stores.Roles.ContainsAsync(Role("nobody"), default));
        Assert.IsType<Failed<StoredDocument<RoleId>>>(await stores.Roles.FindAsync(Role("nobody"), default));
    }

    [Fact]
    public async Task Documents_are_listed_most_recently_processed_first()
    {
        var stores = NewStores();
        await stores.Roles.AddAsync(Name("older"), "x", T0, Upload, default);
        await stores.Roles.AddAsync(Name("newest"), "x", T0.AddMinutes(2), Upload, default);
        await stores.Roles.AddAsync(Name("middle"), "x", T0.AddMinutes(1), Upload, default);

        Assert.Equal(["newest", "middle", "older"], (await stores.Roles.ListAsync(default)).Select(d => d.Name.Value));
    }

    [Fact]
    public async Task A_document_remembers_its_source_and_a_sample_source_is_found_once_added()
    {
        var stores = NewStores();
        var source = Sample("personas:RET-01:role");
        Assert.False(await stores.Roles.ContainsSourceAsync(source, default));

        var id = await stores.Roles.AddAsync(Name("Store Associate"), "jd", T0, source, default);

        Assert.True(await stores.Roles.ContainsSourceAsync(source, default));
        Assert.False(await stores.Roles.ContainsSourceAsync(Sample("personas:RET-02:role"), default));
        Assert.False(await stores.Resumes.ContainsSourceAsync(source, default));
        Assert.Equal(source, Assert.IsType<Succeeded<StoredDocument<RoleId>>>(await stores.Roles.FindAsync(id, default)).Value.Source);
    }

    [Fact]
    public async Task Resumes_and_roles_are_kept_apart()
    {
        var stores = NewStores();
        var resume = await stores.Resumes.AddAsync(Name("CV"), "cv", T0, Upload, default);

        Assert.Empty(await stores.Roles.ListAsync(default));
        Assert.False(await stores.Roles.ContainsAsync(Role(resume.Value), default));
    }

    [Fact]
    public async Task A_role_has_no_questions_until_a_set_is_activated_for_it()
    {
        var stores = NewStores();
        var role = await stores.Roles.AddAsync(Name("SWE"), "jd", T0, Upload, default);
        Assert.Empty(await stores.Questions.ListAsync(role, default));

        var set = await stores.Questions.AddSetAsync(role, QuestionSource.Uploaded, ["One?", "Two?"], T0, default);
        Assert.Empty(await stores.Questions.ListAsync(role, default));

        await stores.Questions.ActivateAsync(set, default);

        var listed = await stores.Questions.ListAsync(role, default);
        Assert.Equal(["One?", "Two?"], listed.Select(q => q.Text));
        Assert.Equal([1, 2], listed.Select(q => q.Order));
        Assert.Equal(2, listed.Select(q => q.Id).Distinct().Count());
    }

    [Fact]
    public async Task A_stored_set_is_found_whole_and_an_unknown_one_is_not()
    {
        var stores = NewStores();
        var role = Role("role-1");
        var set = await stores.Questions.AddSetAsync(role, QuestionSource.Sample, ["Only?"], T0, default);

        var found = Assert.IsType<Succeeded<QuestionSet>>(await stores.Questions.FindSetAsync(set, default)).Value;
        Assert.Equal(set, found.Id);
        Assert.Equal(role, found.Role);
        Assert.Equal(QuestionSource.Sample, found.Source);
        Assert.Equal(T0, found.CreatedAt);
        Assert.Equal("Only?", Assert.Single(found.Questions).Text);
        Assert.IsType<Failed<QuestionSet>>(await stores.Questions.FindSetAsync(Set("ghost"), default));
    }

    [Fact]
    public async Task Activating_another_set_replaces_the_role_s_questions_and_purges_the_old_set()
    {
        var stores = NewStores();
        var role = Role("role-1");
        var old = await stores.Questions.AddSetAsync(role, QuestionSource.Sample, ["Old?"], T0, default);
        await stores.Questions.ActivateAsync(old, default);
        var fresh = await stores.Questions.AddSetAsync(role, QuestionSource.Generated, ["New?"], T0, default);

        await stores.Questions.ActivateAsync(fresh, default);

        Assert.Equal(["New?"], (await stores.Questions.ListAsync(role, default)).Select(q => q.Text));
        Assert.IsType<Failed<QuestionSet>>(await stores.Questions.FindSetAsync(old, default));
    }

    [Fact]
    public async Task Purging_removes_the_role_s_questions_and_leaves_other_roles_alone()
    {
        var stores = NewStores();
        var one = Role("role-1");
        var two = Role("role-2");
        await stores.Questions.ActivateAsync(await stores.Questions.AddSetAsync(one, QuestionSource.Sample, ["One?"], T0, default), default);
        await stores.Questions.ActivateAsync(await stores.Questions.AddSetAsync(two, QuestionSource.Sample, ["Two?"], T0, default), default);

        await stores.Questions.PurgeAsync(one, default);
        await stores.Questions.PurgeAsync(Role("never-had-any"), default);

        Assert.Empty(await stores.Questions.ListAsync(one, default));
        Assert.Equal(["Two?"], (await stores.Questions.ListAsync(two, default)).Select(q => q.Text));
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
    public async Task The_initial_form_round_trips_too_and_so_does_keep()
    {
        var stores = NewStores();
        var session = new InterviewSession(Session("s2"), ApplicationSetupForm.Initial, PreparationStatus.Ok, LogId.Generate());
        await stores.Sessions.SaveAsync(session, default);
        var keep = new InterviewSession(Session("s2k"), ApplicationSetupForm.Initial with { Questions = new KeepQuestions() }, PreparationStatus.Ok, LogId.Generate());
        await stores.Sessions.SaveAsync(keep, default);

        Assert.Equal(session, Assert.IsType<Succeeded<InterviewSession>>(await stores.Sessions.FindAsync(session.Id, default)).Value);
        Assert.Equal(keep, Assert.IsType<Succeeded<InterviewSession>>(await stores.Sessions.FindAsync(keep.Id, default)).Value);
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
        new AnsweredRole(Role("role-1")),
        new UploadedQuestions(Set("set-1")));
}

public sealed class InMemoryStoreContract : StoreContract
{
    protected override Stores NewStores() => new(new InMemoryResumeStore(), new InMemoryRoleStore(), new InMemorySessionStore(), new InMemoryQuestionStore());
}

public sealed class SqliteStoreContract : StoreContract, IDisposable
{
    private readonly List<SqliteDatabase> opened = [];

    protected override Stores NewStores()
    {
        var database = new SqliteDatabase(SqliteDatabase.InMemoryPath);
        opened.Add(database);
        return new(new SqliteResumeStore(database), new SqliteRoleStore(database), new SqliteSessionStore(database), new SqliteQuestionStore(database));
    }

    public void Dispose() => opened.ForEach(d => d.Dispose());
}
