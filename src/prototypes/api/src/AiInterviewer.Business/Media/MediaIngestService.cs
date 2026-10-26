// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Threading.Channels;

namespace AiInterviewer.Business.Media;

/// <summary>
/// Takes one track's chunks in and fans them out to every sink that wants the track: today the
/// file store (audio, and the composite) and the transcription feed (audio only). Each sink reads
/// from its own bounded channel, so a slow sink slows the producer instead of losing chunks, and
/// the backpressure reaches the WebSocket (decision 0003, open item 1). Chunks reach every sink in
/// order. Nothing here knows about sockets, files or Python.
/// </summary>
public sealed class MediaIngestService(IEnumerable<IMediaSinkFactory> factories, TimeProvider clock)
{
    /// <summary>Chunks a sink may fall behind by before the producer waits. At 250 ms a chunk, eight seconds. PROPOSAL.</summary>
    public const int DefaultCapacity = 32;

    public async Task<MediaIngest> BeginAsync(SessionId session, MediaTrack track, string mimeType, CancellationToken ct, int capacity = DefaultCapacity)
    {
        var opened = new MediaTrackOpened(session, track, mimeType, clock.GetUtcNow());
        var lanes = new List<MediaIngest.Lane>();
        foreach (var factory in factories.Where(f => f.Wants(track)))
        {
            var sink = factory.Create();
            await sink.OpenAsync(opened, ct);
            lanes.Add(MediaIngest.Lane.Start(sink, capacity));
        }
        return new MediaIngest(opened, lanes, clock);
    }
}

/// <summary>One open track stream. Write chunks as they arrive; Complete once the browser closes it.</summary>
public sealed class MediaIngest
{
    internal sealed class Lane
    {
        private Lane(Channel<MediaChunk> channel, Task reading)
        {
            Channel = channel;
            Reading = reading;
        }

        public Channel<MediaChunk> Channel { get; }
        public Task Reading { get; }

        public static Lane Start(IMediaSink sink, int capacity)
        {
            var channel = System.Threading.Channels.Channel.CreateBounded<MediaChunk>(new BoundedChannelOptions(capacity)
            {
                SingleReader = true,
                SingleWriter = true,
                FullMode = BoundedChannelFullMode.Wait,
            });
            var reading = Task.Run(async () =>
            {
                await foreach (var chunk in channel.Reader.ReadAllAsync())
                    await sink.WriteAsync(chunk, CancellationToken.None);
                await sink.CompleteAsync(CancellationToken.None);
            });
            return new Lane(channel, reading);
        }
    }

    private readonly IReadOnlyList<Lane> lanes;
    private readonly TimeProvider clock;
    private long sequence;

    internal MediaIngest(MediaTrackOpened track, IReadOnlyList<Lane> lanes, TimeProvider clock)
    {
        Track = track;
        this.lanes = lanes;
        this.clock = clock;
    }

    public MediaTrackOpened Track { get; }

    public int Sinks => lanes.Count;

    public long Chunks => Interlocked.Read(ref sequence);

    /// <summary>Hands a chunk to every sink. Waits while any sink's channel is full. The bytes are copied, so the caller may reuse its buffer.</summary>
    public async ValueTask WriteAsync(ReadOnlyMemory<byte> bytes, CancellationToken ct)
    {
        var chunk = new MediaChunk(Track.Session, Track.Track, Interlocked.Increment(ref sequence), bytes.ToArray(), clock.GetUtcNow());
        foreach (var lane in lanes) await lane.Channel.Writer.WriteAsync(chunk, ct);
    }

    /// <summary>The stream ended normally: every sink drains what it has and completes.</summary>
    public async Task CompleteAsync(CancellationToken ct)
    {
        foreach (var lane in lanes) lane.Channel.Writer.TryComplete();
        await Task.WhenAll(lanes.Select(l => l.Reading)).WaitAsync(ct);
    }

    /// <summary>The stream broke: sinks complete with what they have; a sink's own failure is not rethrown.</summary>
    public async Task AbortAsync()
    {
        foreach (var lane in lanes) lane.Channel.Writer.TryComplete();
        try
        {
            await Task.WhenAll(lanes.Select(l => l.Reading));
        }
        catch (Exception)
        {
            // Reported by the caller as the stream's failure; the sinks' own errors are secondary.
        }
    }
}
