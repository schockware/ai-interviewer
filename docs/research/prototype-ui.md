*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Prototype summary: UI

Status: **in progress.** Brief: [src/design/ui/PROTOTYPE.MD](../../src/design/ui/PROTOTYPE.MD). Code: `src/prototypes/ui/`. This file grows as the prototype does. Sections for measurements, requirement checks and "what the prototype got wrong" are added when there is something to put in them. Testing tool research is in [ui-testing-tools.md](ui-testing-tools.md).

## Contract draft (2026-10-05)

`specs/events` has no typed schema, so the implementer drafted one in `src/prototypes/ui/src/core/contract/`: types (`events.ts`), a parser for raw messages (`parse.ts`), a position tracker (`order.ts`) and perceived-time helpers (`time.ts`). It is a proposal. `specs/` has not been edited.

Checked by `.spec.ts` files beside the code (30 Vitest tests in total at this point):

| Requirement | Evidence |
|---|---|
| EVT-CORE-002 envelope fields | `parse.spec.ts` |
| EVT-CORE-003, EVT-DELIV-001 gaps | `order.spec.ts` (conformance vector 1) |
| EVT-EXT-001, EVT-EXT-004 unknown type and field | `parse.spec.ts` (vector 2) |
| EVT-SIM-001, EVT-SIM-002 perceived or dropped, never earlier | `parse.spec.ts` (vector 3) |
| EVT-SIM-003 perceived equals true with no simulation | `time.spec.ts` (vector 4) |
| EVT-SIM-004 perceived order | `time.spec.ts` |
| EVT-TYPE-005 only a final piece replaces others | `parse.spec.ts` (the rule only; applying a replacement waits for the reducer, so vector 6 is half done) |
| EVT-TYPE-006 optional frame link | `parse.spec.ts` |

Not covered here: vector 5 (replay with one seed is identical, a simulator matter) and vector 7 (text linked to frames with some dropped, needs the reducer). EVT-CORE-004 (only the authority assigns positions) is expressed by the `ControlRequest` type having no position or time, and has no test.

## Mock event stream (2026-10-05)

In `src/prototypes/ui/src/adapters/mock/`:

- **`EventSource` port** (`core/ports.ts`): `header`, `subscribe`, `start`, `stop`. A mock, a recorded stream or a WebSocket can implement it.
- **Script format** (`script.ts`, JSON in `scripts/`): events as an author writes them, without session identifier or position, plus an `audio_run` shorthand for runs of equal frames. Each script lists the IDs it covers.
- **`buildStream`**: plays the authority. It orders by true time, assigns positions, and checks every event with the same parser a real consumer uses, so a bad script throws when loaded.
- **`ScriptedEventSource`**: delivers each event when its clock reaches the event's true time. Both timestamps stay on the event, and choosing which to show is the cue layer's job. With a drifting `SimulatedClock`, delivery drifts too.
- **First script, `simulation-off`:** a 13.5 s exchange (the interviewer asks, the user answers in pieces, the interviewer asks again). No perceived times, no dropped markers.

48 Vitest tests pass in total. Not built yet: the other four scripts in the brief (800 ms downlink delay, dropped frames, clipped ending, lossy utterance). They need perceived times, so they wait for the cue-strategy layer to say what it needs. The thresholds for them are being researched separately.

## Mock calibrations: when the interviewer decides it is done (2026-10-05)

[micro-pauses-and-run-ons.md](micro-pauses-and-run-ons.md) shows that silence alone cannot tell a hesitation from a finished turn. So a mock that replays one fixed exchange hides a whole class of UI situations. The mock interviewer is therefore **calibrated**, the way a real turn detector and pipeline are.

In `src/prototypes/ui/src/adapters/mock/`:

- **`TurnPolicy`** (`mockInterviewer.ts`): `response_window_ms` (how long it waits for a first word before prompting), `endpointing_ms` (silence before it decides the turn is over), `thinking_ms` (decision to first word), and `on_user_resumes` (`yield` or `continue`, a double-talk policy). These map to the three silences in the research's §2.4.
- **`generateScript`**: takes a policy and a user answer written as speech spans (the pauses between spans are the micro-pauses) and produces a normal `MockScript`, which then goes through `buildStream` and the contract parser. It knows where the answer really ends, so it marks a decision as a false cutoff (confidence 0.55) or a true end (0.93).
- **Presets** (`calibrations.ts`): `eager` (500 ms, the LiveKit minimum delay), `balanced` (1.5 s) and `patient` (3 s, the Pipecat fallback). All are proposals, and the research marks the figures they come from as unverified.
- **Fixture answer:** a 1.2 s lead-in, a 700 ms breath pause, then a 2,500 ms thinking pause, modelled on recordings 3 and 5 in `PROTOTYPES.MD`.

What the three scripts show on the same answer:

| Calibration | Decisions | What the UI sees |
|---|---|---|
| patient | 1, at the true end | listening throughout the answer, then thinking, talking |
| balanced | 2 (one false) | survives the breath. At the thinking pause it goes thinking, starts talking for 400 ms, then yields back to listening |
| eager | 3 (two false) | cuts in at the breath pause (thinking, then back to listening before saying a word), and again at the thinking pause (talks 600 ms, then yields) |

63 Vitest tests pass in total. The new `.spec.ts` checks the decision times, the resume-before-talking case, yielding versus talking over, partial and final transcripts around a false cutoff, frame links for cut-off speech, and the response-window prompt.

**What this means for the UI.** After a false cutoff, the cue sequence is listening, thinking, (sometimes talking), listening, all inside a few seconds. In `perceived` mode with delay, that flip lands late and can look like the interviewer "started thinking" after the user resumed (micro-pauses §6). The reducer and announcement logic must not announce a state that has already been replaced by the time it arrives, and the one-announcement-per-change rule (CUE-ANN-001) will be stress-tested by exactly these scripts.

**What it does not do.** It does not model a detector's real behavior, only a policy with fixed thresholds. It has no adaptive grace period, no fillers, no semantic completeness, and no backchannels. It is for exercising the UI and for stating the question; measuring real detectors is the listening prototype's job.

## Cue reducer, strategies and first UI (2026-10-05)

In `src/prototypes/ui/src/core/cues/` (pure TypeScript) and `src/ui/`:

- **The display is a function of the log.** `laneAt(log, timeline, nowMs)` folds the events whose time on a timeline has come. The reducer keeps every event received and never stores the display as history, so a mode switch re-reads the same log: instant, nothing restarted or replayed (CUE-MOD-002).
- **Strategy in, payload out** (`strategy.ts`, `payload.ts`): a `CueStrategy` says which timeline is shown and whether to expose both lanes. The payload (state, label, icon, sound bed, announcement with an id, chime flag, simulation badge, identical-modes note, lanes) is what the UI renders. The UI decides nothing.
- **`CueEngine`:** wires an `EventSource` and a `Clock` to the reducer. Events arrive at true time, and the engine wakes the display at each moment a watched timeline changes, so in `perceived` mode a cue appears at its perceived time. A drifting `SimulatedClock` shifts the whole thing, which a test checks.
- **UI:** `CuePanel` (icon plus words, polite live region, badge, debug lanes), a scenario picker, a cue-mode radio group with the "look the same" note, a sound toggle, Start and Restart. A placeholder chime (two generated tones, Web Audio) sounds on the hand-off to the user and only after a click.
- **Perceived delay has no simulator yet.** The engine tests stand in for it by adding 800 ms to every perceived time. That is a test helper, not the simulator's job done.

Test counts at this point: 98 Vitest tests (unit and component) and 16 Playwright tests (8 per browser, Chromium and Firefox, including axe scans), all passing on the dev machine. The first WCAG audit entry is in `src/prototypes/ui/audit/main-page.md`. It lists what is **not** yet checked, notably a screen-reader pass.

CUE vectors, state of play:

| Vector | Status |
|---|---|
| 1 Simulation off, same cues in both modes | Done (`engine.spec.ts`) |
| 2 800 ms downlink delay | Done with the test stand-in for the simulator |
| 3 Mode switch mid-session | Done |
| 4 Dropped frames, talking cue holds | **Not done.** The talking-cue hold (CUE-MOD-005, CUE-TGT-001) is not implemented, and no dropped-frame script exists |
| 5 Clipped ending | Not done, same reason |
| 6 Captions in each mode | Not done. Captions are not built |
| 7 Announcements, one per change | Done (`engine.spec.ts`, and a DOM check in Playwright) |
| 8 Equivalent in another sense for every cue | Partly: payload carries label, icon, bed and words for every state. The sound beds (room tone, scribbling) are not made yet, so the audio half is untested |

**Surprise.** Making the displayed state a pure function of the log was the choice that made mode switching, debug lanes and drifting clocks all cheap. It costs a refold of the log on every event, which is fine at these sizes. At about 100 audio frame events a second it will want an index or trimming. Not measured yet.

## Findings for the spec

Proposed changes to `specs/events` and neighbours, each with the reason. None applied.

1. **State the time unit and wire names.** *Decided by Steven, 2026-10-05.* The spec requires 1 ms resolution but names no unit, and `SPEC.md` §7 shows seconds (`t_true: 4.210`). The draft now uses **milliseconds** (fractions allowed), named `t_true_ms` and `t_perceived_ms`, matching the existing `dur_ms`. Reason: latency emulation is tuned at the millisecond level, where a person starts to notice a delay (Steven recalls 180 to 300 ms, which is consistent with SPEC §2's measured gap but not verified here), so every layer needs milliseconds and the browser clock and our `Clock` port already use them. The name carries the unit so nobody has to guess. `SPEC.md` §7 and its examples should change to match.
2. **`SPEC.md` §7's examples lack fields the spec requires.** The sample events have no session identifier or position (EVT-CORE-002). The draft adds both.
3. **Format version is not an event.** EVT-CORE-005 does not say where the version lives. The draft puts it in a `StreamHeader` sent first, as `src/design/events` proposes, so a consumer can refuse a stream before it parses any event.
4. **Interviewer text and its frames.** EVT-TYPE-006 says text MUST be linkable to frames. Text can be produced before its audio, so the draft makes `frames` optional and sentence-level (`from_seq`, `to_seq`). As-heard captions can only be built once the link exists. The speech layer's spec should say when it is supplied.
5. **Ignoring unknown fields vs validating known ones.** EVT-EXT-004 says to ignore unknown fields. The draft also validates the fields it knows, and rejects an event whose known fields are malformed. The spec does not say what a consumer does with a malformed known event. Proposal: treat it as invalid, report it, and carry on with the stream.
6. **A partial transcript piece cannot replace others.** EVT-TYPE-005 says a final piece names what it replaces. The draft also rejects `replaces` on a non-final piece. Add this to the spec if it is wanted.
7. **Control requests are not events.** The spec says controls are events (EVT-TYPE-007), and EVT-CORE-004 says only the authority assigns positions and times. So what the UI sends up cannot be an event. The draft adds a `ControlRequest` with no position or time, and the authority answers with a `control` event. The spec should name both.
8. **A state change has no reason.** After a false cutoff the stream shows thinking, then listening again, with no field saying the interviewer yielded or was cut off. A cue layer, a debug view and a session report would all benefit from a `reason` on state events (for example `turn_decided`, `user_resumed`, `prompted`). Optional, and additive under EVT-EXT-002.
9. **The calibration is part of the record.** A session's cues only make sense next to the turn policy that produced them (endpointing delay, response window, double-talk policy). `session` lifecycle events (EVT-TYPE-009) say "configuration that matters to later reading". The turn policy belongs in that configuration, and it should be tied to the turn-detector spec's settings (SPEC §3.4 `max_silence_secs`, which the micro-pause research says to split).
10. **A turn decision should say what it was based on.** `turn_decision` carries a confidence only. A false cutoff and a true end look the same except for the number. Fine for now, but debug mode (CUE-DBG-001, "listening decisions") will want the silence length that triggered it.
11. **No type for "state of the session" snapshot.** EVT-DELIV-002 allows a snapshot for late joiners, but no event or message shape exists for one. Not drafted yet.
