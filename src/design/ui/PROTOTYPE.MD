*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Prototype brief: UI (React, mock event stream)

Status: **draft for discussion.** Read [PROTOTYPES.MD](../PROTOTYPES.MD) first. This brief departs from it in places, listed under "Departures". Layer spec: [`specs/cues`](../../../specs/cues/README.MD) (CUE). Architecture: [decision 0003](../../../docs/decisions/0003-transport-ui-and-service-architecture.md).

## Question this prototype answers

Can the cue, caption and control requirements in CUE be met by a browser UI that renders **only** from an event stream, with no backend and no models, and can it be shown to meet WCAG 2.2 AA?

## Decisions already taken (by Steven, 2026-10-05)

| Topic | Decision |
|---|---|
| Event source | A **mock event stream** first. A real WebSocket adapter plugs in later |
| Structure | Ports and adapters, as in the back end, so each module is testable alone and can be grafted in later |
| Stack | Vite, React, TypeScript. Plain reducer for state |
| Test tooling | Research whether Playwright earns its place beside the unit tests (see Research) |
| Cues | The presentation layer renders cues **as received**. A middle layer chooses the strategy that produces the cue payload |
| Audio assets | Placeholder chimes and sounds. Simple built-in browser audio or MIDI-style tones are fine |
| Accessibility | WCAG 2.2 AA, with a **WCAG audit log per page** |
| Audio capture | Left for later |
| Browser settings | A quick link to **reset stored browser settings** |

## Proposed structure

```
src/prototypes/ui/
  core/            pure TypeScript, no React, no browser APIs (the "business" module)
    ports.ts         interfaces it needs: EventSource, Clock, CuePlayer, SettingsStore
    reducer.ts       state machine: events + preferences -> UI state
    cueStrategy/     middle layer: perceived | true_state | debug -> cue payload
  adapters/        mock event stream, Web Audio tone player, localStorage settings
  ui/              React components. Render the payload. Decide nothing
  audit/           WCAG audit log, one file per page
```

Rules, copied from decision 0003: `core/` imports nothing from `adapters/` or `ui/`, names no framework, and can run in a test with every port replaced by a recorded stand-in. `ui/` never reads the raw event stream, only the payload.

## Scope of the first cut

In:
- States: listening, thinking, talking, idle (CUE-STA-001 to 003)
- Visual, audio and text cue for each state, with labels (CUE-RED-001, 002)
- One `aria-live` announcement per displayed change (CUE-ANN-001, 002)
- Cue-mode toggle, with the "identical with no simulation" note (CUE-MOD-001 to 003)
- Talking-cue hold through short gaps (CUE-MOD-005, CUE-TGT-001)
- Captions in both modes, with size and contrast controls (CUE-CAP-001 to 004)
- Ambient mute and volume, reduced motion (CUE-AMB-001, CUE-MOT-001)
- Controls: pause, resume, repeat, skip, hint, "give me a sec", voice/text switch (CUE-CTL-001, 002)
- Simulation badge and first-use explanation (CUE-SIM-001)
- Reset-settings link

Out for now: microphone and speaker capture, the real WebSocket, the debug dual-lane timeline (CUE-DBG-001), JSON export, push-to-talk behaviour beyond a visible control.

## Mock event stream

Scripted JSON files in the shape of `SPEC.md` §7, with both `t_true` and `t_perceived`, and `dropped` where relevant. Scripts to start with, one per planned vector in CUE:

1. Simulation off.
2. 800 ms downlink delay.
3. Dropped frames mid-utterance.
4. Clipped ending.
5. A lossy utterance for the caption modes.

**Calibrated mock interviewer (added 2026-10-05).** The mock also models what the AI has been calibrated for: when it decides the user is done, and how it waits for an answer. A `TurnPolicy` and a user answer written as speech spans generate a script, so the same answer plays out differently under `eager`, `balanced` and `patient` calibrations. This exists because a pause can mean hesitation or the end of a turn ([micro-pauses-and-run-ons.md](../../../docs/research/micro-pauses-and-run-ons.md)). See [prototype-ui.md](../../../docs/research/prototype-ui.md). The latency presets ([latency-perception.md](../../../docs/research/latency-perception.md)) will layer perceived times over these scripts, so the two concerns stay separate: calibration decides what happens and when, simulation decides when it arrives.

Until `specs/events` is turned into a typed contract, the prototype defines a **local draft contract** in `core/` and lists it under "Findings for the spec".

## Measures to report

| What | How |
|---|---|
| Event-to-cue delay (CUE-TGT-002) | Timestamp at port entry and at DOM change, p50, p95, worst, at least five runs |
| Render cost | Frames dropped and main-thread time during a long mocked session |
| Accessibility | WCAG audit log per page (below), plus automated checks (axe) |
| Vectors | Each CUE conformance vector, pass or fail, or skipped with a reason |

The environment record in PROTOTYPES.MD applies, with the browser and version added. The "imitate the minimum spec" rule applies to CPU throttling in the browser rather than core affinity.

## WCAG audit log

One log per page in `src/prototypes/ui/audit/`, committed. Each row: WCAG 2.2 criterion, level, how it was checked (automated, keyboard, screen reader, manual), the tool and version, result, date, and a note. Automated tools find only part of the problems, so every page also gets a keyboard-only pass and a screen-reader pass, and the log says which screen reader. CUE-TGT-003 (the criteria mapping) is a by-product and goes in the summary as a proposal.

## Research needed before building

1. **Playwright versus Vitest with Testing Library.** Playwright drives a real browser, so it can check audio start, real focus order, `aria-live` output and reduced-motion media queries, which a DOM simulation cannot. Compare cost, speed and what each can check, and propose a split. Record the result in `docs/research/`.
2. Screen-reader testing options on Windows (NVDA is free).
3. Which browser audio facilities suit placeholder tones, and the autoplay rules that decide when a sound may start (relevant to CUE-AMB-001).
4. What "reset settings" should clear: stored preferences only, or also permissions. Browsers do not let a page reset permissions, so the link may need to explain how to do it.

## Departures from PROTOTYPES.MD

- Not model-based, so the license filter, weights and `ai-models/` rules do not apply.
- The latency measure is event-to-cue, not turn-end to audio.
- No audio fixtures needed. Mock event scripts are the fixtures.

## Contract drafting (decided 2026-10-05)

`specs/events` has no typed contract yet. This prototype drafts the first pass as a local draft in `core/`: event types, perceived timestamps, and the user control events (EVT-TYPE-007). It is listed under "Findings for the spec", and `specs/events` adopts it, or not, afterwards. This is an implementer noticing a gap and making a first pass, not a spec edit.

## Further decisions (Steven, 2026-10-05)

| Topic | Decision |
|---|---|
| Middle layer | A small interface (strategy in, payload out) is enough. The payload shape comes out of the first vectors |
| Test tools | Vitest 5.0.3 for `core/` and components, Playwright with axe for pages, manual NVDA. See [ui-testing-tools.md](../../../docs/research/ui-testing-tools.md) |
| Clock | Our own `Clock` port, with a drifting `SimulatedClock` for tests |
| Autoplay in tests | Chromium flag and Firefox prefs both in `playwright.config.ts` |
| Portability | `src/prototypes/ui/` is structured so modules move to a future `src/ui` unchanged |
| Reset link | Clears **preferences only**, not the mock session position. It also explains how to reset browser permissions, which a page cannot do |

## Definition of done

As in PROTOTYPES.MD, with: the mock streams run end to end, every CUE vector tried or skipped with a reason, the WCAG audit log started for each page, and the summary in `docs/research/prototype-ui.md`.
