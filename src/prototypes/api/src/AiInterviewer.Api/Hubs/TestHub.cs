// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using Microsoft.AspNetCore.SignalR;

namespace AiInterviewer.Api.Hubs;

/// <summary>
/// Smoke-test hub for the real-time channel (decision 0003: WebSocket to the browser, here via SignalR).
/// It carries no session logic. Session management is designed before the real hubs are wired.
/// Both methods answer only the calling connection, never other clients.
/// </summary>
public sealed class TestHub : Hub
{
    public const string Route = "/hubs/test";

    /// <summary>Sends <paramref name="message"/> back to the caller's client method "echo".</summary>
    public Task Echo(string message) => Clients.Caller.SendAsync("echo", message);

    /// <summary>Sends <paramref name="message"/> to the caller's client method named by <paramref name="method"/>.</summary>
    public Task Probe(string method, string message) =>
        string.IsNullOrWhiteSpace(method)
            ? throw new HubException("method must not be empty.")
            : Clients.Caller.SendAsync(method, message);
}
