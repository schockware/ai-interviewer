// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
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
