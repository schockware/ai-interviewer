// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
namespace AiInterviewer.Business.Media;

// The media the browser streams during an interview (decision 0003: the browser sends audio over a
// WebSocket; the frame format is open item 1). PROPOSAL: two tracks, each its own stream. The audio
// track is kept apart so the post-question transcription reads clean audio; the composite carries
// video with its audio for the record.

public enum MediaTrack { Audio, Composite }

/// <summary>One track's stream, as it begins. The MIME type is what the browser's recorder produces (for example audio/webm;codecs=opus).</summary>
public sealed record MediaTrackOpened(SessionId Session, MediaTrack Track, string MimeType, DateTimeOffset StartedAt);

/// <summary>One piece of a track, in order. Bytes are the recorder's, untouched; the first chunk carries the container header.</summary>
public sealed record MediaChunk(SessionId Session, MediaTrack Track, long Sequence, ReadOnlyMemory<byte> Bytes, DateTimeOffset ReceivedAt);
