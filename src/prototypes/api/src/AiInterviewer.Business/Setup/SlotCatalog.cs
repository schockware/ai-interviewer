// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Setup;

/// <summary>
/// Which choices each slot accepts, straight from the contract. "default" is the first option.
/// {cloud} is refused for the real-time slots, because the round trip bogs down the pipeline.
/// </summary>
public static class SlotCatalog
{
    private sealed record Allowed(string[] Names, bool CustomLocal, bool Cloud);

    private static readonly IReadOnlyDictionary<Slot, Allowed> Rules = new Dictionary<Slot, Allowed>
    {
        [Slot.Listener] = new(["default", "Silero VAD + Smart Turn"], CustomLocal: true, Cloud: false),
        [Slot.Transcriber] = new(["default", "whisper.cpp"], CustomLocal: true, Cloud: false),
        [Slot.FollowUp] = new(["interviewer"], CustomLocal: true, Cloud: true),
        [Slot.Interviewer] = new(["default", "Qwen3.5 ladder"], CustomLocal: true, Cloud: true),
        [Slot.Evaluator] = new(["interviewer"], CustomLocal: true, Cloud: true),
        [Slot.Speaker] = new(["default", "Kokoro", "Inflect-Nano-v1"], CustomLocal: true, Cloud: false),
    };

    /// <summary>Returns one message for every slot whose choice is not offered. Empty means valid.</summary>
    public static IReadOnlyList<string> Validate(AiSlots ai)
    {
        var problems = new List<string>();
        foreach (var slot in Enum.GetValues<Slot>())
        {
            var rule = Rules[slot];
            var problem = ai.For(slot) switch
            {
                NamedChoice named when !rule.Names.Contains(named.Name) =>
                    $"{slot}: \"{named.Name}\" is not one of {string.Join(", ", rule.Names)}.",
                CustomLocalChoice when !rule.CustomLocal => $"{slot}: custom local is not offered.",
                CloudChoice when !rule.Cloud => $"{slot}: cloud is not offered for this slot.",
                _ => "",
            };
            if (problem.Length > 0) problems.Add(problem);
        }
        return problems;
    }
}
