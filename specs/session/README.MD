*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Session orchestration (ORC)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Run the conversation: move between states, pass work between layers, handle pause, repeat, skip, hint and switching between voice and text.

## Boundary

**Takes in**

- Outputs of every layer
- User controls
- Session configuration

**Puts out**

- The event stream
- Instructions to each layer

**Not this layer's job:** Doing any layer's work. It only coordinates.

## Requirements

None yet. IDs will be `ORC-{TOPIC}-{NNN}`, for example `ORC-XXXX-001`.

## Assumptions about neighbouring layers

- Each layer meets its own spec in isolation.

## Open questions

- Stage 1 and Stage 2 interview structure (ROADMAP.MD section 1).

## Source

`SPEC.md` §3.1, §4, §9 (orchestration).
