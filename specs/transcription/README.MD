*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Transcription (STT)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Turn the user's speech into text, streaming while they speak.

## Boundary

**Takes in**

- User audio (stream or finished segment)
- Optional vocabulary hints

**Puts out**

- Partial text, then final text, each with timing

**Not this layer's job:** Deciding when a turn ends (listening) or interpreting meaning (interviewer).

## Requirements

None yet. IDs will be `STT-{TOPIC}-{NNN}`, for example `STT-XXXX-001`.

## Assumptions about neighbouring layers

- Input is audio for one speaker.
- Utterances may need to be limited in length; the layer states how it handles long ones.

## Open questions

- Word error rate target for interview-style speech (a benchmark question).

## Source

`SPEC.md` §3.1, §3.2, §9 (STT).
