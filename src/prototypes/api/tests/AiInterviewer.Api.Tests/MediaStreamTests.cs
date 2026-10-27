// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using System.Net;
using System.Net.WebSockets;
using System.Text;
using AiInterviewer.Adapters.Media;
using AiInterviewer.Api.Streams;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AiInterviewer.Api.Tests;

/// <summary>A browser's recorder, played by hand over a real WebSocket: the header, binary chunks, close.</summary>
public class MediaStreamTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(5);

    private static async Task<WebSocket> Connect(WebApplicationFactory<Program> server, string session, string track)
    {
        var client = server.Server.CreateWebSocketClient();
        return await client.ConnectAsync(new Uri($"ws://localhost/streams/{session}/q1/{track}"), CancellationToken.None);
    }

    private static Task SendText(WebSocket socket, string text) =>
        socket.SendAsync(Encoding.UTF8.GetBytes(text), WebSocketMessageType.Text, true, CancellationToken.None);

    private static Task SendChunk(WebSocket socket, byte[] bytes) =>
        socket.SendAsync(bytes, WebSocketMessageType.Binary, true, CancellationToken.None);

    private static async Task<(WebSocketCloseStatus? Status, string? Description)> CloseAndWait(WebSocket socket)
    {
        await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None);
        var buffer = new byte[1024];
        using var timeout = new CancellationTokenSource(Wait);
        while (socket.State != WebSocketState.Closed && socket.State != WebSocketState.Aborted)
        {
            var result = await socket.ReceiveAsync(buffer, timeout.Token);
            if (result.MessageType == WebSocketMessageType.Close) break;
        }
        return (socket.CloseStatus, socket.CloseStatusDescription);
    }

    private static string RootOf(WebApplicationFactory<Program> server) =>
        MediaStreams.Root(server.Services.GetRequiredService<IConfiguration>(), server.Services.GetRequiredService<IHostEnvironment>());

    private static SessionId Session(string raw) => ((Succeeded<SessionId>)SessionId.From(raw)).Value;

    [Fact]
    public async Task An_audio_stream_is_written_to_its_own_file_in_order_and_reaches_the_transcription_feed()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        var socket = await Connect(server, "s-audio", "audio");
        await SendText(socket, """{ "mimeType": "audio/webm;codecs=opus" }""");
        await SendChunk(socket, [1, 2, 3]);
        await SendChunk(socket, [4, 5]);
        await SendChunk(socket, [6]);

        var (status, description) = await CloseAndWait(socket);

        Assert.Equal(WebSocketCloseStatus.NormalClosure, status);
        Assert.Equal("3 chunks stored", description);
        var file = Assert.Single(Directory.GetFiles(Path.Combine(RootOf(server), "s-audio", "q1")));
        Assert.StartsWith("audio-", Path.GetFileName(file));
        Assert.EndsWith(".webm", file);
        Assert.Equal(new byte[] { 1, 2, 3, 4, 5, 6 }, await File.ReadAllBytesAsync(file));
        var tally = server.Services.GetRequiredService<TranscriptionFeedLedger>().For(Session("s-audio"));
        Assert.Equal(new TranscriptionFeedTally(3, 6, true), tally);
    }

    [Fact]
    public async Task A_composite_stream_is_written_apart_from_the_audio_and_does_not_reach_the_transcription_feed()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        var socket = await Connect(server, "s-video", "composite");
        await SendText(socket, """{ "mimeType": "video/webm;codecs=vp8,opus" }""");
        await SendChunk(socket, [9, 9, 9, 9]);

        await CloseAndWait(socket);

        var file = Assert.Single(Directory.GetFiles(Path.Combine(RootOf(server), "s-video", "q1")));
        Assert.StartsWith("composite-", Path.GetFileName(file));
        Assert.Equal(4, new FileInfo(file).Length);
        Assert.Equal(new TranscriptionFeedTally(0, 0, false), server.Services.GetRequiredService<TranscriptionFeedLedger>().For(Session("s-video")));
    }

    [Fact]
    public async Task A_large_chunk_sent_in_frames_is_stored_whole()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        var socket = await Connect(server, "s-big", "audio");
        await SendText(socket, """{ "mimeType": "audio/webm" }""");
        var big = new byte[200_000];
        new Random(7).NextBytes(big);
        await SendChunk(socket, big);

        await CloseAndWait(socket);

        var file = Assert.Single(Directory.GetFiles(Path.Combine(RootOf(server), "s-big", "q1")));
        Assert.Equal(big, await File.ReadAllBytesAsync(file));
    }

    [Fact]
    public async Task A_stream_without_a_header_is_closed_as_a_policy_violation_and_nothing_is_written()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        var socket = await Connect(server, "s-noheader", "audio");
        await SendChunk(socket, [1, 2, 3]);

        var (status, description) = await CloseAndWait(socket);

        Assert.Equal(WebSocketCloseStatus.PolicyViolation, status);
        Assert.Contains("header", description);
        Assert.False(Directory.Exists(Path.Combine(RootOf(server), "s-noheader")));
    }

    [Fact]
    public async Task A_track_this_server_does_not_know_is_refused_before_the_upgrade()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        var error = await Assert.ThrowsAnyAsync<Exception>(() => Connect(server, "s1", "hologram"));
        Assert.NotNull(error);

        using var http = server.CreateClient();
        var response = await http.GetAsync("/streams/s1/q1/hologram");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("hologram", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_plain_request_to_a_stream_is_a_400_with_the_reason()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        using var http = server.CreateClient();
        var response = await http.GetAsync("/streams/s1/q1/audio");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("WebSocket", await response.Content.ReadAsStringAsync());
    }
}
