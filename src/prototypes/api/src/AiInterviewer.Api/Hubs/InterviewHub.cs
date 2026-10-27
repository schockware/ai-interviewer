// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Api.Wire;
using Microsoft.AspNetCore.SignalR;

namespace AiInterviewer.Api.Hubs;

/// <summary>
/// The real-time channel to the client for one interview session (decision 0003). It carries
/// resume upload progress and the transcript. Session management is not designed yet, so a
/// client names what it wants to watch and joins a group for it; there is no per-session identity.
/// </summary>
public sealed class InterviewHub(ResumeUploadBroadcaster uploads, TranscriptBroadcaster transcripts) : Hub
{
    public const string Route = "/hubs/interview";

    /// <summary>The client method that receives a <see cref="ResumeUploadProgressDto"/> after every change.</summary>
    public const string ResumeUploadProgressMethod = "resumeUploadProgress";

    /// <summary>The client method that receives each <see cref="TranscriptSegmentDto"/> as a pass says it.</summary>
    public const string TranscriptSegmentMethod = "transcriptSegment";

    /// <summary>The client method that receives a <see cref="TranscriptFailureDto"/> when a pass cannot run.</summary>
    public const string TranscriptFailedMethod = "transcriptFailed";

    /// <summary>
    /// Starts watching a session's transcript, both passes. Returns everything said so far, which
    /// may be nothing yet; every later piece arrives on <see cref="TranscriptSegmentMethod"/> and
    /// a pass that cannot run on <see cref="TranscriptFailedMethod"/>.
    /// </summary>
    public async Task<TranscriptSnapshotDto> WatchTranscript(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId)) throw new HubException("sessionId must not be empty.");
        await Groups.AddToGroupAsync(Context.ConnectionId, TranscriptBroadcaster.GroupFor(sessionId));
        return transcripts.Snapshot(sessionId);
    }

    /// <summary>
    /// Starts watching a resume's processing. Returns what is known right now, so nothing is lost
    /// between the upload answering and this call; every later snapshot arrives on
    /// <see cref="ResumeUploadProgressMethod"/>. A resume this server never processed is refused.
    /// </summary>
    public async Task<ResumeUploadProgressDto> WatchResumeUpload(string resumeId)
    {
        if (string.IsNullOrWhiteSpace(resumeId)) throw new HubException("resumeId must not be empty.");
        if (uploads.Latest(resumeId) is not { } known) throw new HubException($"No resume upload is known for \"{resumeId}\".");

        await Groups.AddToGroupAsync(Context.ConnectionId, ResumeUploadBroadcaster.GroupFor(resumeId));
        // Read again after joining: a snapshot sent in between was missed, but snapshots are whole, so the latest covers it.
        return uploads.Latest(resumeId) ?? known;
    }
}
