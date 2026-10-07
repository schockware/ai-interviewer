// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters;

// Stand-ins for the AI layers. No model runs here. They exist so the page flow works end to
// end until the Python workers (gRPC) and LLM runtimes are connected.

/// <summary>
/// Reads plain-text uploads only (.txt and .md). PDF and Word parsing is not built, so other
/// extensions are refused with a clear message instead of being guessed at.
/// </summary>
public sealed class PlainTextDocumentReader : IDocumentReader
{
    private static readonly string[] Supported = [".txt", ".md"];

    public Task<Outcome<string>> ReadAsync(UploadedFile file, CancellationToken ct)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!Supported.Contains(extension))
            return Task.FromResult(Outcome.Failure<string>(
                $"\"{file.FileName}\" cannot be read yet. Supported: {string.Join(", ", Supported)}."));

        var text = Encoding.UTF8.GetString(file.Payload.Span);
        return Task.FromResult(string.IsNullOrWhiteSpace(text)
            ? Outcome.Failure<string>($"\"{file.FileName}\" is empty.")
            : Outcome.Success(text));
    }
}

/// <summary>Marks every session prepared at once. The real preparer builds the interview with the LLM.</summary>
public sealed class InstantInterviewPreparer(ISessionStore sessions) : IInterviewPreparer
{
    public Task BeginAsync(InterviewSession session, CancellationToken ct) =>
        sessions.SaveAsync(session with { Status = PreparationStatus.Ok }, ct);
}

public sealed class CannedPreparationDiagnoser : IPreparationDiagnoser
{
    public Task<string> DiagnoseAsync(InterviewSession session, CancellationToken ct) =>
        Task.FromResult($"No models are connected to diagnose preparation. Check log {session.LogId}.");
}
