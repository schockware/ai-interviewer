*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Cues, captions and accessibility (CUE)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Show and sound the conversation state (listening, thinking, talking, paused) and captions, redundantly across senses.

## Boundary

**Takes in**

- Event stream (true or perceived)
- Cue mode and accessibility preferences

**Puts out**

- Visual cues, audio cues, screen-reader announcements, captions

**Not this layer's job:** Deciding the state. It reflects the event stream.

## Requirements

None yet. IDs will be `CUE-{TOPIC}-{NNN}`, for example `CUE-XXXX-001`.

## Assumptions about neighbouring layers

- Events carry both true and perceived timestamps once simulation runs.

## Open questions

- WCAG 2.2 criteria mapping (§12 item 4), and whether `perceived` transfers to `true_state` (§12 item 8).

## Source

`SPEC.md` §4, §6.
