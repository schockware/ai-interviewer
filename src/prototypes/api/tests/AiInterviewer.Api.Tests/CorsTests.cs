// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AiInterviewer.Api.Tests;

/// <summary>
/// The UI prototype's dev server (http://localhost:5173) may call this API directly, by the origins
/// in appsettings.Development.json. Any other origin gets no CORS headers, so the browser blocks it.
/// </summary>
public class CorsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private HttpClient NewClient() => factory.WithWebHostBuilder(_ => { }).CreateClient();

    private static HttpRequestMessage Preflight(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/application-setup");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        return request;
    }

    [Fact]
    public async Task The_ui_dev_server_origin_is_allowed()
    {
        var response = await NewClient().SendAsync(Preflight("http://localhost:5173"));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:5173", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task A_simple_request_from_the_ui_dev_server_carries_the_allow_header()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/application-setup");
        request.Headers.Add("Origin", "http://localhost:5173");

        var response = await NewClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("http://localhost:5173", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task An_unknown_origin_gets_no_allow_header()
    {
        var response = await NewClient().SendAsync(Preflight("http://evil.example"));

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }
}
