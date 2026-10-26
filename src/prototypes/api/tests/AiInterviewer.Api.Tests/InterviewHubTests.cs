// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using AiInterviewer.Api.Hubs;
using AiInterviewer.Api.Wire;
using AiInterviewer.Business.Setup;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace AiInterviewer.Api.Tests;

/// <summary>
/// Uploads a resume over HTTP and watches its processing over a real WebSocket. The mock uploader
/// runs instantly here (ApiFactory), so a watch may already find the upload finished.
/// </summary>
public class InterviewHubTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(5);

    private sealed record Rig(WebApplicationFactory<Program> Server, HttpClient Http) : IDisposable
    {
        public void Dispose()
        {
            Http.Dispose();
            Server.Dispose();
        }
    }

    private Rig NewRig()
    {
        var server = factory.WithWebHostBuilder(_ => { });
        return new Rig(server, server.CreateClient());
    }

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

    /// <summary>Every snapshot the server pushes, in order.</summary>
    private static ChannelReader<ResumeUploadProgressDto> Pushed(HubConnection connection)
    {
        var channel = Channel.CreateUnbounded<ResumeUploadProgressDto>();
        connection.On<ResumeUploadProgressDto>(InterviewHub.ResumeUploadProgressMethod, p => channel.Writer.TryWrite(p));
        return channel.Reader;
    }

    private static async Task<string> UploadResume(HttpClient http, string displayName)
    {
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes("Ten years of building things."));
        var response = await http.PostAsJsonAsync("/resumes", new { displayName, fileName = "cv.txt", payload });
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("resumeId").GetString()!;
    }

    /// <summary>The snapshot from the watch call, then pushes, until one is no longer running.</summary>
    private static async Task<ResumeUploadProgressDto> WatchUntilSettled(HubConnection connection, string resumeId)
    {
        var pushes = Pushed(connection);
        var current = await connection.InvokeAsync<ResumeUploadProgressDto>("WatchResumeUpload", resumeId);
        using var timeout = new CancellationTokenSource(Wait);
        while (current.Status == ResumeUploadStatus.Running)
            current = await pushes.ReadAsync(timeout.Token);
        return current;
    }

    [Fact]
    public async Task Watching_an_upload_returns_its_snapshot_and_reports_until_every_step_is_done()
    {
        using var rig = NewRig();
        await using var client = await Connect(rig.Server.Server);
        var resumeId = await UploadResume(rig.Http, "My resume");

        var settled = await WatchUntilSettled(client, resumeId);

        Assert.Equal(resumeId, settled.ResumeId);
        Assert.Equal("My resume", settled.DisplayName);
        Assert.Equal(ResumeUploadStatus.Done, settled.Status);
        Assert.InRange(settled.Steps.Count, 3, 6);
        Assert.All(settled.Steps, step =>
        {
            Assert.False(string.IsNullOrWhiteSpace(step.Name));
            Assert.Equal(UploadStepStatus.Done, step.Status);
        });
        Assert.Equal(settled.Steps.Count, settled.Steps.Select(s => s.Name).Distinct().Count());
    }

    [Fact]
    public async Task A_resume_whose_name_says_fail_ends_failed_at_one_step_with_the_rest_untouched()
    {
        using var rig = NewRig();
        await using var client = await Connect(rig.Server.Server);
        var resumeId = await UploadResume(rig.Http, "Please fail this one");

        var settled = await WatchUntilSettled(client, resumeId);

        Assert.Equal(ResumeUploadStatus.Failed, settled.Status);
        var failed = Assert.Single(settled.Steps, s => s.Status == UploadStepStatus.Failed);
        var failedAt = settled.Steps.ToList().IndexOf(failed);
        Assert.All(settled.Steps.Take(failedAt), s => Assert.Equal(UploadStepStatus.Done, s.Status));
        Assert.All(settled.Steps.Skip(failedAt + 1), s => Assert.Equal(UploadStepStatus.Pending, s.Status));
    }

    [Fact]
    public async Task Snapshots_use_the_contracts_spelling_on_the_wire()
    {
        using var rig = NewRig();
        await using var client = await Connect(rig.Server.Server);
        var resumeId = await UploadResume(rig.Http, "Spelling");

        var raw = await client.InvokeAsync<JsonElement>("WatchResumeUpload", resumeId);

        Assert.Equal(resumeId, raw.GetProperty("resumeId").GetString());
        Assert.Contains(raw.GetProperty("status").GetString(), new[] { "running", "done", "failed" });
        Assert.Contains(raw.GetProperty("steps")[0].GetProperty("status").GetString(), new[] { "pending", "running", "done", "failed" });
    }

    [Fact]
    public async Task Watching_a_resume_this_server_never_processed_is_refused_by_name()
    {
        using var rig = NewRig();
        await using var client = await Connect(rig.Server.Server);

        var error = await Assert.ThrowsAsync<HubException>(() => client.InvokeAsync<ResumeUploadProgressDto>("WatchResumeUpload", "nobody"));

        Assert.Contains("nobody", error.Message);
    }

    [Fact]
    public async Task Watching_a_blank_resume_id_is_refused()
    {
        using var rig = NewRig();
        await using var client = await Connect(rig.Server.Server);

        var error = await Assert.ThrowsAsync<HubException>(() => client.InvokeAsync<ResumeUploadProgressDto>("WatchResumeUpload", " "));

        Assert.Contains("must not be empty", error.Message);
    }

    [Fact]
    public async Task A_watcher_hears_only_about_the_resume_it_asked_for()
    {
        using var rig = NewRig();
        await using var mine = await Connect(rig.Server.Server);
        await using var theirs = await Connect(rig.Server.Server);
        var theirPushes = Pushed(theirs);
        var myResume = await UploadResume(rig.Http, "Mine");
        var theirResume = await UploadResume(rig.Http, "Theirs");

        await theirs.InvokeAsync<ResumeUploadProgressDto>("WatchResumeUpload", theirResume);
        var settled = await WatchUntilSettled(mine, myResume);

        Assert.Equal(myResume, settled.ResumeId);
        await Task.Delay(200);
        while (theirPushes.TryRead(out var push)) Assert.Equal(theirResume, push.ResumeId);
    }
}
