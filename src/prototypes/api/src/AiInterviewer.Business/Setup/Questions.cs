// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AiInterviewer.Business.Setup;

// Role set up (specs/page-flow.md, section 2): a role has a description and questions. The user
// may upload basic questions, keep the role's saved ones, or let the AI write them (the default).
// PROPOSAL: the wire shapes are the API prototype's; contracts/page-flow.md marks them as such.

/// <summary>Where a role's questions came from.</summary>
public enum QuestionSource { Uploaded, Generated, Sample }

/// <summary>One question the interviewer asks, in the order it is asked.</summary>
public sealed record InterviewQuestion(QuestionId Id, int Order, string Text);

/// <summary>A stored set of questions for one role. Only one set is the role's current questions at a time.</summary>
public sealed record QuestionSet(QuestionSetId Id, RoleId Role, QuestionSource Source, DateTimeOffset CreatedAt, IReadOnlyList<InterviewQuestion> Questions);

/// <summary>What the Role set up page shows once a role is chosen: its description and its saved questions, if any.</summary>
public sealed record RoleDetail(RoleId Id, DisplayName Name, string Description, IReadOnlyList<InterviewQuestion> Questions);

/// <summary>An upload or paste of questions, stored for the role but not yet its questions: Prepare interview makes them so.</summary>
public sealed record QuestionsProcessed(QuestionSetId SetId, DisplayName DisplayName, int Count);

/// <summary>What the user decided about the role's questions, sent with Prepare interview.</summary>
public abstract record QuestionPlan
{
    private protected QuestionPlan() { }
}

/// <summary>Use the role's saved questions. Prepare refuses it for a role that has none.</summary>
public sealed record KeepQuestions : QuestionPlan;

/// <summary>The AI writes the questions (the default). Any saved questions are purged first.</summary>
public sealed record GenerateQuestions : QuestionPlan;

/// <summary>The set the user uploaded for this role becomes its questions. Any saved questions are purged.</summary>
public sealed record UploadedQuestions(QuestionSetId SetId) : QuestionPlan;

/// <summary>
/// Reads basic questions out of an uploaded or pasted document. Plain text is one question per
/// line: blank lines and markdown headings are skipped and list markers are dropped. JSON is an
/// array of strings, <c>{ "questions": [...] }</c>, or one role from the sample question bank
/// (<c>{ "core": [{ "text": ... }] }</c>). A whole bank is refused, because it holds many roles.
/// Follow-ups and triggers in the bank are not read; they belong to the follow-up decider.
/// </summary>
public static partial class QuestionText
{
    public static Outcome<IReadOnlyList<string>> Parse(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.Length == 0) return Outcome.Failure<IReadOnlyList<string>>("The questions document is empty.");
        var parsed = trimmed[0] is '[' or '{' ? ParseJson(trimmed) : Outcome.Success(ParseLines(trimmed));
        return parsed switch
        {
            Succeeded<IReadOnlyList<string>> ok when ok.Value.Count == 0 =>
                Outcome.Failure<IReadOnlyList<string>>("No questions were found. Put one question per line."),
            _ => parsed,
        };
    }

    private static IReadOnlyList<string> ParseLines(string text)
    {
        var questions = new List<string>();
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var question = ListMarker().Replace(line, "").Trim();
            if (question.Length > 0) questions.Add(question);
        }
        return questions;
    }

    private static Outcome<IReadOnlyList<string>> ParseJson(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind == JsonValueKind.Array) return Texts(root);
            if (root.ValueKind != JsonValueKind.Object)
                return Outcome.Failure<IReadOnlyList<string>>("A JSON questions document is an array, or an object with \"questions\" or \"core\".");
            if (root.TryGetProperty("roles", out _))
                return Outcome.Failure<IReadOnlyList<string>>("This file holds a whole question bank. Upload one role's questions: its \"core\" list.");
            if (root.TryGetProperty("questions", out var questions)) return Texts(questions);
            if (root.TryGetProperty("core", out var core)) return Texts(core);
            return Outcome.Failure<IReadOnlyList<string>>("A JSON questions document needs a \"questions\" or \"core\" array.");
        }
        catch (JsonException e)
        {
            return Outcome.Failure<IReadOnlyList<string>>($"The questions document is not valid JSON: {e.Message}");
        }
    }

    private static Outcome<IReadOnlyList<string>> Texts(JsonElement array)
    {
        if (array.ValueKind != JsonValueKind.Array)
            return Outcome.Failure<IReadOnlyList<string>>("The questions must be an array.");
        var texts = new List<string>();
        foreach (var item in array.EnumerateArray())
        {
            var text = item.ValueKind switch
            {
                JsonValueKind.String => item.GetString(),
                JsonValueKind.Object when item.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String => t.GetString(),
                _ => null,
            };
            if (text is null) return Outcome.Failure<IReadOnlyList<string>>("Each question must be a string, or an object with \"text\".");
            if (!string.IsNullOrWhiteSpace(text)) texts.Add(text.Trim());
        }
        return Outcome.Success<IReadOnlyList<string>>(texts);
    }

    [GeneratedRegex(@"^(?:[-*•]|\d+[.)])\s+")]
    private static partial Regex ListMarker();
}
