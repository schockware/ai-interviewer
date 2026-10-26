// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Collections.Concurrent;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;

namespace AiInterviewer.Adapters.Media;

/// <summary>What the stand-in has seen of one session's audio.</summary>
public sealed record TranscriptionFeedTally(long Chunks, long Bytes, bool Completed);

/// <summary>Where the stand-in keeps its tallies, so a test or a page can see the feed is being fed.</summary>
public sealed class TranscriptionFeedLedger
{
    private readonly ConcurrentDictionary<string, TranscriptionFeedTally> tallies = new();

    public TranscriptionFeedTally For(SessionId session) => tallies.TryGetValue(session.Value, out var t) ? t : new TranscriptionFeedTally(0, 0, false);

    internal void Add(SessionId session, long bytes) =>
        tallies.AddOrUpdate(session.Value, _ => new TranscriptionFeedTally(1, bytes, false), (_, t) => t with { Chunks = t.Chunks + 1, Bytes = t.Bytes + bytes });

    internal void Complete(SessionId session) =>
        tallies.AddOrUpdate(session.Value, _ => new TranscriptionFeedTally(0, 0, true), (_, t) => t with { Completed = true });
}

/// <summary>
/// Stands in for the real-time transcription service (the Python worker, decision 0003) until it
/// exists: it takes the audio track from the ingest's channel and counts it. Nothing is
/// transcribed. The real adapter will forward the same chunks over gRPC and raise transcript
/// segments for the first-pass summary (TASKS.MD).
/// </summary>
public sealed class CountingTranscriptionFeed(TranscriptionFeedLedger ledger) : IMediaSinkFactory
{
    public bool Wants(MediaTrack track) => track == MediaTrack.Audio;

    public IMediaSink Create() => new Sink(ledger);

    private sealed class Sink(TranscriptionFeedLedger ledger) : IMediaSink
    {
        private SessionId? session;

        public Task OpenAsync(MediaTrackOpened track, CancellationToken ct)
        {
            session = track.Session;
            return Task.CompletedTask;
        }

        public Task WriteAsync(MediaChunk chunk, CancellationToken ct)
        {
            ledger.Add(chunk.Session, chunk.Bytes.Length);
            return Task.CompletedTask;
        }

        public Task CompleteAsync(CancellationToken ct)
        {
            if (session is not null) ledger.Complete(session);
            return Task.CompletedTask;
        }
    }
}
