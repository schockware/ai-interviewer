// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AiInterviewer.Api.Wire;

/// <summary>One JSON dialect for every channel: the HTTP endpoints and the SignalR hubs speak the same way.</summary>
public static class WireJson
{
    public static void Configure(JsonSerializerOptions json)
    {
        json.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        json.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        // Enums travel as the contract's lowercase, hyphenated strings ("clipped-ending"), never as numbers.
        json.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, allowIntegerValues: false));
        // Explicit declarations only: a missing or null required field is a 400, not a silent default.
        json.RespectNullableAnnotations = true;
        json.RespectRequiredConstructorParameters = true;
        json.AllowOutOfOrderMetadataProperties = true;
        json.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
    }
}
