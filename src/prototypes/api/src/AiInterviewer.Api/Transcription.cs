// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using AiInterviewer.Adapters.Media;
using AiInterviewer.Adapters.Transcription;
using AiInterviewer.Api.Hubs;
using AiInterviewer.Api.Streams;
using AiInterviewer.Business;
using AiInterviewer.Business.Media;
using Grpc.Net.Client;

namespace AiInterviewer.Api;

/// <summary>
/// Part of the composition root: who transcribes. <c>Grpc</c> (the default) talks to the Python
/// worker at <c>Transcription:Address</c> for both passes; <c>Counting</c> keeps the stand-in that
/// counts audio and has no post-question pass, for tests and for a machine without the worker.
/// Either way the transcript reaches the page over the hub and lands in files beside the audio.
/// </summary>
public static class Transcription
{
    public const string ProviderKey = "Transcription:Provider";
    public const string AddressKey = "Transcription:Address";
    public const string Grpc = "Grpc";
    public const string Counting = "Counting";
    public const string DefaultAddress = "http://localhost:50051";

    public static IServiceCollection AddTranscription(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.AddSingleton<TranscriptBroadcaster>();
        services.AddSingleton<ITranscriptSink>(sp => sp.GetRequiredService<TranscriptBroadcaster>());
        services.AddSingleton<ITranscriptSink>(_ => new FileTranscriptStore(MediaStreams.Root(configuration, environment)));
        services.AddSingleton<PostQuestionService>();

        var provider = configuration[ProviderKey] ?? Grpc;
        switch (provider)
        {
            case Grpc:
                var address = configuration[AddressKey] ?? DefaultAddress;
                services.AddSingleton(_ => GrpcChannel.ForAddress(address));
                services.AddSingleton<IMediaSinkFactory>(sp => new GrpcRealTimeTranscriptionFeed(sp.GetRequiredService<GrpcChannel>(), sp.GetServices<ITranscriptSink>()));
                services.AddSingleton<IPostQuestionTranscriber>(sp => new GrpcPostQuestionTranscriber(sp.GetRequiredService<GrpcChannel>()));
                break;
            case Counting:
                services.AddSingleton<TranscriptionFeedLedger>();
                services.AddSingleton<IMediaSinkFactory, CountingTranscriptionFeed>();
                services.AddSingleton<IPostQuestionTranscriber, NoPostQuestionTranscriber>();
                break;
            default:
                throw new InvalidOperationException($"{ProviderKey} must be \"{Grpc}\" or \"{Counting}\", not \"{provider}\".");
        }
        return services;
    }
}
