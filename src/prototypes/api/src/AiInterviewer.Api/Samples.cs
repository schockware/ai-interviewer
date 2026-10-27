// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Adapters.Samples;

namespace AiInterviewer.Api;

/// <summary>
/// Part of the composition root: the sample personas (Steven, 2026-10-27: the resumes, job
/// descriptions and questions in <c>mocked-samples/ai-interviewer-test-personas/output</c> are to
/// be loaded for the interview). <c>Samples:Path</c> names the output folder, relative to the
/// content root; Development sets it. Empty or absent means nothing is loaded. A path that does
/// not exist stops the app at startup, never a silent run without the samples.
/// </summary>
public static class Samples
{
    public const string PathKey = "Samples:Path";

    /// <summary>The configured folder as a full path, or null when no samples are configured.</summary>
    public static string? Resolve(IConfiguration configuration, IHostEnvironment environment)
    {
        var configured = configuration[PathKey];
        return string.IsNullOrWhiteSpace(configured) ? null : Path.GetFullPath(configured, environment.ContentRootPath);
    }

    public static async Task LoadSamplesAsync(this WebApplication app)
    {
        var folder = Resolve(app.Configuration, app.Environment);
        if (folder is null) return;
        var report = await app.Services.GetRequiredService<PersonaSampleLoader>().LoadAsync(folder, app.Lifetime.ApplicationStopping);
        app.Logger.LogInformation(
            "Sample personas from {Folder}: {Roles} roles, {Sets} question sets and {Resumes} resumes added; {Skipped} personas were already loaded.",
            folder, report.RolesAdded, report.QuestionSetsAdded, report.ResumesAdded, report.PersonasAlreadyLoaded);
    }
}
