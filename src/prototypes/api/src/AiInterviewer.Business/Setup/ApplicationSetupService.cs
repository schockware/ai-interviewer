// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Setup;

public abstract record PrepareResult
{
    private protected PrepareResult() { }
}

public sealed record PrepareAccepted : PrepareResult;

/// <summary>The server rejects the request if required fields are not ready. Each problem is a sentence.</summary>
public sealed record PrepareRejected(IReadOnlyList<string> Problems) : PrepareResult;

/// <summary>Page 1 of the flow (contracts/page-flow.md, "Application setup").</summary>
public sealed class ApplicationSetupService(
    IResumeStore resumes,
    IRoleStore roles,
    IDocumentReader reader,
    ISessionStore sessions,
    IInterviewPreparer preparer,
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

    public async Task<Outcome<ResumeProcessed>> UploadResumeAsync(DisplayName name, UploadedFile file, CancellationToken ct)
    {
        switch (await reader.ReadAsync(file, ct))
        {
            case Failed<string> failed:
                return Outcome.Failure<ResumeProcessed>(failed.Message);
            case Succeeded<string> read:
                var id = await resumes.AddAsync(name, read.Value, clock.GetUtcNow(), ct);
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

    /// <summary>
    /// Validates the form, records the session and starts building the interview. Accepting only
    /// means preparation began; the result arrives later as InterviewPrepared.
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

        switch (form.RoleFocus)
        {
            case UnansweredRole:
                problems.Add("Role focus is required.");
                break;
            case AnsweredRole answered when !await roles.ContainsAsync(answered.RoleId, ct):
                problems.Add($"Role \"{answered.RoleId}\" was not found.");
                break;
        }

        if (problems.Count > 0) return new PrepareRejected(problems);

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
        var id = await roles.AddAsync(name, text, clock.GetUtcNow(), ct);
        return new JobDescriptionProcessed(id, name);
    }

    private static LoadedDocuments<TId> Summarize<TId>(IReadOnlyList<StoredDocument<TId>> stored) =>
        stored.Count == 0
            ? new NoDocuments<TId>()
            : new ReadyDocuments<TId>(stored.Select(d => new DocumentSummary<TId>(d.Id, d.Name)).ToList());
}
