// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Setup;

public abstract record PrepareResult
{
    private protected PrepareResult() { }
}

public sealed record PrepareAccepted : PrepareResult;

/// <summary>The server rejects the request if required fields are not ready. Each problem is a sentence.</summary>
public sealed record PrepareRejected(IReadOnlyList<string> Problems) : PrepareResult;

/// <summary>Pages 1 and 2 of the flow (contracts/page-flow.md, "Application setup"; specs/page-flow.md, "Role set up").</summary>
public sealed class ApplicationSetupService(
    IResumeStore resumes,
    IRoleStore roles,
    IQuestionStore questions,
    IQuestionWriter writer,
    IDocumentReader reader,
    ISessionStore sessions,
    IInterviewPreparer preparer,
    IResumeUploader uploader,
    TimeProvider clock)
{
    public async Task<ApplicationSetupPage> LoadPageAsync(CancellationToken ct)
    {
        try
        {
            var resumeList = await resumes.ListAsync(ct);
            var roleList = await roles.ListAsync(ct);
            return new ReadyPage(ApplicationSetupForm.Initial, Summarize(resumeList), Summarize(roleList));
        }
        catch (PortUnavailableException unavailable)
        {
            return new ErrorPage(unavailable.Message);
        }
    }

    /// <summary>Stores the resume and starts processing it with the uploader's default options.</summary>
    public Task<Outcome<ResumeProcessed>> UploadResumeAsync(DisplayName name, UploadedFile file, CancellationToken ct) =>
        UploadResumeAsync(name, file, (id, ct2) => uploader.BeginAsync(id, name, ct2), ct);

    /// <summary>The same, with explicit uploader options for this upload only (test mode).</summary>
    public Task<Outcome<ResumeProcessed>> UploadResumeAsync(DisplayName name, UploadedFile file, ResumeUploaderOptions options, CancellationToken ct) =>
        UploadResumeAsync(name, file, (id, ct2) => uploader.BeginAsync(id, name, options, ct2), ct);

    private async Task<Outcome<ResumeProcessed>> UploadResumeAsync(DisplayName name, UploadedFile file, Func<ResumeId, CancellationToken, Task> begin, CancellationToken ct)
    {
        switch (await reader.ReadAsync(file, ct))
        {
            case Failed<string> failed:
                return Outcome.Failure<ResumeProcessed>(failed.Message);
            case Succeeded<string> read:
                var id = await resumes.AddAsync(name, read.Value, clock.GetUtcNow(), DocumentSource.Upload, ct);
                // Stored first, so the id the client gets back is one the uploader is already reporting on.
                await begin(id, ct);
                return Outcome.Success(new ResumeProcessed(id, name));
            default:
                throw new InvalidOperationException();
        }
    }

    public async Task<Outcome<JobDescriptionProcessed>> UploadJobDescriptionAsync(DisplayName name, UploadedFile file, CancellationToken ct)
    {
        switch (await reader.ReadAsync(file, ct))
        {
            case Failed<string> failed:
                return Outcome.Failure<JobDescriptionProcessed>(failed.Message);
            case Succeeded<string> read:
                return Outcome.Success(await StoreRoleAsync(name, read.Value, ct));
            default:
                throw new InvalidOperationException();
        }
    }

    public async Task<Outcome<JobDescriptionProcessed>> PasteJobDescriptionAsync(DisplayName name, string text, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(text))
            return Outcome.Failure<JobDescriptionProcessed>("The pasted job description is empty.");
        return Outcome.Success(await StoreRoleAsync(name, text, ct));
    }

    /// <summary>The role's description and saved questions, for the Role set up page once a role is chosen.</summary>
    public async Task<Outcome<RoleDetail>> LoadRoleAsync(RoleId id, CancellationToken ct)
    {
        if (await roles.FindAsync(id, ct) is not Succeeded<StoredDocument<RoleId>> role)
            return Outcome.Failure<RoleDetail>($"Role \"{id}\" was not found.");
        return Outcome.Success(new RoleDetail(role.Value.Id, role.Value.Name, role.Value.Text, await questions.ListAsync(id, ct)));
    }

    /// <summary>Reads the questions out of the file and stores them for the role. They become its questions at Prepare interview.</summary>
    public async Task<Outcome<QuestionsProcessed>> UploadQuestionsAsync(RoleId role, DisplayName name, UploadedFile file, CancellationToken ct)
    {
        switch (await reader.ReadAsync(file, ct))
        {
            case Failed<string> failed:
                return Outcome.Failure<QuestionsProcessed>(failed.Message);
            case Succeeded<string> read:
                return await StoreQuestionsAsync(role, name, read.Value, ct);
            default:
                throw new InvalidOperationException();
        }
    }

    public Task<Outcome<QuestionsProcessed>> PasteQuestionsAsync(RoleId role, DisplayName name, string text, CancellationToken ct) =>
        StoreQuestionsAsync(role, name, text, ct);

    private async Task<Outcome<QuestionsProcessed>> StoreQuestionsAsync(RoleId role, DisplayName name, string text, CancellationToken ct)
    {
        if (!await roles.ContainsAsync(role, ct))
            return Outcome.Failure<QuestionsProcessed>($"Role \"{role}\" was not found.");
        switch (QuestionText.Parse(text))
        {
            case Failed<IReadOnlyList<string>> bad:
                return Outcome.Failure<QuestionsProcessed>(bad.Message);
            case Succeeded<IReadOnlyList<string>> parsed:
                var set = await questions.AddSetAsync(role, QuestionSource.Uploaded, parsed.Value, clock.GetUtcNow(), ct);
                return Outcome.Success(new QuestionsProcessed(set, name, parsed.Value.Count));
            default:
                throw new InvalidOperationException();
        }
    }

    /// <summary>
    /// Validates the form, settles the role's questions as the plan says, records the session and
    /// starts building the interview. Accepting only means preparation began; the result arrives
    /// later as InterviewPrepared. PROPOSAL: the AI writes generated questions here, synchronously,
    /// because the writer is a stub; a real model would write them in the preparer's "Writing the
    /// questions" step.
    /// </summary>
    public async Task<PrepareResult> PrepareAsync(ApplicationSetupForm form, SessionId sessionId, CancellationToken ct)
    {
        var problems = new List<string>(SlotCatalog.Validate(form.Ai));

        switch (form.InterviewType)
        {
            case HotInterview hot when !await resumes.ContainsAsync(hot.ResumeId, ct):
                problems.Add($"Resume \"{hot.ResumeId}\" was not found.");
                break;
        }

        StoredDocument<RoleId>? role = null;
        switch (form.RoleFocus)
        {
            case UnansweredRole:
                problems.Add("Role focus is required.");
                break;
            case AnsweredRole answered:
                if (await roles.FindAsync(answered.RoleId, ct) is Succeeded<StoredDocument<RoleId>> found) role = found.Value;
                else problems.Add($"Role \"{answered.RoleId}\" was not found.");
                break;
        }

        QuestionSet? uploaded = null;
        if (role is not null)
        {
            switch (form.Questions)
            {
                case KeepQuestions when (await questions.ListAsync(role.Id, ct)).Count == 0:
                    problems.Add($"Role \"{role.Name}\" has no saved questions to keep.");
                    break;
                case UploadedQuestions upload:
                    if (await questions.FindSetAsync(upload.SetId, ct) is not Succeeded<QuestionSet> set)
                        problems.Add($"Questions \"{upload.SetId}\" were not found.");
                    else if (set.Value.Role != role.Id)
                        problems.Add($"Questions \"{upload.SetId}\" belong to another role.");
                    else uploaded = set.Value;
                    break;
            }
        }

        if (problems.Count > 0) return new PrepareRejected(problems);

        // The questions are settled before the session exists, so the preparer finds them in place.
        switch (form.Questions)
        {
            case UploadedQuestions when uploaded is not null:
                await questions.ActivateAsync(uploaded.Id, ct);
                break;
            case GenerateQuestions when role is not null:
                await questions.PurgeAsync(role.Id, ct);
                var written = await writer.WriteAsync(role, ct);
                await questions.ActivateAsync(await questions.AddSetAsync(role.Id, QuestionSource.Generated, written, clock.GetUtcNow(), ct), ct);
                break;
        }

        // A hot interview whose resume never validated falls back to cold, so the preparer
        // only ever sees the interview it will actually build.
        var effective = form.InterviewType is HotIncompleteToCold ? form with { InterviewType = new ColdInterview() } : form;

        var session = new InterviewSession(sessionId, effective, PreparationStatus.Preparing, LogId.Generate());
        await sessions.SaveAsync(session, ct);
        await preparer.BeginAsync(session, ct);
        return new PrepareAccepted();
    }

    private async Task<JobDescriptionProcessed> StoreRoleAsync(DisplayName name, string text, CancellationToken ct)
    {
        var id = await roles.AddAsync(name, text, clock.GetUtcNow(), DocumentSource.Upload, ct);
        return new JobDescriptionProcessed(id, name);
    }

    private static LoadedDocuments<TId> Summarize<TId>(IReadOnlyList<StoredDocument<TId>> stored) =>
        stored.Count == 0
            ? new NoDocuments<TId>()
            : new ReadyDocuments<TId>(stored.Select(d => new DocumentSummary<TId>(d.Id, d.Name)).ToList());
}
