// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using AiInterviewer.Api.Wire;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;

namespace AiInterviewer.Api.Streams;

/// <summary>
/// The media streams: a plain WebSocket per track (Steven, 2026-10-26: not SignalR), at
/// <c>/streams/{sessionId}/{track}</c>. PROPOSAL for decision 0003's open item 1:
/// the first message is a JSON text header <c>{ "mimeType": "audio/webm;codecs=opus" }</c>; every
/// later message is one binary chunk from the browser's recorder, in order; closing the socket
/// completes the stream. Chunks go to the ingest, whose channels fan them out to the file store
/// and the transcription feed, and whose backpressure holds this read loop when a sink lags.
/// Session management is not designed yet, so any non-blank session id is accepted.
/// </summary>
public static class MediaStreams
{
    public const string RootKey = "Media:Root";
    public const string DefaultRoot = "data/media";
    public const string Route = "/streams/{sessionId}/{track}";

    /// <summary>A chunk larger than this is refused; the recorder sends a few kilobytes every 250 ms.</summary>
    private const int MaxChunkBytes = 8 * 1024 * 1024;

    public static string Root(IConfiguration configuration, IHostEnvironment environment) =>
        Path.GetFullPath(configuration[RootKey] ?? DefaultRoot, environment.ContentRootPath);

    public static void MapMediaStreams(this IEndpointRouteBuilder app) => app.Map(Route, HandleAsync);

    public static bool TryParseTrack(string raw, out MediaTrack track)
    {
        switch (raw.ToLowerInvariant())
        {
            case "audio":
                track = MediaTrack.Audio;
                return true;
            case "composite":
                track = MediaTrack.Composite;
                return true;
            default:
                track = default;
                return false;
        }
    }

    private static async Task HandleAsync(HttpContext http, string sessionId, string track, MediaIngestService ingest, IOptions<JsonOptions> json, ILogger<MediaIngestService> log)
    {
        // The route is checked first, so a plain request to a bad address learns what is wrong with it.
        if (SessionId.From(sessionId) is not Succeeded<SessionId> session)
        {
            await Refuse(http, "sessionId must not be empty.");
            return;
        }
        if (!TryParseTrack(track, out var mediaTrack))
        {
            await Refuse(http, $"track must be \"audio\" or \"composite\", not \"{track}\".");
            return;
        }
        if (!http.WebSockets.IsWebSocketRequest)
        {
            await Refuse(http, "Expected a WebSocket request.");
            return;
        }

        using var socket = await http.WebSockets.AcceptWebSocketAsync();
        var buffer = new byte[64 * 1024];

        var header = await ReadMessageAsync(socket, buffer, http.RequestAborted);
        if (header is null || header.Value.Type != WebSocketMessageType.Text || ParseHeader(header.Value.Bytes, json.Value.SerializerOptions) is not { } mimeType)
        {
            await socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "The first message must be a JSON header with a mimeType.", CancellationToken.None);
            return;
        }

        var stream = await ingest.BeginAsync(session.Value, mediaTrack, mimeType, http.RequestAborted);
        try
        {
            while (true)
            {
                var message = await ReadMessageAsync(socket, buffer, http.RequestAborted);
                if (message is null) break;
                if (message.Value.Type != WebSocketMessageType.Binary)
                {
                    await stream.AbortAsync();
                    await socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "After the header, every message must be a binary chunk.", CancellationToken.None);
                    return;
                }
                await stream.WriteAsync(message.Value.Bytes, http.RequestAborted);
            }
            await stream.CompleteAsync(CancellationToken.None);
            if (socket.State == WebSocketState.CloseReceived)
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, $"{stream.Chunks} chunks stored", CancellationToken.None);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogError(e, "Media stream {Session}/{Track} failed after {Chunks} chunks.", session.Value, mediaTrack, stream.Chunks);
            await stream.AbortAsync();
            if (socket.State == WebSocketState.Open) await socket.CloseAsync(WebSocketCloseStatus.InternalServerError, "The stream could not be stored.", CancellationToken.None);
        }
        catch (OperationCanceledException)
        {
            // The browser went away without closing. Keep what arrived.
            await stream.AbortAsync();
        }
    }

    private static string? ParseHeader(ReadOnlyMemory<byte> bytes, JsonSerializerOptions options)
    {
        try
        {
            var header = JsonSerializer.Deserialize<MediaStreamHeaderDto>(bytes.Span, options);
            return string.IsNullOrWhiteSpace(header?.MimeType) ? null : header.MimeType.Trim();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>One whole message, reassembled from its frames; null once the peer has closed.</summary>
    private static async Task<(WebSocketMessageType Type, ReadOnlyMemory<byte> Bytes)?> ReadMessageAsync(WebSocket socket, byte[] buffer, CancellationToken ct)
    {
        using var whole = new MemoryStream();
        while (true)
        {
            var result = await socket.ReceiveAsync(buffer, ct);
            if (result.MessageType == WebSocketMessageType.Close) return null;
            whole.Write(buffer, 0, result.Count);
            if (whole.Length > MaxChunkBytes) throw new InvalidDataException($"A chunk exceeded {MaxChunkBytes} bytes.");
            if (result.EndOfMessage) return (result.MessageType, whole.ToArray());
        }
    }

    private static Task Refuse(HttpContext http, string message)
    {
        http.Response.StatusCode = StatusCodes.Status400BadRequest;
        return http.Response.WriteAsJsonAsync(new ErrorDto(message));
    }

    /// <summary>For a log line or a README: the header the browser sends, as text.</summary>
    public static string ExampleHeader(string mimeType) => Encoding.UTF8.GetString(JsonSerializer.SerializeToUtf8Bytes(new MediaStreamHeaderDto(mimeType), new JsonSerializerOptions(JsonSerializerDefaults.Web)));
}
