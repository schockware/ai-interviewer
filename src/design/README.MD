*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# design

How each layer is built. A design answers one layer's spec in [`specs/`](../../specs/README.MD) and is where language, runtime, models and mechanisms are decided and discussed.

Status: **starting point.** Technology choices so far live in `SPEC.md` §3.2 to §3.4 and §8 and in `docs/decisions/`. They move into the per-layer designs here as each layer is worked on, and `SPEC.md` then keeps only the overall vision.

## Layout

One folder per layer, named as in `specs/`, created when work on that layer starts:

```
src/design/
  README.MD
  listening/
    README.MD      the design for this layer
  ...
```

## Rules

- A design **cites the requirement IDs it answers** (for example `LST-TURN-003`). It does not restate the requirements.
- A design may name languages, frameworks, runtimes and models (by `ai-models/` id). That is its job.
- A design **never quotes a pass count or a benchmark result.** It states how its tests write results and lists any conformance vectors it skips, by ID.
- A design that departs from a spec's assumption about a neighbouring layer says so, and the spec is changed or the design is.
- Record why a choice was made, and what was rejected, in `docs/decisions/` and link it.
- More than one design for the same layer is allowed. That is how models and approaches get compared.

## Current choices (provisional)

Pulled from `SPEC.md` and [decision 0001](../../docs/decisions/0001-minimum-spec-model-defaults.md). They are not yet written as designs, and every figure behind them is provisional until benchmarked.

| Layer | Minimum-spec choice (Tier 1) | Reference dev machine |
|---|---|---|
| Listening | Silero VAD + Smart Turn v3.2 int8, on CPU | same |
| Transcription | whisper.cpp base | Parakeet TDT 0.6B v3 int8, on CPU |
| Follow-up decider | the interviewer model, with its own prompt | same |
| Interviewer | Qwen3.5 4B Q4_K_M, thinking off | Qwen3.5 9B Q8_0, on GPU |
| Evaluator | the interviewer model, thinking allowed | same, thinking on |
| Speech synthesis | Kokoro 82M | Kokoro 82M, on CPU |

Layers with no model choice (simulator, cues, event stream, session, audio I/O, fit) have no entry yet.

## Prototype briefs

Before a layer is designed in full, it is prototyped alone. The briefs are for implementer chats. Read [PROTOTYPES.MD](PROTOTYPES.MD) first, then the brief for the layer.

| Order | Layer | Brief |
|---|---|---|
| 1 | Event stream | [events/PROTOTYPE.MD](events/PROTOTYPE.MD) |
| 2 | Listening | [listening/PROTOTYPE.MD](listening/PROTOTYPE.MD) |
| 3 | Transcription | [transcription/PROTOTYPE.MD](transcription/PROTOTYPE.MD) |
| 3 | Speech synthesis | [speech/PROTOTYPE.MD](speech/PROTOTYPE.MD) |

The UI prototype ([ui/PROTOTYPE.MD](ui/PROTOTYPE.MD), draft) runs against a mock event stream and can proceed in parallel with any of the above.

Transcription and speech synthesis are independent and can run in parallel. Briefs for the interviewer, follow-up, evaluator, simulator, cues, session and fit layers come next.

## Open items

1. The briefs set a layout for throwaway prototype code (`src/prototypes/`). The layout of the real code is still open (`src/README.MD`).
2. Whether designs are one file per layer or split once they grow.
3. A template for a design, once there is a first one to learn from.
