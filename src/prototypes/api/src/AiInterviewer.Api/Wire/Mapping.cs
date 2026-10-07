// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Business;
using AiInterviewer.Business.Hardware;
using AiInterviewer.Business.Interview;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Api.Wire;

/// <summary>Converts between wire shapes and business types. Anything that can be invalid returns an Outcome.</summary>
public static class Mapping
{
    private const string UnansweredRoleFocus = "unanswered";

    // ---- wire -> business ----

    public static SlotChoice ToBusiness(this SlotChoiceDto dto) => dto switch
    {
        NamedChoiceDto named => new NamedChoice(named.Name),
        CustomLocalChoiceDto => new CustomLocalChoice(),
        CloudChoiceDto => new CloudChoice(),
        _ => throw new InvalidOperationException($"Unknown slot choice {dto.GetType().Name}."),
    };

    public static AiSlots ToBusiness(this AiSlotsDto dto) => new(
        dto.Listener.ToBusiness(),
        dto.Transcriber.ToBusiness(),
        dto.FollowUp.ToBusiness(),
        dto.Interviewer.ToBusiness(),
        dto.Evaluator.ToBusiness(),
        dto.Speaker.ToBusiness());

    public static Outcome<InterviewType> ToBusiness(this InterviewTypeDto dto) => dto switch
    {
        ColdInterviewDto => Outcome.Success<InterviewType>(new ColdInterview()),
        HotIncompleteToColdDto => Outcome.Success<InterviewType>(new HotIncompleteToCold()),
        HotInterviewDto hot => ResumeId.From(hot.ResumeId).Select<ResumeId, InterviewType>(id => new HotInterview(id)),
        _ => throw new InvalidOperationException($"Unknown interview type {dto.GetType().Name}."),
    };

    public static Outcome<RoleFocus> ToRoleFocus(string wire) =>
        wire == UnansweredRoleFocus
            ? Outcome.Success<RoleFocus>(new UnansweredRole())
            : RoleId.From(wire).Select<RoleId, RoleFocus>(id => new AnsweredRole(id));

    public static Outcome<ApplicationSetupForm> ToBusiness(this ApplicationSetupFormDto dto) =>
        dto.InterviewType.ToBusiness().Then(type =>
            ToRoleFocus(dto.RoleFocus).Select(focus => new ApplicationSetupForm(dto.Ai.ToBusiness(), type, focus)));

    public static HardwareSetupForm ToBusiness(this HardwareSetupFormDto dto) => new(
        new HardwareCheck(dto.Audio.Status, dto.Audio.Quality),
        new HardwareCheck(dto.Video.Status, dto.Video.Quality),
        new AdvancedTrainingOptions(dto.Training.Captions));

    // ---- business -> wire ----

    public static SlotChoiceDto ToDto(this SlotChoice choice) => choice switch
    {
        NamedChoice named => new NamedChoiceDto(named.Name),
        CustomLocalChoice => new CustomLocalChoiceDto(),
        CloudChoice => new CloudChoiceDto(),
        _ => throw new InvalidOperationException($"Unknown slot choice {choice.GetType().Name}."),
    };

    public static AiSlotsDto ToDto(this AiSlots ai) => new(
        ai.Listener.ToDto(),
        ai.Transcriber.ToDto(),
        ai.FollowUp.ToDto(),
        ai.Interviewer.ToDto(),
        ai.Evaluator.ToDto(),
        ai.Speaker.ToDto());

    public static InterviewTypeDto ToDto(this InterviewType type) => type switch
    {
        ColdInterview => new ColdInterviewDto(),
        HotIncompleteToCold => new HotIncompleteToColdDto(),
        HotInterview hot => new HotInterviewDto(hot.ResumeId.Value),
        _ => throw new InvalidOperationException($"Unknown interview type {type.GetType().Name}."),
    };

    public static ApplicationSetupFormDto ToDto(this ApplicationSetupForm form) => new(
        form.Ai.ToDto(),
        form.InterviewType.ToDto(),
        form.RoleFocus switch
        {
            UnansweredRole => UnansweredRoleFocus,
            AnsweredRole answered => answered.RoleId.Value,
            _ => throw new InvalidOperationException($"Unknown role focus {form.RoleFocus.GetType().Name}."),
        });

    public static LoadedDocumentsDto ToDto<TId>(this LoadedDocuments<TId> documents, Func<TId, string> idOf) => documents switch
    {
        NoDocuments<TId> => new NoDocumentsDto(),
        ReadyDocuments<TId> ready => new ReadyDocumentsDto(
            ready.All.Select(d => new[] { idOf(d.Id), d.Name.Value }).ToList()),
        _ => throw new InvalidOperationException($"Unknown documents {documents.GetType().Name}."),
    };

    public static ApplicationSetupPageDto ToDto(this ApplicationSetupPage page) => page switch
    {
        LoadingPage => new LoadingPageDto(),
        ErrorPage error => new ErrorPageDto(error.Message),
        ReadyPage ready => new ReadyPageDto(
            ready.Form.ToDto(),
            ready.Resumes.ToDto(id => id.Value),
            ready.Roles.ToDto(id => id.Value)),
        _ => throw new InvalidOperationException($"Unknown page {page.GetType().Name}."),
    };

    public static CueSettingsDto ToDto(this CueSettings settings) => new(new EmulationDto(
        new CadencesDto(
            settings.Cadences.Speaking.Value,
            settings.Cadences.Listening.Value,
            settings.Cadences.Thinking.Value,
            new VariancesDto(settings.Cadences.Variances.Floor, settings.Cadences.Variances.Ceiling)),
        new LatenciesDto(
            settings.Latencies.Network.Value,
            settings.Latencies.PacketLossVariancePerSecond,
            settings.Latencies.AudioRamp)));
}
