// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Business.Media;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Business;

// Ports: what the business module needs, stated in its own terms. Adapters implement them
// (decision 0003: the business module names no framework, transport, model runtime or storage).

/// <summary>A collaborator could not be reached. The use case turns this into an explicit error state.</summary>
public sealed class PortUnavailableException(string message) : Exception(message);

public sealed record StoredDocument<TId>(TId Id, DisplayName Name, DateTimeOffset ProcessedAt, string Text);

public interface IDocumentStore<TId>
{
    /// <summary>Most recently processed first, as the setup page lists them.</summary>
    Task<IReadOnlyList<StoredDocument<TId>>> ListAsync(CancellationToken ct);

    Task<bool> ContainsAsync(TId id, CancellationToken ct);

    Task<TId> AddAsync(DisplayName name, string text, DateTimeOffset processedAt, CancellationToken ct);
}

public interface IResumeStore : IDocumentStore<ResumeId>;

public interface IRoleStore : IDocumentStore<RoleId>;

/// <summary>Turns an uploaded file into text. The real one will parse PDF and Word files.</summary>
public interface IDocumentReader
{
    Task<Outcome<string>> ReadAsync(UploadedFile file, CancellationToken ct);
}

public enum PreparationStatus { Preparing, Ok, Error }

public sealed record InterviewSession(SessionId Id, ApplicationSetupForm Form, PreparationStatus Status, LogId LogId);

public interface ISessionStore
{
    /// <summary>Insert, or replace when the same session is prepared again (a retry).</summary>
    Task SaveAsync(InterviewSession session, CancellationToken ct);

    Task<Outcome<InterviewSession>> FindAsync(SessionId id, CancellationToken ct);
}

/// <summary>Builds the interview from the role and resume. Completion is recorded in the session store.</summary>
public interface IInterviewPreparer
{
    Task BeginAsync(InterviewSession session, CancellationToken ct);
}

/// <summary>Asks the existing models to explain a failed preparation in terms the user can act on.</summary>
public interface IPreparationDiagnoser
{
    Task<string> DiagnoseAsync(InterviewSession session, CancellationToken ct);
}

/// <summary>
/// Processes a stored resume after its upload (reading, sectioning, indexing). Returns once
/// processing has begun and its first progress is reported; the rest reaches the client through
/// <see cref="IResumeUploadReporter"/>.
/// </summary>
public interface IResumeUploader
{
    /// <summary>With the uploader's default options.</summary>
    Task BeginAsync(ResumeId id, DisplayName name, CancellationToken ct);

    /// <summary>With explicit options for this upload only (test mode).</summary>
    Task BeginAsync(ResumeId id, DisplayName name, ResumeUploaderOptions options, CancellationToken ct);
}

/// <summary>How resume processing progress reaches the client. The transport is the adapter's business.</summary>
public interface IResumeUploadReporter
{
    Task ReportAsync(ResumeUploadProgress progress, CancellationToken ct);
}

/// <summary>
/// One consumer of one track stream: a file, the transcription service. The ingest opens it when
/// the stream begins, hands it every chunk in order from its own channel, and completes it when
/// the stream ends.
/// </summary>
public interface IMediaSink
{
    Task OpenAsync(MediaTrackOpened track, CancellationToken ct);

    Task WriteAsync(MediaChunk chunk, CancellationToken ct);

    Task CompleteAsync(CancellationToken ct);
}

/// <summary>Makes a sink for each track stream it wants. The file store wants both tracks; the transcription feed wants audio only.</summary>
public interface IMediaSinkFactory
{
    bool Wants(MediaTrack track);

    IMediaSink Create();
}

/// <summary>Where transcript pieces and failures go: the page, a file. Several may be registered; each gets everything.</summary>
public interface ITranscriptSink
{
    Task ReportAsync(TranscriptSegment segment, CancellationToken ct);

    Task FailedAsync(TranscriptFailure failure, CancellationToken ct);
}

/// <summary>The large model over a question's finished audio file, which both processes can read. Throws when it cannot run.</summary>
public interface IPostQuestionTranscriber
{
    IAsyncEnumerable<TranscriptSegment> TranscribeAsync(MediaTrackOpened track, string audioPath, CancellationToken ct);
}
