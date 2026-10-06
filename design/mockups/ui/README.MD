*Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.*

# UI mockups: interviewer cues, iteration 1

Design mockups for the interview screen's cues, from the 2026-10-06 design session. They are not code and are not in either code zone (`src/prototypes/`, `src/prod/`). Nothing here is verified.

Design prototyping happens on a private Design canvas on claude.ai, "Interviewer Cue Design": https://claude.ai/artifact/WQvDtXFX6ZbXbqscJcuT3Q. These files are the **developer-ready snapshot of iteration 1**; build from them, not from the live canvas, which may already hold later work in progress. See [the design lifecycle](../../README.MD).

## Boards

| File | Board | What it shows |
|---|---|---|
| `Main.dc.html` | Interview screen | The page layout: Accessibility button (first focus), status cue, captions (off by default, with the Captions button and "why" help), microphone row, controls, call conditions. Tweaks switch state, cue mode, preset and captions |
| `ScreenReader.dc.html` | Screen reader gating | One audio timeline, the gate on played audio, and the per-transition announcement rules (SPEC.md §4.3) |
| `Accessibility.dc.html` | Accessibility panel | Basics (realistic defaults, captions, voice, screen reader mode, announcements, volumes) and Advanced Accessibility (screen reader profiles, reading rate, timing values) (SPEC.md §4.2-4.6) |
| `States.dc.html` | The four states | Listening, Thinking, Talking, Idle across visual, audio and screen reader channels |
| `Timeline.dc.html` | Handoff timing | One question as true state and as perceived under the Laggy preset |
| `Recovery.dc.html` | Edge moments | Long silence, false cutoff, "Give me a sec", first-time simulator notice |
| `canvas.json` | | The canvas index: board positions, sizes, notes |

## Viewing

The `.dc.html` files are Design Component pages. They load `./support.js`, the canvas runtime, which is not in this folder, so opening them directly in a browser will not render them as designed. View them on the canvas link above. In the repo they serve as a record of the markup, copy and values, and as a starting point for the prototype UI.

## Caveats

- **Every timing value is a proposal** from `docs/research/` (latency-perception.md, micro-pauses-and-run-ons.md, screen-reader-live-updates.md), to be tuned by ear, user test and manual screen reader passes. The accessible timing profile is the default for now (SPEC.md §4.4).
- The boards were never rendered or checked by Claude; Steven reviewed them on the canvas.
- Copy in brackets, such as `[ROLE TITLE]` and `[SHORTCUT]`, is a placeholder.
- The byline comment in each `.dc.html` was added for the repo copy; the canvas versions do not have it.
