// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Setup;

// Progress of processing an uploaded resume (reading it, finding sections, indexing it for the
// interviewer). PROPOSAL: contracts/page-flow.md has no shape for this. The upload itself stays
// synchronous (POST /resumes answers with the id); what follows is reported step by step.

public enum UploadStepStatus { Pending, Running, Done, Failed }

public sealed record ResumeUploadStep(string Name, UploadStepStatus Status);

public enum ResumeUploadStatus { Running, Done, Failed }

/// <summary>
/// How an uploader paces one upload. The uploader is built with defaults; a test-mode request may
/// give explicit ones for its upload. A seed makes a mock run repeatable. The real pipeline may
/// have no use for these, and ignores them.
/// </summary>
public sealed record ResumeUploaderOptions(TimeSpan MinStepDelay, TimeSpan MaxStepDelay, int? Seed = null);

/// <summary>A whole snapshot every time, so a late listener needs nothing but the latest one.</summary>
public sealed record ResumeUploadProgress(
    ResumeId ResumeId,
    DisplayName DisplayName,
    ResumeUploadStatus Status,
    IReadOnlyList<ResumeUploadStep> Steps);
