// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Business.Hardware;

namespace AiInterviewer.Business.Interview;

public abstract record StartResult
{
    private protected StartResult() { }
}

public sealed record InterviewStarted(CueSettings Settings) : StartResult;

public sealed record StartUnknownSession : StartResult;

public sealed record StartNotReady(string Reason) : StartResult;

public abstract record DiagnosisResult
{
    private protected DiagnosisResult() { }
}

public sealed record Diagnosed(string Message) : DiagnosisResult;

public sealed record DiagnosisUnknownSession : DiagnosisResult;

/// <summary>Preparation did not fail, so there is nothing to diagnose.</summary>
public sealed record NothingToDiagnose : DiagnosisResult;

/// <summary>Pages 2 and 3 of the flow: hardware verification, starting, and diagnosing a failed preparation.</summary>
public sealed class InterviewService(ISessionStore sessions, IPreparationDiagnoser diagnoser)
{
    public async Task<StartResult> StartAsync(HardwareSetupForm form, SessionId sessionId, CancellationToken ct)
    {
        if (await sessions.FindAsync(sessionId, ct) is not Succeeded<InterviewSession> found)
            return new StartUnknownSession();

        if (found.Value.Status != PreparationStatus.Ok)
            return new StartNotReady($"The interview is {found.Value.Status.ToString().ToLowerInvariant()}, not prepared.");

        return form.Readiness() switch
        {
            NotReady notReady => new StartNotReady(notReady.Reason),
            _ => new InterviewStarted(CueSettings.CleanCallProposal),
        };
    }

    public async Task<DiagnosisResult> CheckErroredAsync(SessionId sessionId, LogId logId, CancellationToken ct)
    {
        // A log id that does not belong to the session is treated as an unknown session.
        if (await sessions.FindAsync(sessionId, ct) is not Succeeded<InterviewSession> found || found.Value.LogId != logId)
            return new DiagnosisUnknownSession();

        if (found.Value.Status != PreparationStatus.Error)
            return new NothingToDiagnose();

        return new Diagnosed(await diagnoser.DiagnoseAsync(found.Value, ct));
    }
}
