// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Media;

// What the two transcription passes say (specs/transcription; contracts/ai/transcription.proto).

/// <summary>Which pass produced a piece: the live one while the user speaks, or the large model over the finished file.</summary>
public enum TranscriptSource { RealTime, PostQuestion }

/// <summary>
/// One piece of transcript. A partial covers audio still being spoken and may be replaced; a final
/// names, in <see cref="Replaces"/>, the partials it supersedes (STT-STR-002). Times are seconds
/// from the start of the question's audio.
/// </summary>
public sealed record TranscriptSegment(
    SessionId Session,
    QuestionId Question,
    string Id,
    double StartSeconds,
    double EndSeconds,
    string Text,
    bool Final,
    IReadOnlyList<string> Replaces,
    TranscriptSource Source,
    string Model,
    string Device);

/// <summary>A pass that could not run or broke off: the user is told, nothing is guessed.</summary>
public sealed record TranscriptFailure(SessionId Session, QuestionId Question, TranscriptSource Source, string Message);
