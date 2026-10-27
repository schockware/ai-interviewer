// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
using System.Text.Json;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters.Samples;

public sealed record SampleLoadReport(int RolesAdded, int ResumesAdded, int QuestionSetsAdded, int PersonasAlreadyLoaded);

/// <summary>
/// Loads the synthetic test personas in <c>mocked-samples/ai-interviewer-test-personas/output</c>
/// into the stores: each persona's job description becomes a role (the role title is its name, the
/// job description its description), the question bank's core questions for that persona become
/// the role's questions, and the persona's resume becomes a saved resume. Follow-ups, triggers and
/// accommodation profiles are not loaded. Loading is keyed by persona id, so running it again adds
/// nothing. The files are data from the samples folder and are read, never executed.
/// </summary>
public sealed class PersonaSampleLoader(IResumeStore resumes, IRoleStore roles, IQuestionStore questions, TimeProvider clock)
{
    public const string ProfilesFile = "profiles.json";
    public const string QuestionBankFile = "questions/question_bank.json";

    public async Task<SampleLoadReport> LoadAsync(string outputFolder, CancellationToken ct)
    {
        var root = Path.GetFullPath(outputFolder);
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException($"The samples folder {root} does not exist.");
        var personas = ReadProfiles(Path.Combine(root, ProfilesFile));
        var bank = ReadQuestionBank(Path.Combine(root, QuestionBankFile));

        var report = new SampleLoadReport(0, 0, 0, 0);
        var now = clock.GetUtcNow();
        for (var i = 0; i < personas.Count; i++)
        {
            var persona = personas[i];
            // Listed newest first elsewhere, so the earlier personas get the later stamps and keep the bank's order.
            var at = now.AddSeconds(-i);
            var loaded = false;

            if (!await roles.ContainsSourceAsync(persona.RoleSource, ct))
            {
                var roleId = await roles.AddAsync(persona.RoleTitle, ReadUnder(root, persona.JobDescriptionFile), at, persona.RoleSource, ct);
                report = report with { RolesAdded = report.RolesAdded + 1 };
                if (bank.TryGetValue(persona.Id, out var core) && core.Count > 0)
                {
                    await questions.ActivateAsync(await questions.AddSetAsync(roleId, QuestionSource.Sample, core, at, ct), ct);
                    report = report with { QuestionSetsAdded = report.QuestionSetsAdded + 1 };
                }
                loaded = true;
            }

            if (!await resumes.ContainsSourceAsync(persona.ResumeSource, ct))
            {
                await resumes.AddAsync(persona.ResumeName, ReadUnder(root, persona.ResumeFile), at, persona.ResumeSource, ct);
                report = report with { ResumesAdded = report.ResumesAdded + 1 };
                loaded = true;
            }

            if (!loaded) report = report with { PersonasAlreadyLoaded = report.PersonasAlreadyLoaded + 1 };
        }
        return report;
    }

    private sealed record Persona(string Id, DisplayName RoleTitle, DisplayName ResumeName, string JobDescriptionFile, string ResumeFile, DocumentSource RoleSource, DocumentSource ResumeSource);

    private static List<Persona> ReadProfiles(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException($"The samples folder has no {ProfilesFile}.", path);
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        if (document.RootElement.ValueKind != JsonValueKind.Array) throw new InvalidDataException($"{ProfilesFile} is not an array.");
        var personas = new List<Persona>();
        foreach (var element in document.RootElement.EnumerateArray())
        {
            var id = Text(element, "id", ProfilesFile);
            var name = Text(element, "name", id);
            var role = Text(element, "role", id);
            if (!element.TryGetProperty("setup", out var setup) || setup.ValueKind != JsonValueKind.Object)
                throw new InvalidDataException($"{id}: setup is missing.");
            personas.Add(new Persona(
                id,
                Name(role, id),
                Name($"{name}, {role}", id),
                Text(setup, "job_description_file", id),
                Text(setup, "resume_file", id),
                Source($"personas:{id}:role", id),
                Source($"personas:{id}:resume", id)));
        }
        return personas;
    }

    /// <summary>Persona id to its core questions, in the bank's order. Missing bank: no questions.</summary>
    private static Dictionary<string, IReadOnlyList<string>> ReadQuestionBank(string path)
    {
        var bank = new Dictionary<string, IReadOnlyList<string>>();
        if (!File.Exists(path)) return bank;
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        if (!document.RootElement.TryGetProperty("roles", out var roles) || roles.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException($"{QuestionBankFile} has no roles array.");
        foreach (var role in roles.EnumerateArray())
        {
            var personaId = Text(role, "persona_id", QuestionBankFile);
            if (!role.TryGetProperty("core", out var core) || core.ValueKind != JsonValueKind.Array)
                throw new InvalidDataException($"{QuestionBankFile}: {personaId} has no core array.");
            bank[personaId] = core.EnumerateArray().Select(q => Text(q, "text", personaId)).ToList();
        }
        return bank;
    }

    /// <summary>Reads a file the profile names, refusing a path that leaves the samples folder.</summary>
    private static string ReadUnder(string root, string relative)
    {
        var full = Path.GetFullPath(Path.Combine(root, relative));
        if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) && !full.StartsWith(root + Path.AltDirectorySeparatorChar, StringComparison.Ordinal))
            throw new InvalidDataException($"{relative} points outside the samples folder.");
        if (!File.Exists(full)) throw new FileNotFoundException($"The samples folder has no {relative}.", full);
        return File.ReadAllText(full);
    }

    private static string Text(JsonElement element, string property, string where) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())
            ? value.GetString()!
            : throw new InvalidDataException($"{where}: {property} is missing or blank.");

    private static DisplayName Name(string raw, string where) =>
        DisplayName.From(raw) is Succeeded<DisplayName> ok ? ok.Value : throw new InvalidDataException($"{where}: blank name.");

    private static DocumentSource Source(string key, string where) =>
        DocumentSource.Sample(key) is Succeeded<DocumentSource> ok ? ok.Value : throw new InvalidDataException($"{where}: blank source key.");
}
