// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Setup;

// contracts/page-flow.md, "Application setup".

public enum Slot { Listener, Transcriber, FollowUp, Interviewer, Evaluator, Speaker }

/// <summary>One AI slot's selection: a named built-in, a custom local model, or a cloud integration.</summary>
public abstract record SlotChoice
{
    private protected SlotChoice() { }
}

public sealed record NamedChoice(string Name) : SlotChoice;

/// <summary>{custom-local}. Needs advanced settings. Its shape is not defined in the contract yet.</summary>
public sealed record CustomLocalChoice : SlotChoice;

/// <summary>{cloud}. Supported integrations only. Its shape is not defined in the contract yet.</summary>
public sealed record CloudChoice : SlotChoice;

public sealed record AiSlots(
    SlotChoice Listener,
    SlotChoice Transcriber,
    SlotChoice FollowUp,
    SlotChoice Interviewer,
    SlotChoice Evaluator,
    SlotChoice Speaker)
{
    public SlotChoice For(Slot slot) => slot switch
    {
        Slot.Listener => Listener,
        Slot.Transcriber => Transcriber,
        Slot.FollowUp => FollowUp,
        Slot.Interviewer => Interviewer,
        Slot.Evaluator => Evaluator,
        Slot.Speaker => Speaker,
        _ => throw new ArgumentOutOfRangeException(nameof(slot)),
    };
}

public abstract record InterviewType
{
    private protected InterviewType() { }
}

public sealed record ColdInterview : InterviewType;

public sealed record HotIncompleteToCold : InterviewType;

public sealed record HotInterview(ResumeId ResumeId) : InterviewType;

public abstract record RoleFocus
{
    private protected RoleFocus() { }
}

public sealed record UnansweredRole : RoleFocus;

public sealed record AnsweredRole(RoleId RoleId) : RoleFocus;

public sealed record ApplicationSetupForm(AiSlots Ai, InterviewType InterviewType, RoleFocus RoleFocus)
{
    /// <summary>The form as first shown: every "default" option, a cold interview, no role yet.</summary>
    public static ApplicationSetupForm Initial { get; } = new(
        new AiSlots(
            Listener: new NamedChoice("default"),
            Transcriber: new NamedChoice("default"),
            FollowUp: new NamedChoice("interviewer"),
            Interviewer: new NamedChoice("default"),
            Evaluator: new NamedChoice("interviewer"),
            Speaker: new NamedChoice("default")),
        new ColdInterview(),
        new UnansweredRole());
}

public sealed record DocumentSummary<TId>(TId Id, DisplayName Name);

public abstract record LoadedDocuments<TId>
{
    private protected LoadedDocuments() { }
}

public sealed record NoDocuments<TId> : LoadedDocuments<TId>;

public sealed record ReadyDocuments<TId>(IReadOnlyList<DocumentSummary<TId>> All) : LoadedDocuments<TId>;

public abstract record ApplicationSetupPage
{
    private protected ApplicationSetupPage() { }
}

public sealed record LoadingPage : ApplicationSetupPage;

public sealed record ErrorPage(string Message) : ApplicationSetupPage;

public sealed record ReadyPage(
    ApplicationSetupForm Form,
    LoadedDocuments<ResumeId> Resumes,
    LoadedDocuments<RoleId> Roles) : ApplicationSetupPage;

public sealed record ResumeProcessed(ResumeId ResumeId, DisplayName DisplayName);

public sealed record JobDescriptionProcessed(RoleId RoleId, DisplayName DisplayName);

/// <summary>An uploaded file: explicit name and bytes, never null.</summary>
public sealed record UploadedFile(string FileName, ReadOnlyMemory<byte> Payload);
