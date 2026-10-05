*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Listening: speech activity and end of turn (LST)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Decide when the user is speaking and when they have finished their turn, so the interviewer neither interrupts nor leaves dead air.

## Boundary

**Takes in**

- User audio stream
- User controls: push-to-talk, "give me a sec"

**Puts out**

- Speech start and stop events
- End-of-turn decision with its timestamp and confidence

**Not this layer's job:** Understanding what was said. It works from the sound alone.

## Requirements

None yet. IDs will be `LST-{TOPIC}-{NNN}`, for example `LST-XXXX-001`.

## Assumptions about neighbouring layers

- Audio arrives as a continuous stream with timestamps (from audio-io).

## Open questions

- 4-core CPU cost of the detector (§12 item 2).

## Source

`SPEC.md` §1, §2, §3.2, §9 (turn detection).
