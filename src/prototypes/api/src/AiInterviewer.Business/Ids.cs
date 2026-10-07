// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business;

// Common contracts (contracts/page-flow.md): SessionId, ResumeId, RoleId, DisplayName are
// strings on the wire. Here each is its own type so a ResumeId can never be passed as a RoleId,
// and an empty one cannot exist.

internal static class NonBlank
{
    public static Outcome<string> Check(string raw, string name) =>
        string.IsNullOrWhiteSpace(raw)
            ? Outcome.Failure<string>($"{name} must not be empty.")
            : Outcome.Success(raw.Trim());
}

public sealed record SessionId
{
    public string Value { get; }
    private SessionId(string value) => Value = value;

    public static Outcome<SessionId> From(string raw) => NonBlank.Check(raw, nameof(SessionId)) switch
    {
        Succeeded<string> ok => Outcome.Success(new SessionId(ok.Value)),
        Failed<string> bad => Outcome.Failure<SessionId>(bad.Message),
        _ => throw new InvalidOperationException(),
    };

    public override string ToString() => Value;
}

public sealed record ResumeId
{
    public string Value { get; }
    private ResumeId(string value) => Value = value;

    public static Outcome<ResumeId> From(string raw) => NonBlank.Check(raw, nameof(ResumeId)) switch
    {
        Succeeded<string> ok => Outcome.Success(new ResumeId(ok.Value)),
        Failed<string> bad => Outcome.Failure<ResumeId>(bad.Message),
        _ => throw new InvalidOperationException(),
    };

    public override string ToString() => Value;
}

public sealed record RoleId
{
    public string Value { get; }
    private RoleId(string value) => Value = value;

    public static Outcome<RoleId> From(string raw) => NonBlank.Check(raw, nameof(RoleId)) switch
    {
        Succeeded<string> ok => Outcome.Success(new RoleId(ok.Value)),
        Failed<string> bad => Outcome.Failure<RoleId>(bad.Message),
        _ => throw new InvalidOperationException(),
    };

    public override string ToString() => Value;
}

public sealed record DisplayName
{
    public string Value { get; }
    private DisplayName(string value) => Value = value;

    public static Outcome<DisplayName> From(string raw) => NonBlank.Check(raw, nameof(DisplayName)) switch
    {
        Succeeded<string> ok => Outcome.Success(new DisplayName(ok.Value)),
        Failed<string> bad => Outcome.Failure<DisplayName>(bad.Message),
        _ => throw new InvalidOperationException(),
    };

    public override string ToString() => Value;
}

public sealed record LogId
{
    public string Value { get; }
    private LogId(string value) => Value = value;

    public static LogId Generate() => new($"log-{Guid.NewGuid():N}");

    public static Outcome<LogId> From(string raw) => NonBlank.Check(raw, nameof(LogId)) switch
    {
        Succeeded<string> ok => Outcome.Success(new LogId(ok.Value)),
        Failed<string> bad => Outcome.Failure<LogId>(bad.Message),
        _ => throw new InvalidOperationException(),
    };

    public override string ToString() => Value;
}
