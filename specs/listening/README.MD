*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Listening: speech activity and end of turn (LST)

Status: **first draft.** Also bound by the common requirements COM-ISL, COM-ISO, COM-ID, COM-DET, COM-RES, COM-FLT and COM-INP in [`specs/common`](../common/README.MD).

## Purpose

Decide when the user is speaking and when they have finished their turn, so the interviewer neither interrupts nor leaves dead air.

## Terms

| Term | Meaning |
|---|---|
| **Speech activity** | A span of the audio in which the user is speaking |
| **Pause** | A silence inside a turn: the user is thinking, not finished |
| **Turn** | From the user starting to speak until the layer decides they have finished |
| **False cutoff** | The layer declares the end of a turn while the user is still going to speak |
| **Missed end** | The user has finished and the layer does not say so in good time |

## Boundary

**Takes in**

- The user's audio as a continuous stream with timestamps. Only the user's voice is expected in it.
- User controls: push-to-talk start and stop, and "give me a sec"
- Settings: sensitivity, minimum speech length, silence needed before a decision, and the longest silence allowed

**Puts out**

- Speech start and stop events, with timestamps
- End-of-turn decisions, each with a timestamp, a confidence, and the turn it ends

**Not this layer's job:** understanding what was said. It works from the sound alone.

## Requirements

### Activity

- **LST-ACT-001** The layer MUST report when the user starts and stops speaking, with timestamps on the audio's own clock.
- **LST-ACT-002** The layer MUST work from the audio alone and MUST NOT need a transcript.
- **LST-ACT-003** The layer SHOULD NOT report speech activity for silence, steady background noise, or room tone.
- **LST-ACT-004** The layer MUST keep reporting speech activity while the interviewer is speaking, so the session can handle the user talking over the interviewer.

### Turn decisions

- **LST-TURN-001** After speech stops, the layer MUST decide whether the turn has finished or the user is likely to continue, and report the decision with a confidence.
- **LST-TURN-002** The layer MUST NOT declare the end of a turn while speech is going on.
- **LST-TURN-003** The layer MUST declare the end of a turn once the silence reaches a configurable longest silence, whatever the confidence, so there is never unbounded dead air.
- **LST-TURN-004** The layer SHOULD tell a mid-thought pause (hesitation, a trailing "so...", a breath) from a finished answer, so false cutoffs are rarer than a plain silence timer produces.
- **LST-TURN-005** If the user starts speaking again after an end-of-turn decision, the layer MUST report the new speech so the session can withdraw a pending reply.
- **LST-TURN-006** Each decision MUST identify the turn it ends and the speech spans that make up the turn.
- **LST-TURN-007** A decision, once reported, MUST NOT be silently changed. Any correction is a new report.

### Controls

- **LST-CTRL-001** While push-to-talk is held, the turn MUST begin at the press and end at the release, and the layer MUST NOT end it automatically.
- **LST-CTRL-002** After "give me a sec", the layer MUST NOT end the turn on silence until the user speaks again, releases the hold, or a configurable limit passes.

### Settings

- **LST-CFG-001** Sensitivity, minimum speech length, silence needed before a decision and longest silence MUST be adjustable without changing the implementation, and the values in effect MUST be reported.

### Streaming

- **LST-STR-001** The layer MUST process audio as it arrives and MUST NOT need audio from beyond a bounded delay after the point it is deciding about.
- **LST-STR-002** The layer MUST accept audio of any length, including shorter than its analysis needs, without error (COM-INP-001).

## Targets (provisional, to be set from prototype measurements)

These are not requirements until adopted. Each is a measurement the prototype must produce.

| ID | Measure | Starting point |
|---|---|---|
| LST-TGT-001 | Delay from the true end of speech to the decision | **[unverified]** about 0.2 s of silence plus the detector's own time |
| LST-TGT-002 | False cutoff rate on interview-style speech | to be set |
| LST-TGT-003 | Missed-end rate on interview-style speech | to be set |
| LST-TGT-004 | Time per decision on the minimum-spec machine | to be set |

## Conformance vectors (planned)

Recorded audio with labeled speech spans and turn ends. Each checks an observation, not a quality score.

1. Silence only, and steady noise only: no activity (LST-ACT-003).
2. One short utterance then silence: one turn, ended once (LST-TURN-001).
3. A long mid-answer pause: no end of turn before the longest silence (LST-TURN-003, LST-TURN-004).
4. A trailing "so..." followed by more speech: no false cutoff, or if cut, new speech reported (LST-TURN-005).
5. Resumption after an end-of-turn decision (LST-TURN-005).
6. Push-to-talk held through a long silence (LST-CTRL-001).
7. "Give me a sec" then a long silence, then speech (LST-CTRL-002).
8. Audio shorter than any analysis window, and one hour of continuous speech (LST-STR-002).
9. Speech starting while interviewer audio is marked as playing (LST-ACT-004).

## Running alone

Feed a recorded audio file as a timestamped stream. Capture the speech events and decisions as a list. Compare to the labels. No other layer is needed.

## Assumptions about neighbouring layers

- The audio is a continuous stream of the user's voice with timestamps, and the interviewer's own voice has been removed from it or kept out of it. If it is not, the layer may take the interviewer's voice for the user's. *(Audio I/O decides this.)*
- Controls arrive as events with timestamps.

## Open questions

1. Language coverage, and whether quality varies by language or accent.
2. How the interviewer's voice is kept out of the user's audio on a browser (open in audio I/O).
3. Whether the confidence in LST-TURN-001 is a number, a category, or both.
4. Whether a decision should say how much of the silence it has seen, as a debugging aid.

## Source

`SPEC.md` §1, §2, §3.2, §9 (turn detection), and the cue modes in §6.
