// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Interview;

// contracts/page-flow.md, "Interview". Sent by the server so both sides manage cadence and
// latency emulation the same way.

public readonly record struct Milliseconds
{
    public int Value { get; }

    public Milliseconds(int value)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(value);
        Value = value;
    }
}

public enum AudioRamp { ClippedBeginning, ClippedEnding, Both }

public sealed record Variances(double Floor, double Ceiling);

public sealed record Cadences(Milliseconds Speaking, Milliseconds Listening, Milliseconds Thinking, Variances Variances);

public sealed record Latencies(Milliseconds Network, double PacketLossVariancePerSecond, AudioRamp AudioRamp);

public sealed record CueSettings(Cadences Cadences, Latencies Latencies)
{
    /// <summary>
    /// PROPOSAL, unverified. The contract defines the shape but no values. These are placeholders
    /// for a clean call (no added network delay or loss) so the client has something to render.
    /// Real presets come from SPEC section 5.2 once the simulator exists.
    /// </summary>
    public static CueSettings CleanCallProposal { get; } = new(
        new Cadences(
            Speaking: new Milliseconds(0),
            Listening: new Milliseconds(0),
            Thinking: new Milliseconds(0),
            new Variances(Floor: 1.0, Ceiling: 1.0)),
        new Latencies(Network: new Milliseconds(0), PacketLossVariancePerSecond: 0.0, AudioRamp.ClippedEnding));
}
