// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using System.Text.Json.Nodes;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters.Sqlite;

/// <summary>Wraps the form so an Outcome can carry it (Outcome needs a reference it can pattern-match on).</summary>
public sealed record ApplicationSetupFormHolder(ApplicationSetupForm Form);

/// <summary>
/// How a session's <see cref="ApplicationSetupForm"/> is written into one text column. This is the
/// store's own shape, not the wire's: the wire DTOs and their JSON attributes stay in the Api
/// project, and the business types carry no serialization attributes. Reading is strict: a shape
/// this version does not know is a failure, never a guessed default.
/// </summary>
public static class SetupFormJson
{
    public static string Write(ApplicationSetupForm form) => new JsonObject
    {
        ["ai"] = new JsonObject
        {
            ["listener"] = Choice(form.Ai.Listener),
            ["transcriber"] = Choice(form.Ai.Transcriber),
            ["followUp"] = Choice(form.Ai.FollowUp),
            ["interviewer"] = Choice(form.Ai.Interviewer),
            ["evaluator"] = Choice(form.Ai.Evaluator),
            ["speaker"] = Choice(form.Ai.Speaker),
        },
        ["interviewType"] = form.InterviewType switch
        {
            ColdInterview => new JsonObject { ["type"] = "cold" },
            HotIncompleteToCold => new JsonObject { ["type"] = "hot-incomplete=>cold" },
            HotInterview hot => new JsonObject { ["type"] = "hot", ["resumeId"] = hot.ResumeId.Value },
            _ => throw new InvalidOperationException("Unknown interview type."),
        },
        ["roleFocus"] = form.RoleFocus switch
        {
            UnansweredRole => new JsonObject { ["type"] = "unanswered" },
            AnsweredRole answered => new JsonObject { ["type"] = "role", ["roleId"] = answered.RoleId.Value },
            _ => throw new InvalidOperationException("Unknown role focus."),
        },
    }.ToJsonString();

    public static Outcome<ApplicationSetupFormHolder> Read(string json)
    {
        try
        {
            var root = Object(JsonNode.Parse(json), "form");
            var ai = Object(root["ai"], "ai");
            var form = new ApplicationSetupForm(
                new AiSlots(
                    Listener: ReadChoice(ai, "listener"),
                    Transcriber: ReadChoice(ai, "transcriber"),
                    FollowUp: ReadChoice(ai, "followUp"),
                    Interviewer: ReadChoice(ai, "interviewer"),
                    Evaluator: ReadChoice(ai, "evaluator"),
                    Speaker: ReadChoice(ai, "speaker")),
                ReadInterviewType(Object(root["interviewType"], "interviewType")),
                ReadRoleFocus(Object(root["roleFocus"], "roleFocus")));
            return Outcome.Success(new ApplicationSetupFormHolder(form));
        }
        catch (Exception e) when (e is JsonException or InvalidDataException)
        {
            return Outcome.Failure<ApplicationSetupFormHolder>($"stored form is not readable: {e.Message}");
        }
    }

    private static JsonObject Choice(SlotChoice choice) => choice switch
    {
        NamedChoice named => new JsonObject { ["type"] = "named", ["name"] = named.Name },
        CustomLocalChoice => new JsonObject { ["type"] = "custom-local" },
        CloudChoice => new JsonObject { ["type"] = "cloud" },
        _ => throw new InvalidOperationException("Unknown slot choice."),
    };

    private static SlotChoice ReadChoice(JsonObject ai, string slot)
    {
        var choice = Object(ai[slot], slot);
        return Text(choice, "type") switch
        {
            "named" => new NamedChoice(Text(choice, "name")),
            "custom-local" => new CustomLocalChoice(),
            "cloud" => new CloudChoice(),
            var other => throw new InvalidDataException($"{slot}: unknown choice type \"{other}\"."),
        };
    }

    private static InterviewType ReadInterviewType(JsonObject node) => Text(node, "type") switch
    {
        "cold" => new ColdInterview(),
        "hot-incomplete=>cold" => new HotIncompleteToCold(),
        "hot" => ResumeId.From(Text(node, "resumeId")) is Succeeded<ResumeId> ok
            ? new HotInterview(ok.Value)
            : throw new InvalidDataException("interviewType: blank resumeId."),
        var other => throw new InvalidDataException($"interviewType: unknown type \"{other}\"."),
    };

    private static RoleFocus ReadRoleFocus(JsonObject node) => Text(node, "type") switch
    {
        "unanswered" => new UnansweredRole(),
        "role" => RoleId.From(Text(node, "roleId")) is Succeeded<RoleId> ok
            ? new AnsweredRole(ok.Value)
            : throw new InvalidDataException("roleFocus: blank roleId."),
        var other => throw new InvalidDataException($"roleFocus: unknown type \"{other}\"."),
    };

    private static JsonObject Object(JsonNode? node, string name) =>
        node as JsonObject ?? throw new InvalidDataException($"{name} is missing or not an object.");

    private static string Text(JsonObject node, string key) =>
        node[key] is JsonValue value && value.TryGetValue<string>(out var text)
            ? text
            : throw new InvalidDataException($"{key} is missing or not a string.");
}
