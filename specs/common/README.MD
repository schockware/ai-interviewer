*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Common requirements (COM)

Status: **first draft.**

Requirements that bind every layer, or every layer that wraps a model. They are written once here so each layer's spec can stay short. A layer's spec says which of them apply.

## Applies to

| Group | Layers |
|---|---|
| All layers | Listening, transcription, follow-up, interviewer, evaluator, speech, simulator, cues, session, fit, audio I/O |
| Model-backed layers | Listening, transcription, follow-up, interviewer, evaluator, speech |

## Requirements

### Isolation

- **COM-ISL-001** A layer MUST be runnable alone, with recorded inputs fed to it and its outputs captured, with no other layer present.
- **COM-ISL-002** A layer MUST interact with other layers only through its stated boundary and the event stream.
- **COM-ISO-001** A layer other than the simulator MUST NOT need to know whether simulation is active, and MUST NOT behave differently because of it.

### Identity and experiments (model-backed layers)

- **COM-ID-001** Every output MUST identify the implementation, version and configuration that produced it, so any result can be attributed to a specific candidate.
- **COM-DET-001** Given the same input, configuration and seed, a layer SHOULD produce the same output. Where it cannot, it MUST declare which parts are not repeatable and MUST accept a seed that makes repeatable what it can.
- **COM-RES-001** An implementation MUST report its load time and its memory use after loading and in operation, in a form the fit calculator can compare with its prediction.

### Data

- **COM-LOC-001** An implementation MUST declare whether its inputs leave the machine. One that sends data off the machine MUST NOT be a default and MUST be shown to the user as doing so.
- **COM-PRV-001** Audio, transcripts and reports are personal data. A layer MUST NOT keep them beyond what its job requires, and MUST NOT write them anywhere the user has not been told about.

### Failure

- **COM-FLT-001** A layer MUST report a failure or a degradation as a fault (EVT-TYPE-010) and MUST NOT fail silently or return wrong output as if it were right.
- **COM-FLT-002** A layer MUST NOT hang. If it cannot complete, it MUST say so within a stated time.
- **COM-INP-001** A layer MUST handle empty input, input shorter than it expects, and input longer than it expects, without crashing and without silently losing data.

## Open questions

1. Whether COM-DET-001 should be a MUST for layers that are not model-backed. The simulator and the fit calculator are already deterministic by their own specs (SIM-DET-001, FIT-SEL-002).
2. Time limits for COM-FLT-002 are per layer and belong in each layer's targets.
