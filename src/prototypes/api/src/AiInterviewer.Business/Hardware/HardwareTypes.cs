// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Hardware;

// contracts/page-flow.md, "Hardware setup and verification".

public enum HardwareStatus { Pending, Skipped, Verified, Errored }

public enum HardwareQuality { Pending, Skipped, Clear, Intermittent, Readable, Unreadable }

public sealed record HardwareCheck(HardwareStatus Status, HardwareQuality Quality);

public enum Captions { Disabled, Enabled }

public sealed record AdvancedTrainingOptions(Captions Captions);

public abstract record Readiness
{
    private protected Readiness() { }
}

public sealed record Ready : Readiness;

public sealed record NotReady(string Reason) : Readiness;

public sealed record HardwareSetupForm(HardwareCheck Audio, HardwareCheck Video, AdvancedTrainingOptions Training)
{
    /// <summary>
    /// Start Interview is allowed when audio is verified and rated clear, intermittent or readable
    /// (specs/page-flow.md, section 2). Video is optional: skipped passes, but a video check that
    /// was run must also be verified and rated acceptably. This reading is a PROPOSAL for Steven.
    /// </summary>
    public Readiness Readiness() => Check("Audio", Audio, optional: false) switch
    {
        Ready => Check("Video", Video, optional: true),
        var notReady => notReady,
    };

    private static Readiness Check(string name, HardwareCheck check, bool optional)
    {
        if (optional && check.Status == HardwareStatus.Skipped) return new Ready();
        if (check.Status != HardwareStatus.Verified)
            return new NotReady($"{name} is {check.Status.ToString().ToLowerInvariant()}, not verified.");
        return check.Quality is HardwareQuality.Clear or HardwareQuality.Intermittent or HardwareQuality.Readable
            ? new Ready()
            : new NotReady($"{name} quality is {check.Quality.ToString().ToLowerInvariant()}.");
    }
}
