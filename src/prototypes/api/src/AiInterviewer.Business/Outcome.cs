// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business;

/// <summary>
/// An explicit result. The contracts say "NULLs and NILs are evil", so a step that can
/// fail returns one of these two cases instead of null or an exception.
/// </summary>
public abstract record Outcome<T>
{
    private protected Outcome() { }
}

public sealed record Succeeded<T>(T Value) : Outcome<T>;

public sealed record Failed<T>(string Message) : Outcome<T>;

public static class Outcome
{
    public static Outcome<T> Success<T>(T value) => new Succeeded<T>(value);

    public static Outcome<T> Failure<T>(string message) => new Failed<T>(message);

    /// <summary>Continue with the next step only if this one succeeded.</summary>
    public static Outcome<TNext> Then<T, TNext>(this Outcome<T> outcome, Func<T, Outcome<TNext>> next) => outcome switch
    {
        Succeeded<T> ok => next(ok.Value),
        Failed<T> bad => Failure<TNext>(bad.Message),
        _ => throw new InvalidOperationException(),
    };

    public static Outcome<TNext> Select<T, TNext>(this Outcome<T> outcome, Func<T, TNext> map) =>
        outcome.Then(value => Success(map(value)));
}
