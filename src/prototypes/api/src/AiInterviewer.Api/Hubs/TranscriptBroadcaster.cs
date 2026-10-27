// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Collections.Concurrent;
using AiInterviewer.Api.Wire;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;
using Microsoft.AspNetCore.SignalR;

namespace AiInterviewer.Api.Hubs;

/// <summary>
/// The transcript sink that reaches the page: every piece and every failure is pushed to the
/// clients watching the session on <see cref="InterviewHub"/>, and kept, so a client that starts
/// watching late gets everything so far. In memory only: the files hold the record.
/// </summary>
public sealed class TranscriptBroadcaster(IHubContext<InterviewHub> hub) : ITranscriptSink
{
    private readonly ConcurrentDictionary<string, List<TranscriptSegmentDto>> segments = new();
    private readonly ConcurrentDictionary<string, List<TranscriptFailureDto>> failures = new();

    public static string GroupFor(string sessionId) => $"transcript:{sessionId}";

    public TranscriptSnapshotDto Snapshot(string sessionId)
    {
        var s = segments.TryGetValue(sessionId, out var list) ? list : null;
        var f = failures.TryGetValue(sessionId, out var flist) ? flist : null;
        lock (this)
            return new TranscriptSnapshotDto(s?.ToList() ?? [], f?.ToList() ?? []);
    }

    public async Task ReportAsync(TranscriptSegment segment, CancellationToken ct)
    {
        var dto = segment.ToDto();
        lock (this) segments.GetOrAdd(dto.SessionId, _ => []).Add(dto);
        await hub.Clients.Group(GroupFor(dto.SessionId)).SendAsync(InterviewHub.TranscriptSegmentMethod, dto, ct);
    }

    public async Task FailedAsync(TranscriptFailure failure, CancellationToken ct)
    {
        var dto = failure.ToDto();
        lock (this) failures.GetOrAdd(dto.SessionId, _ => []).Add(dto);
        await hub.Clients.Group(GroupFor(dto.SessionId)).SendAsync(InterviewHub.TranscriptFailedMethod, dto, ct);
    }
}
