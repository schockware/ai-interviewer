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

public class QuestionTextTests
{
    private static IReadOnlyList<string> Parsed(string text) => Assert.IsType<Succeeded<IReadOnlyList<string>>>(QuestionText.Parse(text)).Value;
    private static string Refused(string text) => Assert.IsType<Failed<IReadOnlyList<string>>>(QuestionText.Parse(text)).Message;

    [Fact]
    public void Plain_text_is_one_question_per_line_without_headings_blank_lines_or_list_markers()
    {
        var text = "# My questions\r\n\r\n- Why us?\n* Tell me about a time you led.\n3. What would you do first?\n4) Anything else?\n   \nLast one\n";

        Assert.Equal(["Why us?", "Tell me about a time you led.", "What would you do first?", "Anything else?", "Last one"], Parsed(text));
    }

    [Fact]
    public void Json_may_be_an_array_of_strings_a_questions_object_or_one_role_from_the_sample_bank()
    {
        Assert.Equal(["A?", "B?"], Parsed("""["A?", " B? "]"""));
        Assert.Equal(["A?", "B?"], Parsed("""{ "questions": ["A?", { "text": "B?" }] }"""));
        Assert.Equal(["A?"], Parsed("""{ "persona_id": "RET-01", "core": [{ "id": "RET-01-C1", "text": "A?", "followups": [] }] }"""));
    }

    [Fact]
    public void A_whole_bank_empty_text_and_a_headings_only_file_are_refused_with_a_reason()
    {
        Assert.Contains("whole question bank", Refused("""{ "roles": [] }"""));
        Assert.Contains("empty", Refused("   \n"));
        Assert.Contains("No questions were found", Refused("# Only a heading"));
        Assert.Contains("not valid JSON", Refused("[oops"));
        Assert.Contains("string, or an object", Refused("[1, 2]"));
    }
}

public class ApplicationSetupServiceTests
{
    private readonly FakeResumeStore resumes = new();
    private readonly FakeRoleStore roles = new();
    private readonly FakeQuestionStore questions = new();
    private readonly FakeWriter writer = new();
    private readonly FakeSessionStore sessions = new();
    private readonly FakePreparer preparer = new();
    private readonly FakeUploader uploader = new();

    private ApplicationSetupService Service() => new(resumes, roles, questions, writer, new FakeReader(), sessions, preparer, uploader, TimeProvider.System);

    [Fact]
    public async Task A_stored_resume_is_handed_to_the_uploader_under_its_new_id()
    {
        var result = await Service().UploadResumeAsync(Make.Name("CV"), new UploadedFile("cv.txt", new byte[] { 1 }), default);

        var ok = Assert.IsType<Succeeded<ResumeProcessed>>(result);
        Assert.Equal((ok.Value.ResumeId, Make.Name("CV"), (ResumeUploaderOptions?)null), Assert.Single(uploader.Begun));
    }

    [Fact]
    public async Task Explicit_uploader_options_reach_the_uploader_for_that_upload()
    {
        var options = new ResumeUploaderOptions(TimeSpan.Zero, TimeSpan.Zero, Seed: 7);

        var result = await Service().UploadResumeAsync(Make.Name("CV"), new UploadedFile("cv.txt", new byte[] { 1 }), options, default);

        var ok = Assert.IsType<Succeeded<ResumeProcessed>>(result);
        Assert.Equal((ok.Value.ResumeId, Make.Name("CV"), options), Assert.Single(uploader.Begun));
    }

    [Fact]
    public async Task A_resume_that_cannot_be_read_never_reaches_the_uploader()
    {
        await Service().UploadResumeAsync(Make.Name("CV"), new UploadedFile("cv.bad", new byte[] { 1 }), default);

        Assert.Empty(uploader.Begun);
    }

    private async Task<RoleId> AddRole() => await roles.AddAsync(Make.Name("SWE"), "jd", DateTimeOffset.UtcNow, DocumentSource.Upload, default);

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
        await resumes.AddAsync(Make.Name("older"), "x", DateTimeOffset.UnixEpoch, DocumentSource.Upload, default);
        await resumes.AddAsync(Make.Name("newer"), "x", DateTimeOffset.UnixEpoch.AddDays(1), DocumentSource.Upload, default);

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
        var form = new ApplicationSetupForm(ApplicationSetupForm.Initial.Ai, new HotInterview(Make.Resume("ghost")), new AnsweredRole(role), new GenerateQuestions());

        var rejected = Assert.IsType<PrepareRejected>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Single(rejected.Problems);
    }

    [Fact]
    public async Task Prepare_reports_every_problem_at_once()
    {
        var form = new ApplicationSetupForm(
            ApplicationSetupForm.Initial.Ai with { Speaker = new CloudChoice() },
            new HotInterview(Make.Resume("ghost")),
            new UnansweredRole(),
            new GenerateQuestions());

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
        var form = new ApplicationSetupForm(ApplicationSetupForm.Initial.Ai, new HotIncompleteToCold(), new AnsweredRole(role), new GenerateQuestions());

        Assert.IsType<PrepareAccepted>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.IsType<ColdInterview>(Assert.Single(preparer.Begun).Form.InterviewType);
    }

    [Fact]
    public async Task A_hot_interview_with_a_real_resume_stays_hot()
    {
        var role = await AddRole();
        var resume = await resumes.AddAsync(Make.Name("cv"), "x", DateTimeOffset.UtcNow, DocumentSource.Upload, default);
        var form = new ApplicationSetupForm(ApplicationSetupForm.Initial.Ai, new HotInterview(resume), new AnsweredRole(role), new GenerateQuestions());

        Assert.IsType<PrepareAccepted>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Equal(new HotInterview(resume), Assert.Single(preparer.Begun).Form.InterviewType);
    }

    [Fact]
    public async Task A_role_is_described_by_its_job_description_and_its_saved_questions()
    {
        var role = await AddRole();
        Assert.Empty(Assert.IsType<Succeeded<RoleDetail>>(await Service().LoadRoleAsync(role, default)).Value.Questions);
        await questions.Give(role, "Saved one?", "Saved two?");

        var detail = Assert.IsType<Succeeded<RoleDetail>>(await Service().LoadRoleAsync(role, default)).Value;

        Assert.Equal("SWE", detail.Name.Value);
        Assert.Equal("jd", detail.Description);
        Assert.Equal(["Saved one?", "Saved two?"], detail.Questions.Select(q => q.Text));
        Assert.IsType<Failed<RoleDetail>>(await Service().LoadRoleAsync(Make.Role("ghost"), default));
    }

    [Fact]
    public async Task Uploaded_questions_are_stored_for_the_role_but_are_not_its_questions_yet()
    {
        var role = await AddRole();

        var result = await Service().UploadQuestionsAsync(role, Make.Name("Mine"), new UploadedFile("q.lines", new byte[] { 1 }), default);

        var ok = Assert.IsType<Succeeded<QuestionsProcessed>>(result);
        Assert.Equal(2, ok.Value.Count);
        Assert.Equal(QuestionSource.Uploaded, questions.Sets[ok.Value.SetId].Source);
        Assert.Empty(await questions.ListAsync(role, default));
    }

    [Fact]
    public async Task Questions_for_an_unknown_role_an_unreadable_file_or_an_empty_paste_are_failures()
    {
        var role = await AddRole();

        Assert.IsType<Failed<QuestionsProcessed>>(await Service().PasteQuestionsAsync(Make.Role("ghost"), Make.Name(), "One?", default));
        Assert.IsType<Failed<QuestionsProcessed>>(await Service().UploadQuestionsAsync(role, Make.Name(), new UploadedFile("q.bad", new byte[] { 1 }), default));
        Assert.IsType<Failed<QuestionsProcessed>>(await Service().PasteQuestionsAsync(role, Make.Name(), "  ", default));
        Assert.Empty(questions.Sets);
    }

    [Fact]
    public async Task Prepare_refuses_to_keep_questions_a_role_does_not_have()
    {
        var role = await AddRole();
        var form = ApplicationSetupForm.Initial with { RoleFocus = new AnsweredRole(role), Questions = new KeepQuestions() };

        var rejected = Assert.IsType<PrepareRejected>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Contains(rejected.Problems, p => p.Contains("no saved questions to keep"));
        Assert.Empty(preparer.Begun);
    }

    [Fact]
    public async Task Prepare_keeps_saved_questions_untouched()
    {
        var role = await AddRole();
        await questions.Give(role, "Saved?");
        var form = ApplicationSetupForm.Initial with { RoleFocus = new AnsweredRole(role), Questions = new KeepQuestions() };

        Assert.IsType<PrepareAccepted>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Equal(["Saved?"], (await questions.ListAsync(role, default)).Select(q => q.Text));
        Assert.Empty(writer.Written);
        Assert.Empty(questions.Purged);
    }

    [Fact]
    public async Task Prepare_with_generate_purges_the_saved_questions_and_stores_what_the_writer_wrote()
    {
        var role = await AddRole();
        await questions.Give(role, "Saved?");
        var form = ApplicationSetupForm.Initial with { RoleFocus = new AnsweredRole(role) };

        Assert.IsType<PrepareAccepted>(await Service().PrepareAsync(form, Make.Session(), default));

        Assert.Equal([role], questions.Purged);
        Assert.Equal([role], writer.Written);
        var current = await questions.ListAsync(role, default);
        Assert.Equal(["Why SWE?", "Tell me about a time."], current.Select(q => q.Text));
        Assert.Equal(QuestionSource.Generated, questions.Sets[questions.Active[role]].Source);
    }

    [Fact]
    public async Task Prepare_with_an_upload_makes_that_set_the_role_s_questions_when_it_belongs_to_the_role()
    {
        var role = await AddRole();
        var other = await roles.AddAsync(Make.Name("Other"), "jd", DateTimeOffset.UtcNow, DocumentSource.Upload, default);
        var mine = Assert.IsType<Succeeded<QuestionsProcessed>>(await Service().PasteQuestionsAsync(role, Make.Name(), "Mine?", default)).Value.SetId;
        var theirs = Assert.IsType<Succeeded<QuestionsProcessed>>(await Service().PasteQuestionsAsync(other, Make.Name(), "Theirs?", default)).Value.SetId;
        var form = ApplicationSetupForm.Initial with { RoleFocus = new AnsweredRole(role) };

        var wrongRole = Assert.IsType<PrepareRejected>(await Service().PrepareAsync(form with { Questions = new UploadedQuestions(theirs) }, Make.Session(), default));
        Assert.Contains(wrongRole.Problems, p => p.Contains("another role"));
        var unknown = Assert.IsType<PrepareRejected>(await Service().PrepareAsync(form with { Questions = new UploadedQuestions(Make.Set("ghost")) }, Make.Session(), default));
        Assert.Contains(unknown.Problems, p => p.Contains("not found"));

        Assert.IsType<PrepareAccepted>(await Service().PrepareAsync(form with { Questions = new UploadedQuestions(mine) }, Make.Session(), default));

        Assert.Equal(["Mine?"], (await questions.ListAsync(role, default)).Select(q => q.Text));
        Assert.Empty(writer.Written);
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
