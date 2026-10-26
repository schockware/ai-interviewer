// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Collections.Concurrent;
using AiInterviewer.Api.Wire;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;
using Microsoft.AspNetCore.SignalR;

namespace AiInterviewer.Api.Hubs;

/// <summary>
/// The adapter behind <see cref="IResumeUploadReporter"/>: every report is pushed to the clients
/// watching that resume on <see cref="InterviewHub"/>, and the latest snapshot is kept so a client
/// that starts watching late gets it at once. Kept in memory on purpose: progress is transient,
/// and a restart loses it along with the mock run it describes.
/// </summary>
public sealed class ResumeUploadBroadcaster(IHubContext<InterviewHub> hub) : IResumeUploadReporter
{
    private readonly ConcurrentDictionary<string, ResumeUploadProgressDto> latest = new();

    public static string GroupFor(string resumeId) => $"resume-upload:{resumeId}";

    /// <summary>The latest snapshot for a resume, or null when this server never processed it.</summary>
    public ResumeUploadProgressDto? Latest(string resumeId) => latest.TryGetValue(resumeId, out var progress) ? progress : null;

    public async Task ReportAsync(ResumeUploadProgress progress, CancellationToken ct)
    {
        var dto = progress.ToDto();
        latest[dto.ResumeId] = dto;
        await hub.Clients.Group(GroupFor(dto.ResumeId)).SendAsync(InterviewHub.ResumeUploadProgressMethod, dto, ct);
    }
}
