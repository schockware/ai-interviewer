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

/// <summary>
/// Stands in for the AI writing a role's questions: five templates with the role's title in them,
/// shaped like the sample bank's core questions (motivation, experience, behavioral, scenario,
/// growth). The interviewer model will write them from the description instead.
/// </summary>
public sealed class TemplateQuestionWriter : IQuestionWriter
{
    public Task<IReadOnlyList<string>> WriteAsync(StoredDocument<RoleId> role, CancellationToken ct)
    {
        var title = role.Name.Value;
        return Task.FromResult<IReadOnlyList<string>>(
        [
            $"What draws you to working as a {title}?",
            $"Tell me about a time your work as a {title}, or on the way to becoming one, went especially well.",
            "Tell me about a time you had to learn something new quickly, at work, at school, or anywhere else.",
            "Suppose you are given more work than you can finish in a day. What would you do?",
            $"Which part of the {title} role do you know least, and how would you get up to speed on it?",
        ]);
    }
}

public sealed class CannedPreparationDiagnoser : IPreparationDiagnoser
{
    public Task<string> DiagnoseAsync(InterviewSession session, CancellationToken ct) =>
        Task.FromResult($"No models are connected to diagnose preparation. Check log {session.LogId}.");
}
