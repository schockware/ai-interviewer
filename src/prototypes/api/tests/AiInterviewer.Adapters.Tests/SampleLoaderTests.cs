// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Adapters.Samples;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters.Tests;

/// <summary>
/// The persona loader against the repo's own samples folder (mocked-samples/ai-interviewer-test-personas/output),
/// found by walking up from the test binary. A checkout without it fails these tests, loudly, instead of skipping.
/// </summary>
public sealed class SampleLoaderTests
{
    private static readonly string? Output = FindOutput();

    private static string? FindOutput()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "mocked-samples", "ai-interviewer-test-personas", "output");
            if (Directory.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static (PersonaSampleLoader Loader, InMemoryRoleStore Roles, InMemoryResumeStore Resumes, InMemoryQuestionStore Questions) NewLoader()
    {
        var roles = new InMemoryRoleStore();
        var resumes = new InMemoryResumeStore();
        var questions = new InMemoryQuestionStore();
        return (new PersonaSampleLoader(resumes, roles, questions, TimeProvider.System), roles, resumes, questions);
    }

    [Fact]
    public async Task Every_persona_becomes_a_role_with_its_description_and_core_questions_and_a_resume()
    {
        Assert.True(Output is not null, "The samples folder mocked-samples/ai-interviewer-test-personas/output is not in this checkout.");
        var (loader, roles, resumes, questions) = NewLoader();

        var report = await loader.LoadAsync(Output!, default);

        Assert.Equal(36, report.RolesAdded);
        Assert.Equal(36, report.ResumesAdded);
        Assert.Equal(36, report.QuestionSetsAdded);
        Assert.Equal(0, report.PersonasAlreadyLoaded);

        var listed = await roles.ListAsync(default);
        Assert.Equal(36, listed.Count);
        // Most recently processed first, and the loader stamps the bank's order, so RET-01 leads.
        Assert.Equal("Store Associate (grocery)", listed[0].Name.Value);
        var engineer = Assert.Single(listed, r => r.Name.Value == "Software Engineer");
        Assert.Contains("## What you'll do", engineer.Text);
        Assert.Equal("sample:personas:TEC-02:role", engineer.Source.Key);
        var core = await questions.ListAsync(engineer.Id, default);
        Assert.Equal(5, core.Count);
        Assert.Equal([1, 2, 3, 4, 5], core.Select(q => q.Order));
        Assert.All(core, q => Assert.False(string.IsNullOrWhiteSpace(q.Text)));

        Assert.Contains(await resumes.ListAsync(default), r => r.Name.Value == "Jamal Thibodeaux, Software Engineer" && r.Text.Contains("Jamal"));
    }

    [Fact]
    public async Task Loading_again_adds_nothing()
    {
        Assert.True(Output is not null, "The samples folder mocked-samples/ai-interviewer-test-personas/output is not in this checkout.");
        var (loader, roles, _, _) = NewLoader();
        await loader.LoadAsync(Output!, default);

        var again = await loader.LoadAsync(Output!, default);

        Assert.Equal(new SampleLoadReport(0, 0, 0, 36), again);
        Assert.Equal(36, (await roles.ListAsync(default)).Count);
    }

    [Fact]
    public async Task A_missing_folder_is_an_error_not_an_empty_load()
    {
        var (loader, _, _, _) = NewLoader();
        await Assert.ThrowsAsync<DirectoryNotFoundException>(() => loader.LoadAsync(Path.Combine(Path.GetTempPath(), "no-such-samples-" + Guid.NewGuid().ToString("N")), default));
    }

    [Fact]
    public async Task A_profile_pointing_outside_the_folder_is_refused()
    {
        var folder = Path.Combine(Path.GetTempPath(), "ai-interviewer-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            await File.WriteAllTextAsync(Path.Combine(folder, PersonaSampleLoader.ProfilesFile), """
                [{ "id": "X-01", "name": "Nobody", "role": "Tester", "setup": { "job_description_file": "../outside.md", "resume_file": "r.md" } }]
                """);
            var (loader, _, _, _) = NewLoader();
            var error = await Assert.ThrowsAsync<InvalidDataException>(() => loader.LoadAsync(folder, default));
            Assert.Contains("outside the samples folder", error.Message);
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }
}
