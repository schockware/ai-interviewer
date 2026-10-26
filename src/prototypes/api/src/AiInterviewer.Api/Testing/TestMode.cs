// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Adapters;
using AiInterviewer.Api.Wire;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Api.Testing;

/// <summary>
/// Test mode: a tester's request may carry <c>X-Mock-*</c> headers that give explicit mock options
/// for that request, so integration tests run fast while a UX session runs at design pace. The
/// injected options stay the defaults; the endpoint hands the header's options to the uploader for
/// that one upload (Steven, 2026-10-26). The headers are honored only while <see cref="EnabledKey"/>
/// is true on the server (on in Development, off otherwise); anywhere else they are refused with a
/// 400, never silently ignored. The client never decides the server's mode (decision 0004).
/// </summary>
public static class TestMode
{
    public const string EnabledKey = "TestMode:Enabled";

    /// <summary>Every test header starts with this; one this server does not know is refused.</summary>
    public const string HeaderPrefix = "X-Mock-";

    /// <summary>JSON <see cref="MockUploaderOptionsDto"/>: the mock resume uploader's pace for this request's upload.</summary>
    public const string MockUploaderOptionsHeader = "X-Mock-Uploader-Options";

    public const string MinStepDelayKey = "MockUploader:MinStepDelayMs";
    public const string MaxStepDelayKey = "MockUploader:MaxStepDelayMs";

    public static bool IsEnabled(IConfiguration configuration) => configuration.GetValue<bool>(EnabledKey);

    /// <summary>The defaults the uploader is built with: appsettings, else the adapter's own.</summary>
    public static ResumeUploaderOptions DefaultUploaderOptions(IConfiguration configuration)
    {
        var fallback = RandomStepsResumeUploader.DefaultOptions;
        var min = configuration.GetValue<int?>(MinStepDelayKey);
        var max = configuration.GetValue<int?>(MaxStepDelayKey);
        return new ResumeUploaderOptions(
            min is { } m ? TimeSpan.FromMilliseconds(m) : fallback.MinStepDelay,
            max is { } x ? TimeSpan.FromMilliseconds(x) : fallback.MaxStepDelay);
    }

    /// <summary>What the middleware accepted from this request's header, if it carried one.</summary>
    public static ResumeUploaderOptions? ExplicitUploaderOptions(HttpContext context) =>
        context.Items[MockUploaderOptionsHeader] as ResumeUploaderOptions;

    public static ResumeUploaderOptions ToOptions(this MockUploaderOptionsDto dto) =>
        new(TimeSpan.FromMilliseconds(dto.MinStepDelayMs), TimeSpan.FromMilliseconds(dto.MaxStepDelayMs), dto.Seed);
}
