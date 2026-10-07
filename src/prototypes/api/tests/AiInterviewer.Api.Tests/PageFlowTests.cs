// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AiInterviewer.Api.Tests;

/// <summary>Drives the real pipeline over HTTP, so JSON shapes and status codes are checked as a client sees them.</summary>
public class PageFlowTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    // Each test gets its own server, so the in-memory stores start empty.
    private HttpClient NewClient() => factory.WithWebHostBuilder(_ => { }).CreateClient();

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static string FormJson(string interviewType, string roleFocus, string speaker = "\"default\"") => $$"""
        {
          "ai": {
            "listener": "default", "transcriber": "default", "followUp": "interviewer",
            "interviewer": "default", "evaluator": "interviewer", "speaker": {{speaker}}
          },
          "interviewType": {{interviewType}},
          "roleFocus": "{{roleFocus}}"
        }
        """;

    private static string Base64(string text) => Convert.ToBase64String(Encoding.UTF8.GetBytes(text));

    private static async Task<JsonElement> Body(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> AddRole(HttpClient client)
    {
        var response = await client.PostAsync("/job-descriptions/pastes",
            Json("""{ "displayName": "Backend", "text": "We need a backend developer." }"""));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await Body(response)).GetProperty("roleId").GetString()!;
    }

    private const string GoodHardware = """
        {
          "audio": { "status": "verified", "quality": "clear" },
          "video": { "status": "skipped", "quality": "skipped" },
          "training": { "captions": "disabled" }
        }
        """;

    [Fact]
    public async Task The_setup_page_starts_ready_with_the_default_form_and_no_documents()
    {
        var response = await NewClient().GetAsync("/application-setup");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = await Body(response);
        Assert.Equal("ready", page.GetProperty("type").GetString());
        Assert.Equal("none", page.GetProperty("resumes").GetProperty("type").GetString());
        Assert.Equal("none", page.GetProperty("roles").GetProperty("type").GetString());
        var form = page.GetProperty("form");
        Assert.Equal("cold", form.GetProperty("interviewType").GetProperty("type").GetString());
        Assert.Equal("unanswered", form.GetProperty("roleFocus").GetString());
        Assert.Equal("default", form.GetProperty("ai").GetProperty("listener").GetString());
        Assert.Equal("interviewer", form.GetProperty("ai").GetProperty("followUp").GetString());
    }

    [Fact]
    public async Task An_uploaded_resume_appears_on_the_page_as_an_id_and_name_pair()
    {
        var client = NewClient();

        var upload = await client.PostAsync("/resumes",
            Json($$"""{ "displayName": "Jane CV", "fileName": "jane.txt", "payload": "{{Base64("Jane Doe, engineer")}}" }"""));

        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var processed = await Body(upload);
        var resumeId = processed.GetProperty("resumeId").GetString()!;
        Assert.Equal("Jane CV", processed.GetProperty("displayName").GetString());

        var page = await Body(await client.GetAsync("/application-setup"));
        var all = page.GetProperty("resumes").GetProperty("all");
        Assert.Equal("ready", page.GetProperty("resumes").GetProperty("type").GetString());
        Assert.Equal(resumeId, all[0][0].GetString());
        Assert.Equal("Jane CV", all[0][1].GetString());
    }

    [Fact]
    public async Task A_file_type_that_cannot_be_read_is_a_422_with_a_message()
    {
        var response = await NewClient().PostAsync("/resumes",
            Json($$"""{ "displayName": "CV", "fileName": "cv.pdf", "payload": "{{Base64("%PDF")}}" }"""));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Contains("cv.pdf", (await Body(response)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task A_job_description_file_upload_creates_a_role()
    {
        var response = await NewClient().PostAsync("/job-descriptions/uploads",
            Json($$"""{ "displayName": "Data role", "fileName": "jd.md", "payload": "{{Base64("# Data engineer")}}" }"""));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrEmpty((await Body(response)).GetProperty("roleId").GetString()));
    }

    [Fact]
    public async Task An_empty_paste_is_a_422()
    {
        var response = await NewClient().PostAsync("/job-descriptions/pastes",
            Json("""{ "displayName": "Empty", "text": "  " }"""));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task A_missing_required_field_is_a_400()
    {
        var response = await NewClient().PostAsync("/job-descriptions/pastes", Json("""{ "displayName": "No text" }"""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_null_required_field_is_a_400()
    {
        var response = await NewClient().PostAsync("/job-descriptions/pastes",
            Json("""{ "displayName": "Null text", "text": null }"""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_blank_display_name_is_a_400()
    {
        var response = await NewClient().PostAsync("/job-descriptions/pastes",
            Json("""{ "displayName": " ", "text": "x" }"""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Prepare_without_a_role_is_a_422()
    {
        var response = await NewClient().PostAsync("/interviews/prepare",
            Json($$"""{ "form": {{FormJson("""{ "type": "cold" }""", "unanswered")}}, "sessionId": "s1" }"""));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Contains("Role focus is required", (await Body(response)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task Prepare_with_a_cloud_speaker_is_a_422()
    {
        var client = NewClient();
        var roleId = await AddRole(client);

        var response = await client.PostAsync("/interviews/prepare",
            Json($$"""{ "form": {{FormJson("""{ "type": "cold" }""", roleId, speaker: """{ "type": "cloud" }""")}}, "sessionId": "s1" }"""));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Contains("Speaker", (await Body(response)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task An_unknown_interview_type_is_a_400()
    {
        var response = await NewClient().PostAsync("/interviews/prepare",
            Json($$"""{ "form": {{FormJson("""{ "type": "lukewarm" }""", "unanswered")}}, "sessionId": "s1" }"""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task The_interview_type_discriminator_may_come_after_other_properties()
    {
        var client = NewClient();
        var roleId = await AddRole(client);
        var resume = await Body(await client.PostAsync("/resumes",
            Json($$"""{ "displayName": "CV", "fileName": "cv.txt", "payload": "{{Base64("hi")}}" }""")));
        var resumeId = resume.GetProperty("resumeId").GetString();

        var response = await client.PostAsync("/interviews/prepare",
            Json($$"""{ "form": {{FormJson($$"""{ "resumeId": "{{resumeId}}", "type": "hot" }""", roleId)}}, "sessionId": "s1" }"""));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }

    [Fact]
    public async Task Prepare_for_a_hot_interview_with_a_missing_resume_is_a_422()
    {
        var client = NewClient();
        var roleId = await AddRole(client);

        var response = await client.PostAsync("/interviews/prepare",
            Json($$"""{ "form": {{FormJson("""{ "type": "hot", "resumeId": "ghost" }""", roleId)}}, "sessionId": "s1" }"""));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task The_whole_flow_runs_from_setup_to_cue_settings()
    {
        var client = NewClient();
        var roleId = await AddRole(client);

        var prepare = await client.PostAsync("/interviews/prepare",
            Json($$"""{ "form": {{FormJson("""{ "type": "hot-incomplete=>cold" }""", roleId)}}, "sessionId": "s1" }"""));
        Assert.Equal(HttpStatusCode.Accepted, prepare.StatusCode);

        var start = await client.PostAsync("/interviews/start", Json($$"""{ "form": {{GoodHardware}}, "sessionId": "s1" }"""));

        Assert.Equal(HttpStatusCode.OK, start.StatusCode);
        var emulation = (await Body(start)).GetProperty("emulation");
        Assert.Equal(0, emulation.GetProperty("cadences").GetProperty("speaking").GetInt32());
        Assert.Equal(1.0, emulation.GetProperty("cadences").GetProperty("variances").GetProperty("floor").GetDouble());
        Assert.Equal("clipped-ending", emulation.GetProperty("latencies").GetProperty("audioRamp").GetString());
    }

    [Fact]
    public async Task Start_for_a_session_that_was_never_prepared_is_a_404()
    {
        var response = await NewClient().PostAsync("/interviews/start",
            Json($$"""{ "form": {{GoodHardware}}, "sessionId": "never" }"""));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Start_with_unverified_audio_is_a_409()
    {
        var client = NewClient();
        var roleId = await AddRole(client);
        await client.PostAsync("/interviews/prepare",
            Json($$"""{ "form": {{FormJson("""{ "type": "cold" }""", roleId)}}, "sessionId": "s1" }"""));

        var response = await client.PostAsync("/interviews/start", Json("""
            {
              "form": {
                "audio": { "status": "pending", "quality": "pending" },
                "video": { "status": "skipped", "quality": "skipped" },
                "training": { "captions": "disabled" }
              },
              "sessionId": "s1"
            }
            """));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_number_where_an_enum_name_belongs_is_a_400()
    {
        var response = await NewClient().PostAsync("/interviews/start", Json("""
            {
              "form": {
                "audio": { "status": 2, "quality": "clear" },
                "video": { "status": "skipped", "quality": "skipped" },
                "training": { "captions": "disabled" }
              },
              "sessionId": "s1"
            }
            """));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_unknown_property_is_a_400()
    {
        var response = await NewClient().PostAsync("/job-descriptions/pastes",
            Json("""{ "displayName": "x", "text": "y", "extra": 1 }"""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Error_checks_for_an_unknown_session_are_a_404()
    {
        var response = await NewClient().PostAsJsonAsync("/interviews/error-checks", new { sessionId = "nope", logId = "log-x" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
