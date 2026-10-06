*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# WCAG 2.2 AA audit log: main page

Page: `/` (cue panel, scenario and mode controls). Target: WCAG 2.2 level AA. Newest entry first. Each row says how the check was made, so a pass is never read as more than it is.

**Automated checks find only part of the problems.** Sources put axe-core at roughly 30 to 50 percent of issues ([ui-testing-tools.md](../../../../docs/research/ui-testing-tools.md)). A page is not "passing" until the keyboard and screen-reader passes are also done. The screen-reader pass is **not done yet**.

## 2026-10-06: setup and hardware pages added

Same environment and tags. Pages: Application setup (loading, error, ready, hot resume panel, role focus, settings open, paste dialog) and Hardware setup (preparing, retrying, diagnosing, ready, audio and video checks).

| Criterion | Level | How checked | Result | Note |
|---|---|---|---|---|
| All rules in the axe tag set | A, AA | Automated, `e2e/flow.spec.ts`: setup loading, ready, hot panel with settings open, error; hardware preparing, with a check done, diagnosing | Pass, no violations, Chromium and Firefox | Light theme only. The paste and Advanced dialogs were not scanned |
| 4.1.2 Name, role, value | A | By construction: native radios and selects, `role="switch"` with `aria-checked` for captions, `role="progressbar"` with `aria-valuenow` omitted while indeterminate | axe passes | Not read by a screen reader |
| 3.3.1, 3.3.3 Error identification and suggestion | A, AA | A disabled Prepare interview and Start interview use `aria-disabled` with a list of reasons beside them, so the button stays focusable | Not checked by a person | Whether the reasons list is announced when it changes is open |
| 4.1.3 Status messages | AA | Processing and ready messages, the host status and each check result are `role="status"` | DOM only | Not confirmed with a screen reader; the host banner and progress bar may both speak on one change |
| 2.2.2 Pause, stop, hide | A | The indeterminate bar and skeletons stop under `prefers-reduced-motion` by CSS | Not exercised by a test | |

Not covered: a screen reader pass on either page, a keyboard-only walk by a person, zoom and reflow, and whether the sticky progress bar covers focused controls (2.4.11) on short screens.

## 2026-10-06: interview screen rebuilt from the mockup

Same environment and tags as below. The page is now the mockup layout: Accessibility button, status card, captions (off by default), microphone row, controls, call conditions, and the Accessibility dialog.

| Criterion | Level | How checked | Result | Note |
|---|---|---|---|---|
| All rules in the axe tag set | A, AA | Automated, `e2e/cues.spec.ts`: idle, a cue showing, captions on, Accessibility dialog open, debug lanes | Pass, no violations, Chromium and Firefox | Light theme only; the page is light only now |
| 2.1.1 Keyboard, 2.4.3 Focus order | A | Automated: Accessibility button has focus on load, Enter opens the dialog, Escape closes it and returns focus, Start by Enter, Cues follow by arrow keys | Pass | Not a person's keyboard-only walk. Focus order is DOM order, and the harness controls sit last |
| 2.5.8 Target size | AA | By CSS: buttons, selects and sliders are at least 44 px; checkboxes and radios 24 px | Not measured in a browser | |
| 2.3.3, CUE-MOT-001 | AAA | The talking dots stop pulsing under `prefers-reduced-motion` by CSS | Not exercised by a test | Add one |
| Dialog semantics | A | Native `<dialog>` with `showModal()`, labelled by its heading | axe passes | Focus trap and screen reader reading not checked by hand |

Screen reader pass, zoom and reflow, contrast of the captions Contrast mode, and forced colours are still not done.

## 2026-10-05: first entry (simulation-off scenario, sound on)

Environment: dev machine, Windows 11, Playwright 1.63.0, Chromium and Firefox (as installed by Playwright), `@axe-core/playwright` 4.13.0 on axe-core 4.13.0 with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

| Criterion | Level | How checked | Result | Note |
|---|---|---|---|---|
| All rules in the axe tag set above | A, AA | Automated, `e2e/smoke.spec.ts`, `e2e/cues.spec.ts` (idle, a cue showing, debug mode with lanes) | Pass, no violations, in both browsers | Colour contrast is only checked by axe for rendered text in the system light theme. Dark theme not run |
| 2.1.1 Keyboard | A | Automated keyboard path in `e2e/cues.spec.ts`: Tab to scenario, Start by Enter, sound toggle, arrow keys through the cue-mode radios | Pass in both browsers | A real keyboard-only walk by a person is not done |
| 2.4.3 Focus order | A | Same test, order observed | Pass | Focus order is DOM order: scenario, Start, sound, modes |
| 4.1.3 Status messages | AA | Automated: the live region exists, is `aria-live="polite"`, is empty on load, and receives the new text once per displayed change | Pass for the DOM behavior | **Not confirmed with a screen reader.** Whether it is spoken, and whether rapid changes (the eager scenario flips state within a second) are dropped or queued, is open |
| 1.1.1 Non-text content | A | By construction: icons are `aria-hidden` and sit beside their words (unit test in `CuePanel.test.tsx`) | Pass | |
| 1.3.1 Info and relationships | A | By construction: heading, fieldset with legend for the modes, table with caption and row headers for the debug lanes | Not independently checked | axe did not flag it |
| 1.4.1 Use of colour | A | By construction: state is carried by words and icon, never colour alone | Pass | |
| 2.2.2 Pause, stop, hide | A | By construction: no auto-playing media or moving content. Sound starts only after a click, and the **Sound cues** toggle turns the chime off. A bed of ambient sound is not built yet | Pass for now | Re-check when ambient audio is added (CUE-AMB-001) |
| 2.3.3 Animation from interactions | AAA | No animation exists | n/a | `prefers-reduced-motion` is not yet exercised because there is nothing to reduce. Add a test when animation arrives (CUE-MOT-001) |
| 2.5.8 Target size (minimum) | AA | Buttons and the select are at least 44 px high by CSS. Radio and checkbox inputs are browser defaults | Not measured | Measure the radio and checkbox targets, which may be under 24 px |
| 1.4.4 Resize text, 1.4.10 Reflow | AA | Not checked | Open | Zoom to 200% and 400%, and narrow the window |
| 1.4.3, 1.4.11 Contrast | AA | axe on the light theme only | Partial | Check the dark theme and the border and focus indicators |
| 2.4.7 and 2.4.11 Focus visible and not obscured | AA | Not checked by eye | Open | Browser default focus rings are in use |
| 3.3.x Input and error criteria | A, AA | n/a | n/a | No text input on this page |

## Not covered by any check yet

- Screen reader: NVDA on Windows with Firefox and Chrome. Needed for 4.1.3 and for the reading order of the whole page.
- High contrast and forced colours mode.
- Zoom, reflow and small screens.
- The simulation badge, the first-use explanation, captions, caption size and contrast controls, and the reset-settings link. They are not built yet.
