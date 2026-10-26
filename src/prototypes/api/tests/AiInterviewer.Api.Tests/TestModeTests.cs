// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AiInterviewer.Api.Testing;
using AiInterviewer.Business.Setup;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace AiInterviewer.Api.Tests;

/// <summary>Test headers set mock options per request, are refused with a reason when wrong, and are refused outright when test mode is off.</summary>
public class TestModeTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static HttpRequestMessage Upload(string? headerValue, string headerName = TestMode.MockUploaderOptionsHeader)
    {
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes("Ten years."));
        var request = new HttpRequestMessage(HttpMethod.Post, "/resumes")
        {
            Content = JsonContent.Create(new { displayName = "CV", fileName = "cv.txt", payload }),
        };
        if (headerValue is not null) request.Headers.TryAddWithoutValidation(headerName, headerValue);
        return request;
    }

    private static async Task<string> Message(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("message").GetString()!;

    [Fact]
    public async Task A_well_formed_uploader_header_is_accepted()
    {
        using var client = factory.WithWebHostBuilder(_ => { }).CreateClient();
        var response = await client.SendAsync(Upload("""{"minStepDelayMs":0,"maxStepDelayMs":0}"""));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task A_malformed_uploader_header_is_refused_with_the_reason()
    {
        using var client = factory.WithWebHostBuilder(_ => { }).CreateClient();
        var response = await client.SendAsync(Upload("""{"minStepDelayMs":"fast"}"""));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(TestMode.MockUploaderOptionsHeader, await Message(response));
    }

    [Fact]
    public async Task A_minimum_above_the_maximum_is_refused()
    {
        using var client = factory.WithWebHostBuilder(_ => { }).CreateClient();
        var response = await client.SendAsync(Upload("""{"minStepDelayMs":500,"maxStepDelayMs":100}"""));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("minStepDelayMs", await Message(response));
    }

    [Fact]
    public async Task A_test_header_this_server_does_not_know_is_refused()
    {
        using var client = factory.WithWebHostBuilder(_ => { }).CreateClient();
        var response = await client.SendAsync(Upload("1", "X-Mock-Weather"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("X-Mock-Weather", await Message(response));
    }

    [Fact]
    public async Task Test_headers_are_refused_when_test_mode_is_off_and_plain_requests_still_work()
    {
        using var server = factory.WithWebHostBuilder(b => b.UseSetting(TestMode.EnabledKey, "false"));
        using var client = server.CreateClient();

        var refused = await client.SendAsync(Upload("""{"minStepDelayMs":0,"maxStepDelayMs":0}"""));
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Contains("test mode is off", await Message(refused));

        var plain = await client.SendAsync(Upload(null));
        Assert.Equal(HttpStatusCode.OK, plain.StatusCode);
    }

    [Fact]
    public void The_uploader_defaults_come_from_configuration()
    {
        using var server = factory.WithWebHostBuilder(b =>
        {
            b.UseSetting(TestMode.MinStepDelayKey, "10");
            b.UseSetting(TestMode.MaxStepDelayKey, "20");
        });

        var options = server.Services.GetRequiredService<ResumeUploaderOptions>();

        Assert.Equal(TimeSpan.FromMilliseconds(10), options.MinStepDelay);
        Assert.Equal(TimeSpan.FromMilliseconds(20), options.MaxStepDelay);
    }
}
