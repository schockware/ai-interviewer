// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Business.Media;

namespace AiInterviewer.Business.Tests;

internal sealed class RecordingSink : IMediaSink
{
    public MediaTrackOpened? Opened { get; private set; }
    public List<MediaChunk> Chunks { get; } = [];
    public bool Completed { get; private set; }
    /// <summary>When set, every write waits here first: a slow sink.</summary>
    public TaskCompletionSource? Gate { get; set; }

    public Task OpenAsync(MediaTrackOpened track, CancellationToken ct)
    {
        Opened = track;
        return Task.CompletedTask;
    }

    public async Task WriteAsync(MediaChunk chunk, CancellationToken ct)
    {
        if (Gate is not null) await Gate.Task;
        lock (Chunks) Chunks.Add(chunk);
    }

    public Task CompleteAsync(CancellationToken ct)
    {
        Completed = true;
        return Task.CompletedTask;
    }
}

internal sealed class OneSinkFactory(RecordingSink sink, Func<MediaTrack, bool> wants) : IMediaSinkFactory
{
    public bool Wants(MediaTrack track) => wants(track);
    public IMediaSink Create() => sink;
}

public class MediaIngestTests
{
    private static readonly SessionId S1 = ((Succeeded<SessionId>)SessionId.From("s1")).Value;

    [Fact]
    public async Task Every_sink_that_wants_the_track_gets_every_chunk_in_order_and_is_completed()
    {
        var file = new RecordingSink();
        var feed = new RecordingSink();
        var service = new MediaIngestService([new OneSinkFactory(file, _ => true), new OneSinkFactory(feed, t => t == MediaTrack.Audio)], TimeProvider.System);

        var ingest = await service.BeginAsync(S1, MediaTrack.Audio, "audio/webm", default);
        await ingest.WriteAsync(new byte[] { 1 }, default);
        await ingest.WriteAsync(new byte[] { 2 }, default);
        await ingest.WriteAsync(new byte[] { 3 }, default);
        await ingest.CompleteAsync(default);

        Assert.Equal(2, ingest.Sinks);
        Assert.Equal(3, ingest.Chunks);
        foreach (var sink in new[] { file, feed })
        {
            Assert.Equal("audio/webm", sink.Opened?.MimeType);
            Assert.Equal([1, 2, 3], sink.Chunks.Select(c => c.Sequence));
            Assert.Equal([1, 2, 3], sink.Chunks.Select(c => c.Bytes.Span[0]));
            Assert.True(sink.Completed);
        }
    }

    [Fact]
    public async Task A_sink_that_does_not_want_the_track_is_left_out()
    {
        var feed = new RecordingSink();
        var service = new MediaIngestService([new OneSinkFactory(feed, t => t == MediaTrack.Audio)], TimeProvider.System);

        var ingest = await service.BeginAsync(S1, MediaTrack.Composite, "video/webm", default);
        await ingest.WriteAsync(new byte[] { 1 }, default);
        await ingest.CompleteAsync(default);

        Assert.Equal(0, ingest.Sinks);
        Assert.Null(feed.Opened);
    }

    [Fact]
    public async Task The_chunk_is_copied_so_the_producer_may_reuse_its_buffer()
    {
        var sink = new RecordingSink();
        var ingest = await new MediaIngestService([new OneSinkFactory(sink, _ => true)], TimeProvider.System).BeginAsync(S1, MediaTrack.Audio, "audio/webm", default);
        var buffer = new byte[] { 7 };
        await ingest.WriteAsync(buffer, default);
        buffer[0] = 8;
        await ingest.CompleteAsync(default);

        Assert.Equal(7, sink.Chunks.Single().Bytes.Span[0]);
    }

    [Fact]
    public async Task A_slow_sink_holds_the_producer_once_its_channel_is_full_instead_of_dropping_chunks()
    {
        var slow = new RecordingSink { Gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously) };
        var ingest = await new MediaIngestService([new OneSinkFactory(slow, _ => true)], TimeProvider.System).BeginAsync(S1, MediaTrack.Audio, "audio/webm", default, capacity: 1);

        await ingest.WriteAsync(new byte[] { 1 }, default); // taken by the reader, which now waits at the gate
        await Task.Delay(50);
        await ingest.WriteAsync(new byte[] { 2 }, default); // fills the channel
        var third = ingest.WriteAsync(new byte[] { 3 }, default).AsTask();
        await Task.Delay(100);
        Assert.False(third.IsCompleted);

        slow.Gate.SetResult();
        await third.WaitAsync(TimeSpan.FromSeconds(5));
        await ingest.CompleteAsync(default);

        Assert.Equal([1, 2, 3], slow.Chunks.Select(c => c.Bytes.Span[0]));
    }
}
