// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Media;

/// <summary>
/// The post-question pass: once a question's audio file is complete, the large model reads the
/// whole of it and every piece goes to the transcript sinks. A failure goes to the sinks too, as
/// a failure, and never back to whoever started the pass: the interview goes on either way.
/// </summary>
public sealed class PostQuestionService(IPostQuestionTranscriber transcriber, IEnumerable<ITranscriptSink> sinks)
{
    public async Task RunAsync(MediaTrackOpened track, string audioPath, CancellationToken ct)
    {
        try
        {
            await foreach (var segment in transcriber.TranscribeAsync(track, audioPath, ct))
                foreach (var sink in sinks)
                    await sink.ReportAsync(segment, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            var failure = new TranscriptFailure(track.Session, track.Question, TranscriptSource.PostQuestion, e.Message);
            foreach (var sink in sinks) await sink.FailedAsync(failure, ct);
        }
    }
}
