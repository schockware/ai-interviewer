*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Cues, captions and accessibility (CUE)

Status: **first draft.** Also bound by COM-ISL, COM-ISO and COM-FLT in [`specs/common`](../common/README.MD). WCAG 2.2 criteria are not yet mapped to the requirements (`SPEC.md` §12 item 4).

## Purpose

Show and sound the state of the conversation (listening, thinking, talking, paused) and the captions, so that no one depends on a single sense and the user always knows whose turn it is.

## Terms

| Term | Meaning |
|---|---|
| **Cue** | Any signal of conversation state: visual, audio or text |
| **Cue mode** | Which timeline drives cues: perceived, true state, or both for debugging |
| **Displayed cue** | What the user is shown right now. Announcements follow displayed cues |

## Boundary

**Takes in**

- The event stream, with true and perceived timestamps (EVT)
- Cue mode: `perceived`, `true_state` or `debug`
- Caption mode: `accurate`, `as_heard` or `off`
- Preferences: ambient volume and mute, caption size and contrast, reduced motion, interface (voice, text, both)
- User controls

**Puts out**

- Visual cues, audio cues and text announcements, with the time each appears
- Captions
- User control events (EVT-TYPE-007)

**Not this layer's job:** deciding the state. The state comes from the event stream.

## Requirements

### State

- **CUE-STA-001** Exactly one conversation state MUST be shown at a time, taken from the state events on the timeline of the active cue mode.
- **CUE-STA-002** A state in which the user waits (thinking) MUST have a cue in more than one sense, so a pause never reads as a stall.
- **CUE-STA-003** The change to the user's turn MUST be marked by a distinct cue in more than one sense at once, so the handoff is unmistakable.

### Redundancy

- **CUE-RED-001** Every audio cue MUST have a visual or text equivalent, and every visual cue MUST have an audio or text equivalent.
- **CUE-RED-002** Visual cues that are icons MUST carry a text label and MUST NOT rely on shape alone.

### Announcements

- **CUE-ANN-001** A change of state MUST be announced to assistive technology once, and MUST follow the displayed cue, not the hidden internal state.
- **CUE-ANN-002** An unchanged state MUST NOT be announced again.

### Cue modes

- **CUE-MOD-001** In `perceived` mode cues MUST follow perceived timestamps. In `true_state` mode they MUST follow true timestamps. In `debug` mode both timelines MUST be shown, with the offset of each transition.
- **CUE-MOD-002** Switching mode MUST take effect at once, without restarting the session or replaying cues.
- **CUE-MOD-003** With no simulation active, the two modes MUST look identical, and the interface MUST say so when a user chooses between them.
- **CUE-MOD-004** In `perceived` mode, a cue MUST NOT appear before the audio it describes has arrived.
- **CUE-MOD-005** The talking cue MUST stay on through short gaps in arriving audio, so loss does not make it flicker. A clipped ending MUST NOT be hidden: the cue changes when the clipped audio ends.

### Captions

- **CUE-CAP-001** In `accurate` mode, captions MUST show the full text of the interviewer's speech, whatever was dropped or clipped. This is the default.
- **CUE-CAP-002** In `as_heard` mode, captions MUST show only the text carried by audio that arrived (EVT-TYPE-006).
- **CUE-CAP-003** Caption size and contrast MUST be adjustable.
- **CUE-CAP-004** Captions MUST be offered as an accommodation and MUST NOT be presented as cheating or as a lesser mode.

### Sound and motion

- **CUE-AMB-001** Ambient audio MUST have its own mute and volume control, and nothing MUST play on its own without a way to stop it.
- **CUE-MOT-001** Animation MUST respect the user's reduced-motion preference.

### Controls

- **CUE-CTL-001** The user MUST be able to pause, resume, repeat, skip, ask for a hint, ask for a moment ("give me a sec"), and switch between voice and text. Push-to-talk MUST be available as an option.
- **CUE-CTL-002** Every control and every cue MUST be operable and perceivable without a pointer, using a keyboard and a screen reader.

### Simulation and debugging

- **CUE-SIM-001** While a condition is simulated, a persistent indicator MUST say so. The first time a non-clean preset is chosen, a dismissible explanation MUST say that cues will arrive late like a real call.
- **CUE-DBG-001** In `debug` mode the layer MUST also show dropped frames, clipped tails, listening decisions, and the measured pipeline floor against the simulated additions, and MUST let the timeline be exported (EVT-EXP-001).

### Text interface

- **CUE-TXT-001** When the interface is text, every state cue MUST have a text equivalent, such as a typing indicator.

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| CUE-TGT-001 | Hold time of the talking cue through gaps | **[unverified]** under about 300 ms |
| CUE-TGT-002 | Delay from an event reaching the layer to its cue appearing | to be set |
| CUE-TGT-003 | Mapping to WCAG 2.2 success criteria | to be written |

## Conformance vectors (planned)

1. A recorded event stream with simulation off: a cue timeline, the same in both modes (CUE-MOD-003).
2. The same stream with 800 ms downlink delay: `perceived` cues late by that much, `true_state` cues on time (CUE-MOD-001).
3. A mode switch mid-session: no restart, no replay (CUE-MOD-002).
4. Dropped frames mid-utterance: the talking cue holds, no flicker (CUE-MOD-005).
5. A clipped ending: the cue changes at the end of the audio (CUE-MOD-005).
6. Captions in each mode on a clipped, lossy utterance (CUE-CAP-001, CUE-CAP-002).
7. Announcements log for a whole session: one per change (CUE-ANN-001, CUE-ANN-002).
8. Every cue checked for an equivalent in another sense (CUE-RED-001).

## Running alone

Feed a recorded event stream (with perceived timestamps) and preferences. Capture a timeline of cues, announcements and captions with the time of each. No browser, microphone or models are needed to check it.

## Assumptions about neighbouring layers

- Events carry both timestamps once simulation runs, and interviewer text events link to audio frames (EVT-TYPE-006).
- The browser or desktop client can sound an audio cue and announce text to assistive technology.

## Open questions

1. Whether the transfer from `perceived` to `true_state` is easier than the reverse. It is a hypothesis for user testing (`SPEC.md` §12 item 8).
2. Which WCAG 2.2 criteria apply to ambient audio, animation and status messages.
3. How the ambient sound is kept from being heard as the user's voice (an audio I/O matter).

## Source

`SPEC.md` §4 and §6.
