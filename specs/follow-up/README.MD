*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Follow-up decider (FUP)

Status: **first draft.** Also bound by the common requirements COM-ISL, COM-ISO, COM-ID, COM-DET, COM-RES, COM-LOC, COM-PRV, COM-FLT and COM-INP in [`specs/common`](../common/README.MD).

## Purpose

Decide, after each answer, whether to probe deeper or move on.

## Boundary

**Takes in**

- The user's answer as complete text for the turn, with the confidence of the transcript
- The question that was asked
- Interview context and history
- Settings: the most probes allowed in a row on one question

**Puts out**

- One decision: **probe** or **move on**
- For a probe, the **focus**: what in the answer to ask about
- A short **reason** for the decision

**Not this layer's job:** writing the question (interviewer) or scoring the answer (evaluator).

## Requirements

### Decision

- **FUP-DEC-001** The layer MUST give exactly one decision for each answer: probe or move on.
- **FUP-DEC-002** A probe decision MUST include a focus, stated in a short phrase that refers to the user's answer.
- **FUP-DEC-003** Every decision MUST include a short reason, for the report and for debugging.
- **FUP-DEC-004** The layer MUST NOT choose probe more than the configured number of times in a row on one question, so the interview moves forward.
- **FUP-DEC-005** If the answer is empty, or states that the user does not know, the layer MUST choose move on and say so in the reason.
- **FUP-DEC-006** If the transcript's confidence is too low to judge the answer, the layer MUST say so in the reason, and MUST NOT probe about content it cannot trust.

### Consistency

- **FUP-CON-001** The same input SHOULD give the same decision across repeated runs. The agreement rate MUST be measurable (COM-DET-001).
- **FUP-CON-002** The layer MUST decide only from the inputs it is given, and MUST NOT depend on anything about the user's voice, accent or the audio conditions.

### Timing

- **FUP-TIM-001** The layer MUST give its decision within a stated time, since the interviewer waits for it.

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| FUP-TGT-001 | Time to decide on the minimum-spec machine | to be set |
| FUP-TGT-002 | Agreement with decisions labeled by people | to be set (a benchmark) |
| FUP-TGT-003 | Agreement across repeated runs | to be set |
| FUP-TGT-004 | The default limit on consecutive probes | **[unverified]** 2 or 3 |

## Conformance vectors (planned)

1. A complete, strong answer: any decision, with a reason (FUP-DEC-001, FUP-DEC-003).
2. A vague answer: a probe with a focus (FUP-DEC-002).
3. Several probes in a row on one question: the limit is enforced (FUP-DEC-004).
4. An empty answer, and "I don't know" (FUP-DEC-005).
5. A low-confidence transcript (FUP-DEC-006).
6. The same input run ten times (FUP-CON-001).

## Running alone

Feed recorded answers with the question and context. Capture decisions and reasons. Compare to labeled decisions in benchmarking.

## Assumptions about neighbouring layers

- The answer is complete for the turn: the end of turn has been decided and the final text exists.
- The history shows how many probes have been made on this question.

## Open questions

1. Whether two decisions are enough, or a third ("offer a hint") is needed.
2. Whether this layer needs its own model, or can be the interviewer's with another prompt. At the minimum-spec tier the plan is to share (`SPEC.md` §3.2.1).

## Source

`SPEC.md` §3.2.
