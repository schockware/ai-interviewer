// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Runtime.CompilerServices;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;
using AiInterviewer.Contracts.Transcription;
using Grpc.Core;
using Grpc.Net.Client;

namespace AiInterviewer.Adapters.Transcription;

/// <summary>
/// The real-time transcription consumer: the audio track's chunks go to the Python worker over
/// one bidirectional gRPC call per question (contracts/ai/transcription.proto), and every piece
/// of transcript that comes back goes to the transcript sinks. A worker that is down, or that
/// breaks off, is reported as a failure and the stream of chunks goes on to the other sinks: the
/// file is never held hostage to the transcriber.
/// </summary>
public sealed class GrpcRealTimeTranscriptionFeed(GrpcChannel channel, IEnumerable<ITranscriptSink> sinks) : IMediaSinkFactory
{
    public bool Wants(MediaTrack track) => track == MediaTrack.Audio;

    public IMediaSink Create() => new Sink(new RealTimeTranscriber.RealTimeTranscriberClient(channel), sinks.ToList());

    private sealed class Sink(RealTimeTranscriber.RealTimeTranscriberClient client, IReadOnlyList<ITranscriptSink> sinks) : IMediaSink
    {
        private AsyncDuplexStreamingCall<AudioChunk, Contracts.Transcription.TranscriptSegment>? call;
        private Task reading = Task.CompletedTask;
        private MediaTrackOpened? track;
        private bool failed;

        public Task OpenAsync(MediaTrackOpened opened, CancellationToken ct)
        {
            track = opened;
            call = client.Transcribe(cancellationToken: CancellationToken.None);
            reading = ReadAsync(call, opened);
            return Task.CompletedTask;
        }

        public async Task WriteAsync(MediaChunk chunk, CancellationToken ct)
        {
            if (failed || call is null) return;
            try
            {
                await call.RequestStream.WriteAsync(new AudioChunk
                {
                    SessionId = chunk.Session.Value,
                    QuestionId = chunk.Question.Value,
                    MimeType = track!.MimeType,
                    Sequence = chunk.Sequence,
                    Data = Google.Protobuf.ByteString.CopyFrom(chunk.Bytes.Span),
                }, ct);
            }
            catch (Exception e) when (e is RpcException or InvalidOperationException or IOException)
            {
                await Fail($"The transcriber stopped taking audio: {Describe(e)}");
            }
        }

        public async Task CompleteAsync(CancellationToken ct)
        {
            if (call is null) return;
            if (!failed)
            {
                try
                {
                    await call.RequestStream.CompleteAsync();
                }
                catch (Exception e) when (e is RpcException or InvalidOperationException or IOException)
                {
                    await Fail($"The transcriber could not be told the audio ended: {Describe(e)}");
                }
            }
            await reading;
            call.Dispose();
        }

        private async Task ReadAsync(AsyncDuplexStreamingCall<AudioChunk, Contracts.Transcription.TranscriptSegment> open, MediaTrackOpened opened)
        {
            try
            {
                await foreach (var message in open.ResponseStream.ReadAllAsync())
                    foreach (var sink in sinks)
                        await sink.ReportAsync(GrpcTranscripts.ToBusiness(message, opened, TranscriptSource.RealTime), CancellationToken.None);
            }
            catch (RpcException e)
            {
                await Fail(e.StatusCode == StatusCode.Unavailable
                    ? $"The transcriber is not running at the configured address ({e.Status.Detail})."
                    : $"The transcriber broke off: {e.Status.Detail}");
            }
        }

        private async Task Fail(string message)
        {
            if (failed || track is null) return;
            failed = true;
            var failure = new TranscriptFailure(track.Session, track.Question, TranscriptSource.RealTime, message);
            foreach (var sink in sinks) await sink.FailedAsync(failure, CancellationToken.None);
        }

        private static string Describe(Exception e) => e is RpcException rpc ? $"{rpc.StatusCode}: {rpc.Status.Detail}" : e.Message;
    }
}

/// <summary>The post-question pass over the worker's TranscribeFile: the large model reads the finished file, which both processes can see.</summary>
public sealed class GrpcPostQuestionTranscriber(GrpcChannel channel) : IPostQuestionTranscriber
{
    public async IAsyncEnumerable<Business.Media.TranscriptSegment> TranscribeAsync(MediaTrackOpened track, string audioPath, [EnumeratorCancellation] CancellationToken ct)
    {
        var client = new PostQuestionTranscriber.PostQuestionTranscriberClient(channel);
        using var call = client.TranscribeFile(new TranscribeFileRequest { SessionId = track.Session.Value, QuestionId = track.Question.Value, Path = audioPath }, cancellationToken: ct);
        IAsyncEnumerator<Contracts.Transcription.TranscriptSegment> messages;
        try
        {
            messages = call.ResponseStream.ReadAllAsync(ct).GetAsyncEnumerator(ct);
        }
        catch (RpcException e)
        {
            throw new InvalidOperationException(Explain(e), e);
        }
        while (true)
        {
            bool more;
            try
            {
                more = await messages.MoveNextAsync();
            }
            catch (RpcException e)
            {
                throw new InvalidOperationException(Explain(e), e);
            }
            if (!more) yield break;
            yield return GrpcTranscripts.ToBusiness(messages.Current, track, TranscriptSource.PostQuestion);
        }
    }

    private static string Explain(RpcException e) => e.StatusCode == StatusCode.Unavailable
        ? $"The transcriber is not running at the configured address ({e.Status.Detail})."
        : $"The post-question transcriber failed: {e.Status.Detail}";
}

internal static class GrpcTranscripts
{
    public static Business.Media.TranscriptSegment ToBusiness(Contracts.Transcription.TranscriptSegment m, MediaTrackOpened track, TranscriptSource source) =>
        new(track.Session, track.Question, m.Id, m.StartSeconds, m.EndSeconds, m.Text, m.Final, m.Replaces.ToList(), source, m.Model, m.Device);
}
