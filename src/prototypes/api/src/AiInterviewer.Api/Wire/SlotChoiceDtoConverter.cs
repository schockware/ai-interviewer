// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AiInterviewer.Api.Wire;

/// <summary>A slot choice is a bare string, or an object whose "type" is "custom-local" or "cloud".</summary>
public sealed class SlotChoiceDtoConverter : JsonConverter<SlotChoiceDto>
{
    public override SlotChoiceDto Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.String:
                return new NamedChoiceDto(reader.GetString() ?? throw new JsonException("Slot choice must not be null."));
            case JsonTokenType.StartObject:
                using (var doc = JsonDocument.ParseValue(ref reader))
                {
                    var type = doc.RootElement.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String
                        ? t.GetString()
                        : "";
                    return type switch
                    {
                        "custom-local" => new CustomLocalChoiceDto(),
                        "cloud" => new CloudChoiceDto(),
                        _ => throw new JsonException("A slot choice object needs \"type\" of \"custom-local\" or \"cloud\"."),
                    };
                }
            default:
                throw new JsonException("A slot choice is a string, or an object with a \"type\".");
        }
    }

    public override void Write(Utf8JsonWriter writer, SlotChoiceDto value, JsonSerializerOptions options)
    {
        switch (value)
        {
            case NamedChoiceDto named:
                writer.WriteStringValue(named.Name);
                break;
            case CustomLocalChoiceDto:
                writer.WriteStartObject();
                writer.WriteString("type", "custom-local");
                writer.WriteEndObject();
                break;
            case CloudChoiceDto:
                writer.WriteStartObject();
                writer.WriteString("type", "cloud");
                writer.WriteEndObject();
                break;
            default:
                throw new JsonException($"Unknown slot choice {value.GetType().Name}.");
        }
    }
}
