// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using System.Threading.Channels;
using AiInterviewer.Adapters.Transcription;
using AiInterviewer.Api.Hubs;
using AiInterviewer.Api.Wire;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;
using AiInterviewer.Contracts.Transcription;
using Grpc.Core;
using Grpc.Net.Client;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using BusinessSegment = AiInterviewer.Business.Media.TranscriptSegment;
using WireSegment = AiInterviewer.Contracts.Transcription.TranscriptSegment;

namespace AiInterviewer.Api.Tests;

/// <summary>A stand-in for the Python worker: one partial per chunk, a final at the end; the post pass says two things.</summary>
internal sealed class FakeRealTime : RealTimeTranscriber.RealTimeTranscriberBase
{
    public override async Task Transcribe(IAsyncStreamReader<AudioChunk> requestStream, IServerStreamWriter<WireSegment> responseStream, ServerCallContext context)
    {
        var n = 0;
        var session = "";
        var question = "";
        await foreach (var chunk in requestStream.ReadAllAsync())
        {
            n++;
            session = chunk.SessionId;
            question = chunk.QuestionId;
            await responseStream.WriteAsync(new WireSegment { SessionId = session, QuestionId = question, Id = $"p{n}", StartSeconds = 0, EndSeconds = n, Text = $"partial {n}", Final = false, Model = "realtime:fake", Device = "none" });
        }
        var final = new WireSegment { SessionId = session, QuestionId = question, Id = "f1", StartSeconds = 0, EndSeconds = n, Text = $"final after {n}", Final = true, Model = "realtime:fake", Device = "none" };
        for (var i = 1; i <= n; i++) final.Replaces.Add($"p{i}");
        await responseStream.WriteAsync(final);
    }

    public override Task<HealthReply> Health(HealthRequest request, ServerCallContext context) => Task.FromResult(new HealthReply { Ready = true, Model = "fake" });
}

internal sealed class FakePost : PostQuestionTranscriber.PostQuestionTranscriberBase
{
    public override async Task TranscribeFile(TranscribeFileRequest request, IServerStreamWriter<WireSegment> responseStream, ServerCallContext context)
    {
        if (!File.Exists(request.Path)) throw new RpcException(new Status(StatusCode.NotFound, $"No audio file at {request.Path}."));
        await responseStream.WriteAsync(new WireSegment { SessionId = request.SessionId, QuestionId = request.QuestionId, Id = "pq1", Text = "the whole", Final = true, Model = "post:fake", Device = "gpu" });
        await responseStream.WriteAsync(new WireSegment { SessionId = request.SessionId, QuestionId = request.QuestionId, Id = "pq2", Text = "answer", Final = true, Model = "post:fake", Device = "gpu" });
    }
}

internal sealed class RecordingTranscriptSink : ITranscriptSink
{
    public List<BusinessSegment> Segments { get; } = [];
    public List<TranscriptFailure> Failures { get; } = [];

    public Task ReportAsync(BusinessSegment segment, CancellationToken ct)
    {
        lock (Segments) Segments.Add(segment);
        return Task.CompletedTask;
    }

    public Task FailedAsync(TranscriptFailure failure, CancellationToken ct)
    {
        lock (Failures) Failures.Add(failure);
        return Task.CompletedTask;
    }
}

/// <summary>The gRPC adapters against the stand-in worker, hosted in-process.</summary>
public class GrpcTranscriptionTests : IAsyncLifetime
{
    private IHost host = null!;
    private GrpcChannel channel = null!;

    private static readonly SessionId S1 = ((Succeeded<SessionId>)SessionId.From("s1")).Value;
    private static readonly QuestionId Q1 = ((Succeeded<QuestionId>)QuestionId.From("q1")).Value;
    private static readonly MediaTrackOpened Opened = new(S1, Q1, MediaTrack.Audio, "audio/webm", DateTimeOffset.UnixEpoch);

    public async Task InitializeAsync()
    {
        host = await new HostBuilder()
            .ConfigureWebHost(web => web
                .UseTestServer()
                .ConfigureServices(s => s.AddGrpc())
                .Configure(app => app.UseRouting().UseEndpoints(e =>
                {
                    e.MapGrpcService<FakeRealTime>();
                    e.MapGrpcService<FakePost>();
                })))
            .StartAsync();
        channel = GrpcChannel.ForAddress("http://localhost", new GrpcChannelOptions { HttpHandler = host.GetTestServer().CreateHandler() });
    }

    public async Task DisposeAsync()
    {
        channel.Dispose();
        await host.StopAsync();
        host.Dispose();
    }

    [Fact]
    public async Task The_live_feed_sends_every_chunk_and_hands_each_piece_to_the_sinks_in_order()
    {
        var sink = new RecordingTranscriptSink();
        var feed = new GrpcRealTimeTranscriptionFeed(channel, [sink]).Create();
        await feed.OpenAsync(Opened, default);
        await feed.WriteAsync(new MediaChunk(S1, Q1, MediaTrack.Audio, 1, new byte[] { 1 }, DateTimeOffset.UnixEpoch), default);
        await feed.WriteAsync(new MediaChunk(S1, Q1, MediaTrack.Audio, 2, new byte[] { 2 }, DateTimeOffset.UnixEpoch), default);
        await feed.CompleteAsync(default);

        Assert.Equal(["partial 1", "partial 2", "final after 2"], sink.Segments.Select(s => s.Text));
        Assert.All(sink.Segments, s => Assert.Equal(TranscriptSource.RealTime, s.Source));
        Assert.Equal(["p1", "p2"], sink.Segments.Last().Replaces);
        Assert.Empty(sink.Failures);
    }

    [Fact]
    public async Task The_post_question_pass_yields_the_workers_pieces()
    {
        var path = Path.GetTempFileName();
        var pieces = new List<BusinessSegment>();
        await foreach (var s in new GrpcPostQuestionTranscriber(channel).TranscribeAsync(Opened, path, default)) pieces.Add(s);
        File.Delete(path);

        Assert.Equal(["the whole", "answer"], pieces.Select(p => p.Text));
        Assert.All(pieces, p => Assert.Equal(TranscriptSource.PostQuestion, p.Source));
        Assert.Equal("gpu", pieces[0].Device);
    }

    [Fact]
    public async Task The_service_reports_a_missing_file_as_a_failure_and_does_not_throw()
    {
        var sink = new RecordingTranscriptSink();
        await new PostQuestionService(new GrpcPostQuestionTranscriber(channel), [sink]).RunAsync(Opened, Path.Combine(Path.GetTempPath(), "nowhere.webm"), default);

        var failure = Assert.Single(sink.Failures);
        Assert.Equal(TranscriptSource.PostQuestion, failure.Source);
        Assert.Contains("No audio file", failure.Message);
    }

    [Fact]
    public async Task A_worker_that_is_not_running_is_reported_once_and_the_chunks_still_flow()
    {
        using var dead = GrpcChannel.ForAddress("http://127.0.0.1:1");
        var sink = new RecordingTranscriptSink();
        var feed = new GrpcRealTimeTranscriptionFeed(dead, [sink]).Create();
        await feed.OpenAsync(Opened, default);
        await feed.WriteAsync(new MediaChunk(S1, Q1, MediaTrack.Audio, 1, new byte[] { 1 }, DateTimeOffset.UnixEpoch), default);
        await feed.WriteAsync(new MediaChunk(S1, Q1, MediaTrack.Audio, 2, new byte[] { 2 }, DateTimeOffset.UnixEpoch), default);
        await feed.CompleteAsync(default);

        var failure = Assert.Single(sink.Failures);
        Assert.Equal(TranscriptSource.RealTime, failure.Source);
        Assert.Contains("not running", failure.Message);
        Assert.Empty(sink.Segments);
    }
}

/// <summary>The transcript on the hub: a late watcher gets what was said, a live one gets each piece.</summary>
public class TranscriptHubTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(5);

    private static async Task<HubConnection> Connect(TestServer server)
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(server.BaseAddress, InterviewHub.Route), options =>
            {
                options.Transports = HttpTransportType.WebSockets;
                options.HttpMessageHandlerFactory = _ => server.CreateHandler();
                options.WebSocketFactory = async (context, ct) => await server.CreateWebSocketClient().ConnectAsync(context.Uri, ct);
            })
            .AddJsonProtocol(options => WireJson.Configure(options.PayloadSerializerOptions))
            .Build();
        await connection.StartAsync();
        return connection;
    }

    private static BusinessSegment Segment(string session, string id, string text, bool final) =>
        new(((Succeeded<SessionId>)SessionId.From(session)).Value, ((Succeeded<QuestionId>)QuestionId.From("q1")).Value, id, 0, 1, text, final, [], TranscriptSource.RealTime, "realtime:fake", "cpu");

    [Fact]
    public async Task A_watcher_gets_the_pieces_so_far_and_then_each_new_one()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        var broadcaster = server.Services.GetRequiredService<TranscriptBroadcaster>();
        await broadcaster.ReportAsync(Segment("s-t1", "p1", "hello", false), default);

        await using var client = await Connect(server.Server);
        var pushed = Channel.CreateUnbounded<TranscriptSegmentDto>();
        client.On<TranscriptSegmentDto>(InterviewHub.TranscriptSegmentMethod, s => pushed.Writer.TryWrite(s));
        var snapshot = await client.InvokeAsync<TranscriptSnapshotDto>("WatchTranscript", "s-t1");
        Assert.Equal(["hello"], snapshot.Segments.Select(s => s.Text));

        await broadcaster.ReportAsync(Segment("s-t1", "f1", "hello there", true), default);
        using var timeout = new CancellationTokenSource(Wait);
        var live = await pushed.Reader.ReadAsync(timeout.Token);
        Assert.Equal("hello there", live.Text);
        Assert.True(live.Final);
        Assert.Equal(TranscriptSource.RealTime, live.Source);
    }

    [Fact]
    public async Task A_failure_reaches_the_watcher_and_the_snapshot()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        var broadcaster = server.Services.GetRequiredService<TranscriptBroadcaster>();
        await using var client = await Connect(server.Server);
        var failed = Channel.CreateUnbounded<TranscriptFailureDto>();
        client.On<TranscriptFailureDto>(InterviewHub.TranscriptFailedMethod, f => failed.Writer.TryWrite(f));
        await client.InvokeAsync<TranscriptSnapshotDto>("WatchTranscript", "s-t2");

        await broadcaster.FailedAsync(new TranscriptFailure(((Succeeded<SessionId>)SessionId.From("s-t2")).Value, ((Succeeded<QuestionId>)QuestionId.From("q1")).Value, TranscriptSource.PostQuestion, "down"), default);

        using var timeout = new CancellationTokenSource(Wait);
        var f = await failed.Reader.ReadAsync(timeout.Token);
        Assert.Equal("down", f.Message);
        Assert.Single((await client.InvokeAsync<TranscriptSnapshotDto>("WatchTranscript", "s-t2")).Failures);
    }

    [Fact]
    public async Task Watching_a_blank_session_is_refused()
    {
        using var server = factory.WithWebHostBuilder(_ => { });
        await using var client = await Connect(server.Server);
        await Assert.ThrowsAsync<HubException>(() => client.InvokeAsync<TranscriptSnapshotDto>("WatchTranscript", " "));
    }
}
