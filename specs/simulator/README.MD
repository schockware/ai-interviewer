*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Conditions simulator (SIM)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Optionally degrade the interviewer's side of the call (delay, jitter, loss, tail clip) like a real remote connection, adding to real latency and never replacing it.

## Boundary

**Takes in**

- Events and audio with true timestamps
- Condition parameters and seed

**Puts out**

- The same events and audio with perceived timestamps, or marked dropped

**Not this layer's job:** Producing cues or captions. It only changes timing and content of what arrives.

## Requirements

None yet. IDs will be `SIM-{TOPIC}-{NNN}`, for example `SIM-XXXX-001`.

## Assumptions about neighbouring layers

- When off, it adds nothing and changes nothing.

## Open questions

- Real-world loss and concealment behavior for presets (§12 item 7).

## Source

`SPEC.md` §5, §6.3.
