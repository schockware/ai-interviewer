// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Business;
using AiInterviewer.Business.Media;

namespace AiInterviewer.Adapters.Media;

/// <summary>
/// Writes every track to a file as it arrives: <c>{root}/{session}/{question}/{track}-{started}.{ext}</c>.
/// Chunks are appended and flushed one by one, so a crash keeps everything received so far. The
/// recorder's container (WebM for Chromium and Firefox) is valid when its chunks are written in
/// order, which is what the ingest guarantees. The audio file stands alone, apart from the
/// composite, so the post-question transcription reads clean audio.
/// </summary>
public sealed class FileMediaStore(string root) : IMediaSinkFactory
{
    public string Root { get; } = Path.GetFullPath(root);

    public bool Wants(MediaTrack track) => true;

    public IMediaSink Create() => new FileMediaSink(Root);

    /// <summary>Where a track lands, so a test and the README can say so.</summary>
    public static string PathFor(string root, MediaTrackOpened track) =>
        Path.Combine(root, track.Session.Value, track.Question.Value, $"{track.Track.ToString().ToLowerInvariant()}-{track.StartedAt:yyyyMMdd'T'HHmmss'Z'}{Extension(track.MimeType)}");

    private static string Extension(string mimeType)
    {
        var type = mimeType.Split(';')[0].Trim().ToLowerInvariant();
        return type switch
        {
            "audio/webm" or "video/webm" => ".webm",
            "audio/ogg" => ".ogg",
            "audio/mp4" or "video/mp4" => ".mp4",
            _ => ".bin",
        };
    }

    private sealed class FileMediaSink(string root) : IMediaSink
    {
        private FileStream? file;

        public async Task OpenAsync(MediaTrackOpened track, CancellationToken ct)
        {
            var path = PathFor(root, track);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read, bufferSize: 64 * 1024, FileOptions.Asynchronous);
            await Task.CompletedTask;
        }

        public async Task WriteAsync(MediaChunk chunk, CancellationToken ct)
        {
            if (file is null) throw new InvalidOperationException("The media file is not open.");
            await file.WriteAsync(chunk.Bytes, ct);
            await file.FlushAsync(ct);
        }

        public async Task CompleteAsync(CancellationToken ct)
        {
            if (file is null) return;
            await file.FlushAsync(ct);
            await file.DisposeAsync();
            file = null;
        }
    }
}
