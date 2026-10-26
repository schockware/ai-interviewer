// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using AiInterviewer.Api.Wire;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;

namespace AiInterviewer.Api.Testing;

/// <summary>
/// Reads the <c>X-Mock-*</c> headers before any endpoint runs. A request without them passes
/// untouched. With them: test mode must be on, every header must be one this server knows, and
/// its JSON must parse and make sense; otherwise the answer is a 400 with the reason. What was
/// accepted is left in <see cref="HttpContext.Items"/> for the scoped options to pick up.
/// </summary>
public sealed class TestModeMiddleware(RequestDelegate next, IConfiguration configuration, IOptions<JsonOptions> json)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var testHeaders = context.Request.Headers
            .Where(h => h.Key.StartsWith(TestMode.HeaderPrefix, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (testHeaders.Count == 0)
        {
            await next(context);
            return;
        }

        if (!TestMode.IsEnabled(configuration))
        {
            await Refuse(context, $"Test headers ({string.Join(", ", testHeaders.Select(h => h.Key))}) are not accepted: test mode is off on this server ({TestMode.EnabledKey}).");
            return;
        }

        foreach (var (name, value) in testHeaders)
        {
            if (!name.Equals(TestMode.MockUploaderOptionsHeader, StringComparison.OrdinalIgnoreCase))
            {
                await Refuse(context, $"Unknown test header \"{name}\". Known: {TestMode.MockUploaderOptionsHeader}.");
                return;
            }

            MockUploaderOptionsDto? options;
            try
            {
                options = JsonSerializer.Deserialize<MockUploaderOptionsDto>(value.ToString(), json.Value.SerializerOptions);
            }
            catch (JsonException e)
            {
                await Refuse(context, $"{TestMode.MockUploaderOptionsHeader} is not valid: {e.Message}");
                return;
            }
            if (options is null)
            {
                await Refuse(context, $"{TestMode.MockUploaderOptionsHeader} is empty.");
                return;
            }
            if (options.MinStepDelayMs < 0 || options.MaxStepDelayMs < options.MinStepDelayMs)
            {
                await Refuse(context, $"{TestMode.MockUploaderOptionsHeader}: minStepDelayMs must be 0 or more and no more than maxStepDelayMs.");
                return;
            }
            context.Items[TestMode.MockUploaderOptionsHeader] = options.ToOptions();
        }

        await next(context);
    }

    private static Task Refuse(HttpContext context, string message)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return context.Response.WriteAsJsonAsync(new ErrorDto(message));
    }
}
