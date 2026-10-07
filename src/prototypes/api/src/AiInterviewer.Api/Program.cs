// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using System.Text.Json.Serialization;
using AiInterviewer.Adapters;
using AiInterviewer.Api;
using AiInterviewer.Api.Hubs;
using AiInterviewer.Business;
using AiInterviewer.Business.Interview;
using AiInterviewer.Business.Setup;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    var json = options.SerializerOptions;
    json.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    json.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    // Enums travel as the contract's lowercase, hyphenated strings ("clipped-ending"), never as numbers.
    json.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, allowIntegerValues: false));
    // Explicit declarations only: a missing or null required field is a 400, not a silent default.
    json.RespectNullableAnnotations = true;
    json.RespectRequiredConstructorParameters = true;
    json.AllowOutOfOrderMetadataProperties = true;
    json.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
});

builder.Services.AddOpenApi();
builder.Services.AddSignalR();

// Composition root: the only place that knows which adapter implements which port.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IResumeStore, InMemoryResumeStore>();
builder.Services.AddSingleton<IRoleStore, InMemoryRoleStore>();
builder.Services.AddSingleton<ISessionStore, InMemorySessionStore>();
builder.Services.AddSingleton<IDocumentReader, PlainTextDocumentReader>();
builder.Services.AddSingleton<IInterviewPreparer, InstantInterviewPreparer>();
builder.Services.AddSingleton<IPreparationDiagnoser, CannedPreparationDiagnoser>();
builder.Services.AddSingleton<ApplicationSetupService>();
builder.Services.AddSingleton<InterviewService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    // A probe for developers; it must not exist in a real deployment.
    app.MapHub<TestHub>(TestHub.Route);
}

app.MapPageFlow();

app.Run();

// Lets the test project start the app in memory.
public partial class Program;
