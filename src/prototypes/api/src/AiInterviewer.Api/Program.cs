// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Adapters;
using AiInterviewer.Adapters.Media;
using AiInterviewer.Api;
using AiInterviewer.Api.Hubs;
using AiInterviewer.Api.Streams;
using AiInterviewer.Api.Testing;
using AiInterviewer.Api.Wire;
using AiInterviewer.Business;
using AiInterviewer.Business.Interview;
using AiInterviewer.Business.Media;
using AiInterviewer.Business.Setup;

var builder = WebApplication.CreateBuilder(args);

// The HTTP endpoints and the SignalR hubs speak the same JSON (Wire/WireJson.cs).
builder.Services.ConfigureHttpJsonOptions(options => WireJson.Configure(options.SerializerOptions));
builder.Services.AddOpenApi();
builder.Services.AddSignalR().AddJsonProtocol(options => WireJson.Configure(options.PayloadSerializerOptions));

// Which browser origins may call this API directly. Development names the UI prototype's dev
// server (appsettings.Development.json); the UI's own /api proxy needs none of this. Not a secret:
// origins are public addresses. An empty list allows no cross-origin caller at all.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

// Composition root: the only place that knows which adapter implements which port.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddStorage(builder.Configuration, builder.Environment);
builder.Services.AddSingleton<IDocumentReader, PlainTextDocumentReader>();
builder.Services.AddSingleton<IInterviewPreparer, InstantInterviewPreparer>();
builder.Services.AddSingleton<IPreparationDiagnoser, CannedPreparationDiagnoser>();
// Resume processing is a mock that invents steps; its progress goes out over the InterviewHub.
// The injected options are its defaults (configuration, else the adapter's own). In test mode a
// request's X-Mock-Uploader-Options header gives explicit options, which the endpoint hands to
// the uploader for that upload only (Testing/TestMode.cs).
builder.Services.AddSingleton(TestMode.DefaultUploaderOptions(builder.Configuration));
builder.Services.AddSingleton<IResumeUploader, RandomStepsResumeUploader>();
builder.Services.AddSingleton<ResumeUploadBroadcaster>();
builder.Services.AddSingleton<IResumeUploadReporter>(services => services.GetRequiredService<ResumeUploadBroadcaster>());
builder.Services.AddSingleton<ApplicationSetupService>();
builder.Services.AddSingleton<InterviewService>();
// Media streams: every track goes to a file; the audio track also to the transcription feed,
// which is a counting stand-in until the Python service exists (TASKS.MD). The ingest fans out
// over bounded channels (Business/Media/MediaIngestService.cs).
builder.Services.AddSingleton<IMediaSinkFactory>(_ => new FileMediaStore(MediaStreams.Root(builder.Configuration, builder.Environment)));
builder.Services.AddSingleton<TranscriptionFeedLedger>();
builder.Services.AddSingleton<IMediaSinkFactory, CountingTranscriptionFeed>();
builder.Services.AddSingleton<MediaIngestService>();

var app = builder.Build();

// Opens the database now, so a bad Storage path fails at startup and not on the first request.
app.Services.GetRequiredService<ISessionStore>();

app.UseCors();
// Test headers are read, checked and either applied or refused before any endpoint runs.
app.UseMiddleware<TestModeMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // A probe for developers; it must not exist in a real deployment.
    app.MapHub<TestHub>(TestHub.Route);
}

app.MapPageFlow();
app.MapHub<InterviewHub>(InterviewHub.Route);
// The media streams ride plain WebSockets (Steven, 2026-10-26), not SignalR.
app.UseWebSockets();
app.MapMediaStreams();

app.Run();

// Lets the test project start the app in memory.
public partial class Program;
