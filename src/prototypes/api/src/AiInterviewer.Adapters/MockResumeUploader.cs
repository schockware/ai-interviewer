// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters;

/// <summary>
/// Stand-in for resume processing. It invents three to six steps from a fixed pool, runs them in
/// the background with random pauses, and reports a whole snapshot after every change through
/// <see cref="IResumeUploadReporter"/>. No file is read. The first snapshot is reported before
/// BeginAsync returns, so a client that asks right after the upload finds it known.
/// The injected options are the defaults; an upload may bring its own (test mode), which
/// apply to that upload only. Harness hook (PROPOSAL): a display name containing "fail" fails
/// at a random step.
/// </summary>
public sealed class RandomStepsResumeUploader(IResumeUploadReporter reporter, ResumeUploaderOptions defaults, TimeProvider clock) : IResumeUploader
{
    public const string FailTrigger = "fail";

    /// <summary>Three to eight seconds a step, so the UI design can be worked on while it runs (Steven, 2026-10-26).</summary>
    public static readonly ResumeUploaderOptions DefaultOptions = new(TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(8));

    public static readonly ResumeUploaderOptions InstantOptions = new(TimeSpan.Zero, TimeSpan.Zero);

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

    // Shared across uploads, so it is guarded; a seeded Random is not thread-safe.
    private readonly Random shared = new();
    private readonly object gate = new();

    public Task BeginAsync(ResumeId id, DisplayName name, CancellationToken ct) => BeginAsync(id, name, defaults, ct);

    public async Task BeginAsync(ResumeId id, DisplayName name, ResumeUploaderOptions options, CancellationToken ct)
    {
        // A seeded run draws from its own Random, so the same seed gives the same steps and pauses.
        var random = options.Seed is { } seed ? new Random(seed) : shared;
        var steps = PickNames(random).Select(n => new ResumeUploadStep(n, UploadStepStatus.Pending)).ToArray();
        var failAt = name.Value.Contains(FailTrigger, StringComparison.OrdinalIgnoreCase) ? Draw(random, r => r.Next(steps.Length)) : -1;
        await reporter.ReportAsync(Snapshot(id, name, ResumeUploadStatus.Running, steps), ct);
        // Fire and forget: the request's token must not cancel work the client expects to continue.
        _ = RunAsync(id, name, steps, failAt, options, random);
    }

    private async Task RunAsync(ResumeId id, DisplayName name, ResumeUploadStep[] steps, int failAt, ResumeUploaderOptions options, Random random)
    {
        try
        {
            for (var i = 0; i < steps.Length; i++)
            {
                steps[i] = steps[i] with { Status = UploadStepStatus.Running };
                await reporter.ReportAsync(Snapshot(id, name, ResumeUploadStatus.Running, steps), CancellationToken.None);
                await Task.Delay(NextDelay(options, random), clock);

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
    private string[] PickNames(Random random) => Draw(random, r =>
    {
        var count = r.Next(3, 7);
        return Enumerable.Range(0, Pool.Length).OrderBy(_ => r.Next()).Take(count).Order().Select(i => Pool[i]).ToArray();
    });

    private TimeSpan NextDelay(ResumeUploaderOptions options, Random random) => Draw(random, r =>
    {
        var min = options.MinStepDelay.TotalMilliseconds;
        var max = options.MaxStepDelay.TotalMilliseconds;
        return TimeSpan.FromMilliseconds(max <= min ? min : min + r.NextDouble() * (max - min));
    });

    private T Draw<T>(Random random, Func<Random, T> draw)
    {
        lock (gate) return draw(random);
    }
}
