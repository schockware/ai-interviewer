*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Audio input and output (AIO)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Capture the user's voice and play the interviewer's voice and ambient sound, without one contaminating the other.

## Boundary

**Takes in**

- Microphone signal
- Audio to play, on separate buses (voice, ambient, effects)
- Volume and mute settings

**Puts out**

- Continuous user audio stream with true timestamps
- Playback confirmation (what actually played, and when)

**Not this layer's job:** Detecting speech, transcribing, or deciding who is talking. It only moves audio.

## Requirements

None yet. IDs will be `AIO-{TOPIC}-{NNN}`, for example `AIO-XXXX-001`.

## Assumptions about neighbouring layers

- The user may use speakers or headphones; echo handling must work for both or say which it needs.

## Open questions

- How echo is prevented when ambient audio plays through speakers.
- The first client captures and plays audio in a browser, and a later desktop client must emulate classic chat setups, so the spec has to hold for both (decision 0003).

## Source

`SPEC.md` §4.1 (echo trap), §4.2.
