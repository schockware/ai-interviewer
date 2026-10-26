*Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.*

# WCAG 2.2 AA audit log: QA accommodation canvas

Page: `/qa.html` (the chooser and the five profiles). Target: WCAG 2.2 level AA for the canvas itself. The simulations deliberately break some criteria (black on black fails contrast by design); they are opt-in, off by default and switched off by the same control. Newest entry first.

## 2026-10-26: first entry

Environment: Linux cloud container, Node 22 (the README asks for 24), Playwright 1.63.0, Chromium only (Firefox was not installed), `@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

| Criterion | Level | How checked | Result | Note |
|---|---|---|---|---|
| All rules in the axe tag set | A, AA | Automated, `e2e/qa.spec.ts`: chooser, every profile, cheat sheet open, dyslexia with scramble and text spacing on | Pass, Chromium | Firefox not run |
| 1.4.3 Contrast, with blackout on | AA | Automated: axe with `color-contrast` disabled while blacked out | Pass for the other rules | The black-on-black text fails contrast on purpose. The controls bar and cheat sheet keep normal colors |
| 1.3.1, 4.1.2 Blackout keeps the tree | A | Automated: the passphrase is black on black yet found by role and text, and the check passes through its label | Pass | Not read by a real screen reader |
| 4.1.3 Status messages | AA | The passphrase result is `role="status"` in the controls bar | DOM only | Not confirmed with a screen reader |
| 2.4.3 Focus order, no focus theft | A | Automated: the blackout and cheat sheet buttons keep focus when pressed. The interviewer frame loads only on request, because the app focuses its Accessibility button on load | Pass | |
| 1.4.10 Reflow | AA | Script at 320 px wide on every profile: no sideways scroll | Pass after a fix (select widths) | Zoom to 400% not checked by eye |
| 1.4.12 Text spacing | AA | The dyslexia profile applies the 1.4.12 values to its own stage | Not checked for clipping by eye | |
| 2.2.2 Pause, stop, hide | A | The scramble changes text every 1.2 s only while its checkbox is on; under `prefers-reduced-motion` it scrambles once and holds | By construction | |
| 2.4.11 Focus not obscured | AA | The controls bar is sticky only on screens at least 900 by 720 px, with `scroll-padding-top` set | Not checked by eye | |

Not covered: any screen reader pass (the canvas and its cheat sheet are for screen reader testing, so this matters most), Firefox and Safari, a person's keyboard-only walk, forced colors.
