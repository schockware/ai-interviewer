// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
using AiInterviewer.Adapters.Sqlite;
using AiInterviewer.Business;
using AiInterviewer.Business.Setup;

namespace AiInterviewer.Adapters.Tests;

public sealed class SetupFormJsonTests
{
    [Fact]
    public void The_hot_incomplete_variant_round_trips_even_though_the_service_never_stores_it()
    {
        var form = ApplicationSetupForm.Initial with { InterviewType = new HotIncompleteToCold() };
        var back = Assert.IsType<Succeeded<ApplicationSetupFormHolder>>(SetupFormJson.Read(SetupFormJson.Write(form)));
        Assert.Equal(form, back.Value.Form);
    }

    private const string AllCloud =
        """{"listener":{"type":"cloud"},"transcriber":{"type":"cloud"},"followUp":{"type":"cloud"},"interviewer":{"type":"cloud"},"evaluator":{"type":"cloud"},"speaker":{"type":"cloud"}}""";

    [Theory]
    [InlineData("not json at all")]
    [InlineData("{}")]
    [InlineData("""{"ai":{},"interviewType":{"type":"cold"},"roleFocus":{"type":"unanswered"}}""")]
    [InlineData("""{"ai":{"listener":{"type":"holographic"}},"interviewType":{"type":"cold"},"roleFocus":{"type":"unanswered"}}""")]
    [InlineData("""{"ai":""" + AllCloud + ""","interviewType":{"type":"hot"},"roleFocus":{"type":"unanswered"}}""")]
    [InlineData("""{"ai":""" + AllCloud + ""","interviewType":{"type":"cold"},"roleFocus":{"type":"role","roleId":" "}}""")]
    public void A_shape_this_version_does_not_know_is_a_failure_not_a_default(string json)
    {
        Assert.IsType<Failed<ApplicationSetupFormHolder>>(SetupFormJson.Read(json));
    }
}
