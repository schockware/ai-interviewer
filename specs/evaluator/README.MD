*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Evaluator (EVL)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Score the user's answers, produce feedback and the session report. Not latency-sensitive.

## Boundary

**Takes in**

- Full transcript and interview context
- Conditions and cue-mode log from the session

**Puts out**

- Scores, feedback and the session report

**Not this layer's job:** Anything during the live turn. It may run after, or between turns.

## Requirements

None yet. IDs will be `EVL-{TOPIC}-{NNN}`, for example `EVL-XXXX-001`.

## Assumptions about neighbouring layers

- The user relying on captions or accommodations is never penalized (§4.2).

## Open questions

- How scoring is validated against human-scored transcripts.

## Source

`SPEC.md` §3.2, §5.4.
