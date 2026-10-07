// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Api.Wire;
using AiInterviewer.Business;
using AiInterviewer.Business.Interview;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Api;

/// <summary>
/// Tier 1 (presentation): routes, status codes and wire mapping only. All decisions are made by
/// the business services. Paths follow the OpenAPI draft in contracts/page-flow.md; the status
/// codes and the Error shape are that draft's proposals.
/// </summary>
public static class Endpoints
{
    public static void MapPageFlow(this IEndpointRouteBuilder app)
    {
        app.MapGet("/application-setup", async (ApplicationSetupService setup, CancellationToken ct) =>
            TypedResults.Ok((await setup.LoadPageAsync(ct)).ToDto()));

        app.MapPost("/resumes", async (UploadResumeRequest request, ApplicationSetupService setup, CancellationToken ct) =>
            await Upload(request.DisplayName, request.FileName, request.Payload, setup.UploadResumeAsync,
                r => new ResumeProcessedDto(r.ResumeId.Value, r.DisplayName.Value), ct));

        app.MapPost("/job-descriptions/uploads", async (JobDescriptionUploadRequest request, ApplicationSetupService setup, CancellationToken ct) =>
            await Upload(request.DisplayName, request.FileName, request.Payload, setup.UploadJobDescriptionAsync,
                r => new JobDescriptionProcessedDto(r.RoleId.Value, r.DisplayName.Value), ct));

        app.MapPost("/job-descriptions/pastes", async (JobDescriptionPasteRequest request, ApplicationSetupService setup, CancellationToken ct) =>
        {
            if (DisplayName.From(request.DisplayName) is not Succeeded<DisplayName> name)
                return Failure(400, "displayName must not be empty.");
            return await setup.PasteJobDescriptionAsync(name.Value, request.Text, ct) switch
            {
                Succeeded<JobDescriptionProcessed> ok => Results.Ok(new JobDescriptionProcessedDto(ok.Value.RoleId.Value, ok.Value.DisplayName.Value)),
                Failed<JobDescriptionProcessed> bad => Failure(422, bad.Message),
                _ => throw new InvalidOperationException(),
            };
        });

        app.MapPost("/interviews/prepare", async (PrepareInterviewRequest request, ApplicationSetupService setup, CancellationToken ct) =>
        {
            var parsed = request.Form.ToBusiness().Then(form => SessionId.From(request.SessionId).Select(id => (form, id)));
            if (parsed is not Succeeded<(ApplicationSetupForm form, SessionId id)> ok)
                return Failure(400, ((Failed<(ApplicationSetupForm, SessionId)>)parsed).Message);

            return await setup.PrepareAsync(ok.Value.form, ok.Value.id, ct) switch
            {
                PrepareAccepted => Results.Accepted(),
                PrepareRejected rejected => Failure(422, string.Join(" ", rejected.Problems)),
                _ => throw new InvalidOperationException(),
            };
        });

        app.MapPost("/interviews/error-checks", async (CheckErroredInterviewRequest request, InterviewService interviews, CancellationToken ct) =>
        {
            var parsed = SessionId.From(request.SessionId).Then(s => LogId.From(request.LogId).Select(l => (s, l)));
            if (parsed is not Succeeded<(SessionId s, LogId l)> ok)
                return Failure(400, ((Failed<(SessionId, LogId)>)parsed).Message);

            return await interviews.CheckErroredAsync(ok.Value.s, ok.Value.l, ct) switch
            {
                Diagnosed diagnosed => Results.Ok(new ErrorDto(diagnosed.Message)),
                DiagnosisUnknownSession => Failure(404, "No interview matches that session and log."),
                NothingToDiagnose => Failure(409, "Preparation did not fail, so there is nothing to diagnose."),
                _ => throw new InvalidOperationException(),
            };
        });

        app.MapPost("/interviews/start", async (StartInterviewRequest request, InterviewService interviews, CancellationToken ct) =>
        {
            if (SessionId.From(request.SessionId) is not Succeeded<SessionId> id)
                return Failure(400, "sessionId must not be empty.");

            return await interviews.StartAsync(request.Form.ToBusiness(), id.Value, ct) switch
            {
                InterviewStarted started => Results.Ok(started.Settings.ToDto()),
                StartUnknownSession => Failure(404, "No interview was prepared for that session."),
                StartNotReady notReady => Failure(409, notReady.Reason),
                _ => throw new InvalidOperationException(),
            };
        });
    }

    private static IResult Failure(int status, string message) => Results.Json(new ErrorDto(message), statusCode: status);

    private static async Task<IResult> Upload<TResult>(
        string displayName,
        string fileName,
        byte[] payload,
        Func<DisplayName, UploadedFile, CancellationToken, Task<Outcome<TResult>>> process,
        Func<TResult, object> toDto,
        CancellationToken ct)
    {
        if (DisplayName.From(displayName) is not Succeeded<DisplayName> name)
            return Failure(400, "displayName must not be empty.");
        return await process(name.Value, new UploadedFile(fileName, payload), ct) switch
        {
            Succeeded<TResult> ok => Results.Ok(toDto(ok.Value)),
            Failed<TResult> bad => Failure(422, bad.Message),
            _ => throw new InvalidOperationException(),
        };
    }
}
