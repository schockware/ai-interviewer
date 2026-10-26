// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters;

/// <summary>How fast the mock uploader runs. Tests use <see cref="Instant"/>.</summary>
public sealed record MockUploaderOptions(TimeSpan MinStepDelay, TimeSpan MaxStepDelay, int? Seed = null)
{
    /// <summary>Slow enough to watch on the Hardware page, quick enough not to be in the way. PROPOSAL.</summary>
    public static readonly MockUploaderOptions Default = new(TimeSpan.FromMilliseconds(400), TimeSpan.FromMilliseconds(1200));

    public static readonly MockUploaderOptions Instant = new(TimeSpan.Zero, TimeSpan.Zero);
}

/// <summary>
/// Stand-in for resume processing. It invents three to six steps from a fixed pool, runs them in
/// the background with random pauses, and reports a whole snapshot after every change through
/// <see cref="IResumeUploadReporter"/>. No file is read. The first snapshot is reported before
/// <see cref="BeginAsync"/> returns, so a client that asks right after the upload finds it known.
/// Harness hook (PROPOSAL): a display name containing "fail" fails at a random step.
/// </summary>
public sealed class RandomStepsResumeUploader(IResumeUploadReporter reporter, MockUploaderOptions options, TimeProvider clock) : IResumeUploader
{
    public const string FailTrigger = "fail";

    private static readonly string[] Pool =
    [
        "Receiving the file",
        "Scanning for text",
        "Reading the layout",
        "Finding sections",
        "Extracting work history",
        "Extracting skills",
        "Matching dates",
        "Summarizing experience",
        "Checking for gaps",
        "Indexing for the interviewer",
    ];

    // A seeded Random is not thread-safe, so every draw goes through the gate.
    private readonly Random random = options.Seed is { } seed ? new Random(seed) : new Random();
    private readonly object gate = new();

    public async Task BeginAsync(ResumeId id, DisplayName name, CancellationToken ct)
    {
        var steps = PickNames().Select(n => new ResumeUploadStep(n, UploadStepStatus.Pending)).ToArray();
        var failAt = name.Value.Contains(FailTrigger, StringComparison.OrdinalIgnoreCase) ? Draw(r => r.Next(steps.Length)) : -1;
        await reporter.ReportAsync(Snapshot(id, name, ResumeUploadStatus.Running, steps), ct);
        // Fire and forget: the request's token must not cancel work the client expects to continue.
        _ = RunAsync(id, name, steps, failAt);
    }

    private async Task RunAsync(ResumeId id, DisplayName name, ResumeUploadStep[] steps, int failAt)
    {
        try
        {
            for (var i = 0; i < steps.Length; i++)
            {
                steps[i] = steps[i] with { Status = UploadStepStatus.Running };
                await reporter.ReportAsync(Snapshot(id, name, ResumeUploadStatus.Running, steps), CancellationToken.None);
                await Task.Delay(NextDelay(), clock);

                if (i == failAt)
                {
                    steps[i] = steps[i] with { Status = UploadStepStatus.Failed };
                    await reporter.ReportAsync(Snapshot(id, name, ResumeUploadStatus.Failed, steps), CancellationToken.None);
                    return;
                }

                steps[i] = steps[i] with { Status = UploadStepStatus.Done };
                var last = i == steps.Length - 1;
                await reporter.ReportAsync(Snapshot(id, name, last ? ResumeUploadStatus.Done : ResumeUploadStatus.Running, steps), CancellationToken.None);
            }
        }
        catch (Exception)
        {
            // A reporter that cannot deliver (no hub, a closed app) ends this run. Nothing here can
            // tell the client, which is the gap a real pipeline closes by recording its outcome.
        }
    }

    private static ResumeUploadProgress Snapshot(ResumeId id, DisplayName name, ResumeUploadStatus status, ResumeUploadStep[] steps) =>
        new(id, name, status, steps.ToArray()); // a copy, so a listener holds a frozen list

    /// <summary>Three to six names from the pool, in pool order.</summary>
    private string[] PickNames() => Draw(r =>
    {
        var count = r.Next(3, 7);
        return Enumerable.Range(0, Pool.Length).OrderBy(_ => r.Next()).Take(count).Order().Select(i => Pool[i]).ToArray();
    });

    private TimeSpan NextDelay() => Draw(r =>
    {
        var min = options.MinStepDelay.TotalMilliseconds;
        var max = options.MaxStepDelay.TotalMilliseconds;
        return TimeSpan.FromMilliseconds(max <= min ? min : min + r.NextDouble() * (max - min));
    });

    private T Draw<T>(Func<Random, T> draw)
    {
        lock (gate) return draw(random);
    }
}
