*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Speech synthesis (TTS)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Turn the interviewer's text into audio, starting at the first sentence boundary and stopping on demand.

## Boundary

**Takes in**

- Text in sentence-sized pieces
- Cancel signal

**Puts out**

- Audio stream with timing

**Not this layer's job:** Delaying, clipping or dropping audio. That is the simulator's job.

## Requirements

None yet. IDs will be `TTS-{TOPIC}-{NNN}`, for example `TTS-XXXX-001`.

## Assumptions about neighbouring layers

- Text arrives incrementally.

## Open questions

- Real-time factor on the minimum tier (§12 item 2, 13).

## Source

`SPEC.md` §3.1, §3.2, §9 (TTS).
