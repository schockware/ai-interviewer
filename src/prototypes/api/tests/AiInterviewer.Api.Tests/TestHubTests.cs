// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Api.Hubs;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;

namespace AiInterviewer.Api.Tests;

/// <summary>Connects real SignalR clients over the WebSocket transport to the in-memory server.</summary>
public class TestHubTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(5);

    private async Task<HubConnection> Connect()
    {
        var server = factory.Server;
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(server.BaseAddress, TestHub.Route), options =>
            {
                options.Transports = HttpTransportType.WebSockets;
                options.HttpMessageHandlerFactory = _ => server.CreateHandler();
                options.WebSocketFactory = async (context, ct) => await server.CreateWebSocketClient().ConnectAsync(context.Uri, ct);
            })
            .Build();
        await connection.StartAsync();
        return connection;
    }

    /// <summary>Registers a client method and returns what it receives, or fails after a timeout.</summary>
    private static Task<string> Listen(HubConnection connection, string method)
    {
        var received = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string>(method, received.SetResult);
        return received.Task.WaitAsync(Wait);
    }

    [Fact]
    public async Task Echo_returns_the_message_to_the_clients_echo_method()
    {
        await using var client = await Connect();
        var echoed = Listen(client, "echo");

        await client.InvokeAsync("Echo", "hello");

        Assert.Equal("hello", await echoed);
    }

    [Fact]
    public async Task Probe_sends_the_message_to_the_method_the_client_names()
    {
        await using var client = await Connect();
        var received = Listen(client, "anything-i-like");

        await client.InvokeAsync("Probe", "anything-i-like", "ping");

        Assert.Equal("ping", await received);
    }

    [Fact]
    public async Task Probe_does_not_use_the_echo_method_unless_asked()
    {
        await using var client = await Connect();
        var echo = Listen(client, "echo");
        var other = Listen(client, "other");

        await client.InvokeAsync("Probe", "other", "x");

        Assert.Equal("x", await other);
        Assert.False(echo.IsCompleted);
    }

    [Fact]
    public async Task Echo_answers_only_the_caller()
    {
        await using var caller = await Connect();
        await using var bystander = await Connect();
        var callerEcho = Listen(caller, "echo");
        var bystanderEcho = Listen(bystander, "echo");

        await caller.InvokeAsync("Echo", "mine");

        Assert.Equal("mine", await callerEcho);
        await Task.Delay(200);
        Assert.False(bystanderEcho.IsCompleted);
    }

    [Fact]
    public async Task Probe_answers_only_the_caller()
    {
        await using var caller = await Connect();
        await using var bystander = await Connect();
        var callerGot = Listen(caller, "m");
        var bystanderGot = Listen(bystander, "m");

        await caller.InvokeAsync("Probe", "m", "mine");

        Assert.Equal("mine", await callerGot);
        await Task.Delay(200);
        Assert.False(bystanderGot.IsCompleted);
    }

    [Fact]
    public async Task Probe_with_a_blank_method_is_refused()
    {
        await using var client = await Connect();

        var error = await Assert.ThrowsAsync<HubException>(() => client.InvokeAsync("Probe", " ", "x"));

        Assert.Contains("method must not be empty", error.Message);
    }
}
