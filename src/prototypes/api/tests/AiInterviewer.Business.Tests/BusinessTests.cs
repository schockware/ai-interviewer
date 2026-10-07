// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Business.Hardware;
using AiInterviewer.Business.Interview;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Business.Tests;

public class ArchitectureTests
{
    [Fact]
    public void Business_references_only_the_base_class_library()
    {
        // Decision 0003: the business module references no other project and no framework.
        var referenced = typeof(Outcome).Assembly.GetReferencedAssemblies().Select(a => a.Name!).ToList();

        Assert.All(referenced, name => Assert.True(
            name == "System.Runtime" || name.StartsWith("System.") || name == "netstandard",
            $"Business references {name}, which is outside the base class library."));
    }
}

public class IdTests
{
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_ids_cannot_exist(string raw)
    {
        Assert.IsType<Failed<SessionId>>(SessionId.From(raw));
        Assert.IsType<Failed<ResumeId>>(ResumeId.From(raw));
        Assert.IsType<Failed<RoleId>>(RoleId.From(raw));
        Assert.IsType<Failed<DisplayName>>(DisplayName.From(raw));
    }

    [Fact]
    public void Ids_are_trimmed_and_compare_by_value()
    {
        Assert.Equal(Make.Session("abc"), Make.Session("  abc "));
    }
}

public class SlotCatalogTests
{
    [Fact]
    public void The_initial_form_is_valid()
    {
        Assert.Empty(SlotCatalog.Validate(ApplicationSetupForm.Initial.Ai));
    }

    [Fact]
    public void Cloud_is_refused_for_real_time_slots()
    {
        var ai = ApplicationSetupForm.Initial.Ai with { Speaker = new CloudChoice(), Listener = new CloudChoice() };

        var problems = SlotCatalog.Validate(ai);

        Assert.Equal(2, problems.Count);
        Assert.Contains(problems, p => p.StartsWith("Speaker"));
        Assert.Contains(problems, p => p.StartsWith("Listener"));
    }

    [Fact]
    public void Cloud_is_allowed_for_the_interviewer_and_custom_local_for_every_slot()
    {
        var ai = ApplicationSetupForm.Initial.Ai with { Interviewer = new CloudChoice() };
        Assert.Empty(SlotCatalog.Validate(ai));

        var allCustom = new AiSlots(new CustomLocalChoice(), new CustomLocalChoice(), new CustomLocalChoice(),
            new CustomLocalChoice(), new CustomLocalChoice(), new CustomLocalChoice());
        Assert.Empty(SlotCatalog.Validate(allCustom));
    }

    [Fact]
    public void An_unknown_name_is_refused()
    {
        var ai = ApplicationSetupForm.Initial.Ai with { Transcriber = new NamedChoice("Parakeet") };

        Assert.Single(SlotCatalog.Validate(ai));
    }

    [Fact]
    public void Evaluator_and_follow_up_offer_no_default_name()
    {
        // The contract lists "interviewer" first for these two, so "default" is not an option.
        var ai = ApplicationSetupForm.Initial.Ai with { Evaluator = new NamedChoice("default"), FollowUp = new NamedChoice("default") };

        Assert.Equal(2, SlotCatalog.Validate(ai).Count);
    }
}

public class HardwareReadinessTests
{
    private static HardwareCheck Verified(HardwareQuality q) => new(HardwareStatus.Verified, q);
    private static readonly HardwareCheck Skipped = new(HardwareStatus.Skipped, HardwareQuality.Skipped);
    private static readonly AdvancedTrainingOptions NoTraining = new(Captions.Disabled);

    [Theory]
    [InlineData(HardwareQuality.Clear)]
    [InlineData(HardwareQuality.Intermittent)]
    [InlineData(HardwareQuality.Readable)]
    public void Audio_verified_with_an_acceptable_rating_is_ready(HardwareQuality quality)
    {
        var form = new HardwareSetupForm(Verified(quality), Skipped, NoTraining);

        Assert.IsType<Ready>(form.Readiness());
    }

    [Fact]
    public void Unreadable_audio_is_not_ready()
    {
        var form = new HardwareSetupForm(Verified(HardwareQuality.Unreadable), Skipped, NoTraining);

        Assert.IsType<NotReady>(form.Readiness());
    }

    [Theory]
    [InlineData(HardwareStatus.Pending)]
    [InlineData(HardwareStatus.Skipped)]
    [InlineData(HardwareStatus.Errored)]
    public void Audio_that_is_not_verified_is_not_ready(HardwareStatus status)
    {
        var form = new HardwareSetupForm(new HardwareCheck(status, HardwareQuality.Clear), Skipped, NoTraining);

        Assert.IsType<NotReady>(form.Readiness());
    }

    [Fact]
    public void A_video_check_that_ran_badly_blocks_start()
    {
        var form = new HardwareSetupForm(Verified(HardwareQuality.Clear), new HardwareCheck(HardwareStatus.Errored, HardwareQuality.Pending), NoTraining);

        Assert.IsType<NotReady>(form.Readiness());
    }
}

public class ApplicationSetupServiceTests
{
    private readonly FakeResumeStore resumes = new();
    private readonly FakeRoleStore roles = new();
    private readonly FakeSessionStore sessions = new();
    private readonly FakePreparer preparer = new();

    private ApplicationSetupService Service() => new(resumes, roles, new FakeReader(), sessions, preparer, TimeProvider.System);

    private async Task<RoleId> AddRole() => await roles.AddAsync(Make.Name("SWE"), "jd", DateTimeOffset.UtcNow, default);

    [Fact]
    public async Task The_page_is_ready_with_no_documents_at_first()
    {
        var page = await Service().LoadPageAsync(default);

        var ready = Assert.IsType<ReadyPage>(page);
        Assert.IsType<NoDocuments<ResumeId>>(ready.Resumes);
        Assert.IsType<NoDocuments<RoleId>>(ready.Roles);
        Assert.Equal(ApplicationSetupForm.Initial, ready.Form);
    }

    [Fact]
    public async Task The_page_lists_the_newest_resume_first()
    {
        await resumes.AddAsync(Make.Name("older"), "x", DateTimeOffset.UnixEpoch, default);
        await resumes.AddAsync(Make.Name("newer"), "x", DateTimeOffset.UnixEpoch.AddDays(1), default);

        var ready = Assert.IsType<ReadyPage>(await Service().LoadPageAsync(default));

        var listed = Assert.IsType<ReadyDocuments<ResumeId>>(ready.Resumes);
        Assert.Equal(["newer", "older"], listed.All.Select(d => d.Name.Value));
    }

    [Fact]
    public async Task An_unreachable_store_becomes_the_error_state_not_an_exception()
    {
        resumes.Inner.Unavailable = true;

        var page = await Service().LoadPageAsync(default);

        Assert.Equal("Storage is offline.", Assert.IsType<ErrorPage>(page).Message);
    }

    [Fact]
    public async Task A_resume_that_cannot_be_read_is_a_failure_and_is_not_stored()
    {
        var result = await Service().UploadResumeAsync(Make.Name(), new UploadedFile("cv.bad", new byte[] { 1 }), default);

        Assert.IsType<Failed<ResumeProcessed>>(result);
        Assert.Empty(resumes.Inner.Stored);
    }

    [Fact]
    public async Task A_readable_resume_is_stored_and_returned()
    {
        var result = await Service().UploadResumeAsync(Make.Name("Jane"), new UploadedFile("cv.txt", new byte[] { 1 }), default);

        var ok = Assert.IsType<Succeeded<ResumeProcessed>>(result);
        Assert.Equal("Jane", ok.Value.DisplayName.Value);
        Assert.Single(resumes.Inner.Stored);
    }

    [Fact]
    public async Task An_empty_pasted_job_description_is_a_failure()
    {
        var result = await Service().PasteJobDescriptionAsync(Make.Name(), "  ", default);

        Assert.IsType<Failed<JobDescriptionProcessed>>(result);
        Assert.Empty(roles.Inner.Stored);
    }

    [Fact]
    public async Task A_pasted_job_description_becomes_a_role()
    {
        var result = await Service().PasteJobDescriptionAsync(Make.Name("Backend"), "We need a backend dev", default);

        Assert.IsType<Succeeded<JobDescriptionProcessed>>(result);
        Assert.Single(roles.Inner.Stored);
    }

    [Fact]
    public async Task Prepare_rejects_an_unanswered_role()
    {
        var result = await Service().PrepareAsync(ApplicationSetupForm.Initial, Make.Session(), default);

        var rejected = Assert.IsType<PrepareRejected>(result);
        Assert.Contains("Role focus is required.", rejected.Problems);
        Assert.Empty(sessions.Sessions);
        Assert.Empty(preparer.Begun);
    }

    [Fact]
    public async Task Prepare_rejects_a_role_the_server_does_not_have()
    {
        var form = ApplicationSetupForm.Initial with { RoleFocus = new AnsweredRole(Make.Role("ghost")) };

        Assert.IsType<PrepareRejected>(await Service().PrepareAsync(form, Make.Session(), default));
    }

    [Fact]
    public async Task Prepare_rejects_a_hot_interview_whose_resume_is_missing()
    {
        var role = await AddRole();
        var form = new ApplicationSetupForm(ApplicationSetupForm.Initial.Ai, new HotInterview(Make.Resume("ghost")), new AnsweredRole(role));

        var rejected = Assert.IsType<PrepareRejected>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Single(rejected.Problems);
    }

    [Fact]
    public async Task Prepare_reports_every_problem_at_once()
    {
        var form = new ApplicationSetupForm(
            ApplicationSetupForm.Initial.Ai with { Speaker = new CloudChoice() },
            new HotInterview(Make.Resume("ghost")),
            new UnansweredRole());

        var rejected = Assert.IsType<PrepareRejected>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Equal(3, rejected.Problems.Count);
    }

    [Fact]
    public async Task Prepare_accepts_a_cold_interview_and_hands_the_session_to_the_preparer()
    {
        var role = await AddRole();
        var form = ApplicationSetupForm.Initial with { RoleFocus = new AnsweredRole(role) };

        var result = await Service().PrepareAsync(form, Make.Session("s9"), default);

        Assert.IsType<PrepareAccepted>(result);
        var begun = Assert.Single(preparer.Begun);
        Assert.Equal(Make.Session("s9"), begun.Id);
        Assert.Equal(PreparationStatus.Preparing, begun.Status);
        Assert.Equal(begun, sessions.Sessions[Make.Session("s9")]);
    }

    [Fact]
    public async Task A_hot_interview_with_an_unvalidated_resume_falls_back_to_cold()
    {
        var role = await AddRole();
        var form = new ApplicationSetupForm(ApplicationSetupForm.Initial.Ai, new HotIncompleteToCold(), new AnsweredRole(role));

        Assert.IsType<PrepareAccepted>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.IsType<ColdInterview>(Assert.Single(preparer.Begun).Form.InterviewType);
    }

    [Fact]
    public async Task A_hot_interview_with_a_real_resume_stays_hot()
    {
        var role = await AddRole();
        var resume = await resumes.AddAsync(Make.Name("cv"), "x", DateTimeOffset.UtcNow, default);
        var form = new ApplicationSetupForm(ApplicationSetupForm.Initial.Ai, new HotInterview(resume), new AnsweredRole(role));

        Assert.IsType<PrepareAccepted>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Equal(new HotInterview(resume), Assert.Single(preparer.Begun).Form.InterviewType);
    }
}

public class InterviewServiceTests
{
    private readonly FakeSessionStore sessions = new();
    private InterviewService Service() => new(sessions, new FakeDiagnoser());

    private static readonly HardwareSetupForm Good = new(
        new HardwareCheck(HardwareStatus.Verified, HardwareQuality.Clear),
        new HardwareCheck(HardwareStatus.Skipped, HardwareQuality.Skipped),
        new AdvancedTrainingOptions(Captions.Disabled));

    private async Task<InterviewSession> Seed(PreparationStatus status, string id = "s1")
    {
        var session = new InterviewSession(Make.Session(id), ApplicationSetupForm.Initial, status, LogId.Generate());
        await sessions.SaveAsync(session, default);
        return session;
    }

    [Fact]
    public async Task Start_fails_for_a_session_nobody_prepared()
    {
        Assert.IsType<StartUnknownSession>(await Service().StartAsync(Good, Make.Session("nope"), default));
    }

    [Theory]
    [InlineData(PreparationStatus.Preparing)]
    [InlineData(PreparationStatus.Error)]
    public async Task Start_waits_for_preparation_to_be_ok(PreparationStatus status)
    {
        await Seed(status);

        Assert.IsType<StartNotReady>(await Service().StartAsync(Good, Make.Session(), default));
    }

    [Fact]
    public async Task Start_waits_for_verified_hardware()
    {
        await Seed(PreparationStatus.Ok);
        var pendingAudio = Good with { Audio = new HardwareCheck(HardwareStatus.Pending, HardwareQuality.Pending) };

        Assert.IsType<StartNotReady>(await Service().StartAsync(pendingAudio, Make.Session(), default));
    }

    [Fact]
    public async Task Start_returns_the_cue_settings_once_everything_is_ready()
    {
        await Seed(PreparationStatus.Ok);

        var result = await Service().StartAsync(Good, Make.Session(), default);

        Assert.Equal(CueSettings.CleanCallProposal, Assert.IsType<InterviewStarted>(result).Settings);
    }

    [Fact]
    public async Task Diagnosis_needs_the_matching_log_id()
    {
        await Seed(PreparationStatus.Error);

        Assert.IsType<DiagnosisUnknownSession>(await Service().CheckErroredAsync(Make.Session(), LogId.Generate(), default));
    }

    [Fact]
    public async Task Diagnosis_explains_a_failed_preparation()
    {
        var session = await Seed(PreparationStatus.Error);

        var result = await Service().CheckErroredAsync(session.Id, session.LogId, default);

        Assert.Equal("diagnosis", Assert.IsType<Diagnosed>(result).Message);
    }

    [Fact]
    public async Task Diagnosis_has_nothing_to_say_when_preparation_did_not_fail()
    {
        var session = await Seed(PreparationStatus.Ok);

        Assert.IsType<NothingToDiagnose>(await Service().CheckErroredAsync(session.Id, session.LogId, default));
    }
}
