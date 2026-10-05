*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Hardware fit and model selection (FIT)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Measure the machine, choose the models for each slot that fit it, verify on first load, and say clearly when local mode is not possible.

## Boundary

**Takes in**

- Free memory, processor, graphics and disk
- The model registry (ai-models/)

**Puts out**

- A chosen candidate per slot, or an unsupported verdict with a fallback

**Not this layer's job:** Running the models.

## Requirements

None yet. IDs will be `FIT-{TOPIC}-{NNN}`, for example `FIT-XXXX-001`.

## Assumptions about neighbouring layers

- The model registry's facts are correct for the files that will be downloaded.

## Open questions

- Measured free RAM and disk on real machines (§12 item 10).

## Source

`SPEC.md` §8.
