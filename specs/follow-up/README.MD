*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Follow-up decider (FUP)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Decide, after each answer, whether to probe deeper or move on.

## Boundary

**Takes in**

- Answer text
- Interview context (role, stage, history)

**Puts out**

- Decision: probe or move on, with an optional focus

**Not this layer's job:** Writing the question. It only decides the direction.

## Requirements

None yet. IDs will be `FUP-{TOPIC}-{NNN}`, for example `FUP-XXXX-001`.

## Assumptions about neighbouring layers

- Answer text is complete for the turn (from transcription and listening).

## Open questions

- How decisions are labeled and scored (benchmarking dataset).

## Source

`SPEC.md` §3.2.
