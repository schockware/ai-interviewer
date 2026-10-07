// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json.Serialization;
using AiInterviewer.Business.Hardware;
using AiInterviewer.Business.Interview;

namespace AiInterviewer.Api.Wire;

// Wire shapes for contracts/page-flow.md (OpenAPI 3.1 section). These are the only types that
// carry JSON attributes. Business types never do, so the transport can change without touching them.
// Unions use a "type" discriminator, as the contract does.

public sealed record ErrorDto(string Message);

// ---- Slot choices: a string for a named option, or { "type": "custom-local" | "cloud" } ----
// The object shapes are a PROPOSAL: the contract leaves {custom-local} and {cloud} undefined.

[JsonConverter(typeof(SlotChoiceDtoConverter))]
public abstract record SlotChoiceDto;

public sealed record NamedChoiceDto(string Name) : SlotChoiceDto;

public sealed record CustomLocalChoiceDto : SlotChoiceDto;

public sealed record CloudChoiceDto : SlotChoiceDto;

public sealed record AiSlotsDto(
    SlotChoiceDto Listener,
    SlotChoiceDto Transcriber,
    SlotChoiceDto FollowUp,
    SlotChoiceDto Interviewer,
    SlotChoiceDto Evaluator,
    SlotChoiceDto Speaker);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ColdInterviewDto), "cold")]
[JsonDerivedType(typeof(HotIncompleteToColdDto), "hot-incomplete=>cold")]
[JsonDerivedType(typeof(HotInterviewDto), "hot")]
public abstract record InterviewTypeDto;

public sealed record ColdInterviewDto : InterviewTypeDto;

public sealed record HotIncompleteToColdDto : InterviewTypeDto;

public sealed record HotInterviewDto(string ResumeId) : InterviewTypeDto;

/// <param name="RoleFocus">"unanswered", or a RoleId. A RoleId spelled "unanswered" is therefore not possible.</param>
public sealed record ApplicationSetupFormDto(AiSlotsDto Ai, InterviewTypeDto InterviewType, string RoleFocus);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(NoDocumentsDto), "none")]
[JsonDerivedType(typeof(ReadyDocumentsDto), "ready")]
public abstract record LoadedDocumentsDto;

public sealed record NoDocumentsDto : LoadedDocumentsDto;

/// <param name="All">Each entry is [id, displayName], as the contract's Array&lt;[Id, DisplayName]&gt;.</param>
public sealed record ReadyDocumentsDto(List<string[]> All) : LoadedDocumentsDto;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(LoadingPageDto), "loading")]
[JsonDerivedType(typeof(ErrorPageDto), "error")]
[JsonDerivedType(typeof(ReadyPageDto), "ready")]
public abstract record ApplicationSetupPageDto;

public sealed record LoadingPageDto : ApplicationSetupPageDto;

public sealed record ErrorPageDto(string Message) : ApplicationSetupPageDto;

public sealed record ReadyPageDto(ApplicationSetupFormDto Form, LoadedDocumentsDto Resumes, LoadedDocumentsDto Roles)
    : ApplicationSetupPageDto;

// ---- Requests and responses ----

/// <param name="Payload">Base64 on the wire (OpenAPI format: byte).</param>
public sealed record UploadResumeRequest(string DisplayName, string FileName, byte[] Payload);

public sealed record ResumeProcessedDto(string ResumeId, string DisplayName);

public sealed record JobDescriptionUploadRequest(string DisplayName, string FileName, byte[] Payload);

public sealed record JobDescriptionPasteRequest(string DisplayName, string Text);

public sealed record JobDescriptionProcessedDto(string RoleId, string DisplayName);

public sealed record PrepareInterviewRequest(ApplicationSetupFormDto Form, string SessionId);

public sealed record CheckErroredInterviewRequest(string SessionId, string LogId);

public sealed record HardwareCheckDto(HardwareStatus Status, HardwareQuality Quality);

public sealed record AdvancedTrainingOptionsDto(Captions Captions);

public sealed record HardwareSetupFormDto(HardwareCheckDto Audio, HardwareCheckDto Video, AdvancedTrainingOptionsDto Training);

public sealed record StartInterviewRequest(HardwareSetupFormDto Form, string SessionId);

public sealed record VariancesDto(double Floor, double Ceiling);

public sealed record CadencesDto(int Speaking, int Listening, int Thinking, VariancesDto Variances);

public sealed record LatenciesDto(int Network, double PacketLossVariancePerSecond, AudioRamp AudioRamp);

public sealed record EmulationDto(CadencesDto Cadences, LatenciesDto Latencies);

public sealed record CueSettingsDto(EmulationDto Emulation);
