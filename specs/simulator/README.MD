*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Conditions simulator (SIM)

Status: **first draft.** Also bound by COM-ISL, COM-FLT and COM-INP in [`specs/common`](../common/README.MD). COM-ISO does not apply: the simulator is the one layer that knows whether simulation is active.

## Purpose

Optionally degrade the call as the user experiences it (delay, jitter, loss, clipped endings) so they can practice for real remote interviews. Simulated conditions are added to real pipeline latency, never substituted for it.

## Terms

| Term | Meaning |
|---|---|
| **Pipeline floor** | The real delay the system already has, measured, before any simulated delay |
| **Burst** | A run of consecutive dropped frames |
| **Preset** | A named, fixed set of parameters |

## Boundary

**Takes in**

- Events and audio with true timestamps (EVT)
- Parameters: uplink delay and jitter, downlink delay and jitter, response delay, loss percentage and burst length, loss mode (silence or concealment), tail clip, and a seed
- The measured pipeline floor

**Puts out**

- The same events and audio with a perceived timestamp, or marked dropped
- The user's audio, as listening and transcription see it, delayed by the uplink condition
- A condition event saying which conditions are in effect (EVT-TYPE-008)

**Not this layer's job:** deciding what a cue looks like (cues) or who yields when both people talk (session).

## Requirements

### Off means off

- **SIM-OFF-001** When simulation is off, the layer MUST add nothing and change nothing: every perceived timestamp equals its true timestamp, and no frame is dropped or altered.

### Adding to real latency

- **SIM-ADD-001** A perceived timestamp MUST equal the true timestamp plus the simulated delay. The layer MUST NOT reduce real latency (EVT-SIM-002).
- **SIM-ADD-002** The layer MUST report the measured pipeline floor, and MUST warn when a requested total delay is below it.

### Reproducibility

- **SIM-DET-001** For the same input, parameters and seed, the output MUST be identical, including every perceived timestamp and every dropped marker (EVT-REC-002).

### Delay and jitter

- **SIM-DLY-001** Uplink delay, downlink delay and response delay MUST each be settable on their own.
- **SIM-DLY-002** Uplink delay MUST apply to the user's audio as listening and transcription see it, so turn detection shifts by that delay.
- **SIM-DLY-003** Downlink delay MUST apply to the interviewer's audio and to the events that describe it, together.
- **SIM-DLY-004** Response delay MUST add a gap between the end of the user's turn and the start of the interviewer's reply.
- **SIM-JIT-001** Jitter MUST stay within the configured bound.
- **SIM-JIT-002** Within one audio stream, perceived timestamps MUST NOT go backwards. Order across different event types MAY vary (EVT-SIM-004). *(This assumes the receiver reorders audio, as call software does.)*

### Loss

- **SIM-LOS-001** Dropped frames MUST occur in bursts. Over a long run, the mean burst length MUST be close to the configured length and the overall loss close to the configured percentage.
- **SIM-LOS-002** Each dropped frame MUST be marked dropped (EVT-SIM-001).
- **SIM-LOS-003** In silence mode, a dropped span MUST be silent. In concealment mode, it MUST contain audio made from the audio before it.

### Tail clip

- **SIM-CLP-001** The layer MUST remove the configured length from the end of each interviewer utterance's audio.
- **SIM-CLP-002** Clipping MUST NOT change the text events of the utterance. Whether the user sees the full text is a captions matter (CUE-CAP).

### Presets and parameters

- **SIM-PRE-001** A preset MUST give the same parameters every time it is chosen. A custom set MUST also be possible.
- **SIM-PAR-001** Each parameter MUST be checked on entry. An out-of-range value MUST be refused with a reason.
- **SIM-IND-001** While any condition is active, the layer MUST emit a condition event, so the interface can always show that conditions are simulated (EVT-TYPE-008).

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| SIM-TGT-001 | Accuracy of applied delay against requested | to be set |
| SIM-TGT-002 | Parameter ranges accepted | to be set |
| SIM-TGT-003 | Preset values | **[unverified]** starting values are in `SPEC.md` §5.2, to be tuned by ear. Only the first two are anchored to measured experiences |
| SIM-TGT-004 | Extra cost of running the simulator | to be set |

## Conformance vectors (planned)

1. A stream with simulation off: output equals input (SIM-OFF-001).
2. A fixed 120 ms downlink delay: every perceived time is true plus 120 ms (SIM-ADD-001).
3. A requested total delay below the floor: warned (SIM-ADD-002).
4. The same stream and seed twice: identical (SIM-DET-001).
5. Jitter: perceived times stay within the bound, audio order is kept (SIM-JIT-001, SIM-JIT-002).
6. A long run with 5% loss in bursts of 4: statistics near the configuration (SIM-LOS-001).
7. Silence and concealment modes on the same dropped span (SIM-LOS-003).
8. Tail clip of 300 ms: audio shortened, text events unchanged (SIM-CLP-001, SIM-CLP-002).
9. An out-of-range parameter (SIM-PAR-001).

## Running alone

Feed a recorded event stream with its audio and a parameter set. Capture the output stream. Everything is checked from timestamps and markers, with no listening needed.

## Assumptions about neighbouring layers

- The session supplies the measured pipeline floor.
- The receiver of audio reorders it, so perceived order within one audio stream is kept.
- Overlap between the user and the interviewer, as perceived, can be seen by the session from the output. The session applies the policy for who yields.

## Open questions

1. Whether a double-talk policy belongs here or in the session. `SPEC.md` §5.4 lists it among the simulator's policies, and this draft places the action in the session.
2. Real-world loss rates and codec concealment behavior for realistic presets (`SPEC.md` §12 item 7).
3. Whether the user's audio is delayed in the layer itself, or the session holds it. The requirement is only the outcome (SIM-DLY-002).

## Source

`SPEC.md` §5 and §6.3.
