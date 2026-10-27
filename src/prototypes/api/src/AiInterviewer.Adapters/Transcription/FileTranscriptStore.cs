// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;

namespace AiInterviewer.Adapters.Transcription;

/// <summary>
/// Keeps both passes beside the question's audio, one JSON line per piece:
/// <c>{root}/{session}/{question}/transcript-{real-time|post-question}.jsonl</c>. The accuracy
/// comparison between the passes (TASKS.MD) reads these. Appended as pieces arrive, so a crash
/// keeps what was said so far.
/// </summary>
public sealed class FileTranscriptStore(string root) : ITranscriptSink
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly SemaphoreSlim gate = new(1, 1);

    public static string PathFor(string root, SessionId session, QuestionId question, TranscriptSource source) =>
        Path.Combine(Path.GetFullPath(root), session.Value, question.Value, $"transcript-{Name(source)}.jsonl");

    public Task ReportAsync(TranscriptSegment segment, CancellationToken ct) =>
        AppendAsync(PathFor(root, segment.Session, segment.Question, segment.Source), new
        {
            kind = "segment",
            segment.Id,
            start = segment.StartSeconds,
            end = segment.EndSeconds,
            segment.Text,
            segment.Final,
            segment.Replaces,
            segment.Model,
            segment.Device,
        }, ct);

    public Task FailedAsync(TranscriptFailure failure, CancellationToken ct) =>
        AppendAsync(PathFor(root, failure.Session, failure.Question, failure.Source), new { kind = "failure", failure.Message }, ct);

    private async Task AppendAsync(string path, object line, CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.AppendAllTextAsync(path, JsonSerializer.Serialize(line, Json) + Environment.NewLine, ct);
        }
        finally
        {
            gate.Release();
        }
    }

    private static string Name(TranscriptSource source) => source == TranscriptSource.RealTime ? "real-time" : "post-question";
}

/// <summary>When no transcriber is configured (Transcription:Provider=Counting), the post-question pass says so instead of pretending.</summary>
public sealed class NoPostQuestionTranscriber : IPostQuestionTranscriber
{
    public IAsyncEnumerable<TranscriptSegment> TranscribeAsync(MediaTrackOpened track, string audioPath, CancellationToken ct) =>
        throw new InvalidOperationException("No post-question transcriber is configured (Transcription:Provider).");
}
