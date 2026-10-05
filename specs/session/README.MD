*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Session orchestration (ORC)

Status: **first draft.** Also bound by COM-ISL, COM-FLT and COM-INP in [`specs/common`](../common/README.MD).

## Purpose

Run the conversation: move between states, pass work between layers, and handle pause, repeat, skip, hint and the switch between voice and text. The session coordinates and does none of the other layers' work.

## Terms

| Term | Meaning |
|---|---|
| **State** | One of listening, thinking, talking, paused |
| **Turn** | One exchange: the user's answer, then the interviewer's reply |
| **Pending reply** | A reply being prepared or spoken |
| **Barge-in** | The user speaks while the interviewer is speaking |

## Boundary

**Takes in**

- Outputs of every layer, through their own boundaries
- User controls
- Session configuration: stage and length, interface, cue mode, simulation preset, and the chosen implementation for each layer

**Puts out**

- The event stream, as its authority (EVT)
- Instructions to each layer: what to do, and when to cancel
- The conversation history, recording what the user actually heard

**Not this layer's job:** doing any layer's work.

## Requirements

### Stream authority

- **ORC-AUT-001** The session MUST be the authority of the event stream: it assigns positions and true timestamps (EVT-CORE-004).
- **ORC-AUT-002** The session MUST place events from other machines on the session clock (EVT-TIME-004).

### State

- **ORC-STA-001** At any time the session MUST be in exactly one state, and every change MUST be emitted as a state event.
- **ORC-STA-002** The session MUST move to thinking when a turn ends, to talking when the first interviewer audio is ready, to listening when the interviewer has finished or yielded, and to paused when the user pauses.

### Turn-taking

- **ORC-TRN-001** The session MUST NOT start interviewer audio while the user is speaking, unless the double-talk policy says otherwise.
- **ORC-TRN-002** If the user speaks again after an end of turn and before interviewer audio has begun, the session MUST cancel the pending reply and return to listening (LST-TURN-005).
- **ORC-TRN-003** The session MUST NOT start a new interviewer utterance while a previous one is still being spoken.
- **ORC-TRN-004** On barge-in, the session MUST apply the configured double-talk policy: the interviewer yields, the user yields, or both continue. Overlap is judged on perceived time when simulation is active.
- **ORC-TRN-005** After a cancel, the history MUST record only what the user actually heard.

### Flow of one turn

- **ORC-FLW-001** After a turn ends, the session MUST obtain the final text, then the follow-up decision, then the interviewer's reply, and MUST pass each reply piece to speech as it arrives.
- **ORC-FLW-002** Where a layer streams, the session MUST use its early output and MUST NOT wait for completion.
- **ORC-FLW-003** The session MUST keep the first question and the opening of the interview inside the same rules, with no special case that bypasses the layers.

### Controls

- **ORC-CTL-001** The session MUST support pause, resume, repeat, skip, hint, "give me a sec", and push-to-talk. Each MUST produce a control event, and each MUST take effect within a stated time.
- **ORC-CTL-002** On pause, interviewer audio MUST stop and the state MUST become paused.
- **ORC-MOD-001** The session MUST allow switching between voice and text mid-session without losing the history. In text, listening, transcription and speech are not needed.

### Faults

- **ORC-FLT-001** When a layer fails, the session MUST emit a fault event, tell the user, and continue in a degraded way where one exists (for example, text with captions when speech fails). It MUST NOT lose the session record.
- **ORC-FLT-002** When a layer does not respond within its stated time, the session MUST treat it as a fault. The user MUST NOT be left in silence with no cue.

### Lifecycle

- **ORC-LIF-001** The session MUST emit a start event with the configuration and an end event, and MUST hand the session to the evaluator at the end.
- **ORC-LIF-002** The session MUST end the interview within its configured maximum length, and MUST signal a wrap-up before then.
- **ORC-LIF-003** A client disconnecting MUST NOT end the session at once. The session MUST hold, paused, for a stated time so the client can return (EVT-DELIV-002).
- **ORC-CFG-001** The session MUST check its configuration at the start, and MUST refuse an unsupported combination with a clear reason.

### Simulation and recording

- **ORC-SIM-001** When simulation is active, the session MUST send the streams through the simulator, and MUST measure and supply the pipeline floor.
- **ORC-REC-001** The session MUST record the stream so it can be exported and replayed (EVT-REC-001).

### Isolation

- **ORC-ISL-001** The session MUST depend on each layer only through its boundary, so any implementation that meets the layer's spec, including a recorded stand-in, can replace it.

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| ORC-TGT-001 | Time from the end of the user's turn to the first interviewer audio, with every layer running | to be set (the central figure of the project) |
| ORC-TGT-002 | Time from pause to silence | to be set |
| ORC-TGT-003 | Grace period for a disconnected client | to be set |
| ORC-TGT-004 | Time before a silent layer counts as failed, per layer | to be set |

## Conformance vectors (planned)

The session is tested with every other layer replaced by a recorded stand-in.

1. A normal turn: states and events occur in order (ORC-STA-001, ORC-STA-002).
2. The user resumes after an end of turn: the reply is cancelled (ORC-TRN-002).
3. Barge-in under each double-talk policy (ORC-TRN-004).
4. A cancelled utterance: the history holds the heard part only (ORC-TRN-005).
5. Pause during speech, then resume (ORC-CTL-002).
6. A stand-in layer that fails, and one that never answers (ORC-FLT-001, ORC-FLT-002).
7. A switch to text and back (ORC-MOD-001).
8. A client that drops and returns inside, and outside, the grace period (ORC-LIF-003).
9. A configuration that cannot be supported (ORC-CFG-001).

## Running alone

Replace every layer with a recorded stand-in that answers on a script. Run the session. Compare the resulting event stream with the expected one.

## Assumptions about neighbouring layers

- Each layer meets its own spec, and states how long it may take.
- The simulator and cues are fed from the stream and do not change what the session does.

## Open questions

1. Whether the double-talk policy belongs in the session (this draft) or the simulator (`SPEC.md` §5.4).
2. The structure of the interview itself: stages, topics, and how a plan reaches the interviewer. The 10 to 15 minute and 45 to 60 minute interviews in `ROADMAP.MD` are not yet specified.
3. Whether an agent would help coordination (decision 0003). The spec holds either way, because it says what the session does, not how it decides.

## Source

`SPEC.md` §3.1, §4, §9 (orchestration), and `ROADMAP.MD` section 1.
