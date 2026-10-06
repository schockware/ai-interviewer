*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# UI testing tools: Vitest and Playwright

Research for the UI prototype ([src/design/ui/PROTOTYPE.MD](../../src/design/ui/PROTOTYPE.MD)). Question from Steven: would Playwright give more mileage than a unit-test tool, given that it is more mature, and what is Vitest? Date: 2026-10-05.

**Reliability of this note:** all sources are secondary (vendor docs plus blog guides found by search). Nothing here was run. Items marked **[unverified]** must be confirmed in the scaffold before they are relied on.

## Short answer

They do different jobs and the project needs both. Playwright is not a replacement for Vitest, and Vitest does not replace Playwright.

| Layer to test | Tool | Why |
|---|---|---|
| `core/` (reducer, cue strategies, timeline maths) | **Vitest**, in Node | Pure TypeScript with no browser. Fastest, and the right place for most of the CUE vectors |
| React components in isolation | **Vitest** with Testing Library, in jsdom to start | Same runner, same syntax. Move to Vitest Browser Mode only for what jsdom cannot do |
| Whole page in a real browser: focus order, `aria-live`, reduced motion, audio start, axe scans, timing | **Playwright Test** | Real browser, real accessibility tree, media emulation, and it feeds the WCAG audit log |
| Screen reader behaviour | **Manual**, NVDA on Windows | No automation drives a screen reader (see below) |

## What each tool is

**Vitest** is a test runner built for Vite projects. It reuses the project's Vite config, so TypeScript and JSX work with no extra setup. Syntax is close to Jest (`describe`, `it`, `expect`, `vi.fn()`). It runs in Node by default. Components render in a simulated DOM (jsdom or happy-dom), with React Testing Library for queries.

**Vitest Browser Mode** runs the same test files inside a real browser instead. Playwright can be the engine behind it, but you still write Vitest-style tests. The Vitest docs describe it as production-ready, and a secondary source says it became stable in Vitest 4.0. The docs page I fetched named version 5.0.3 as current, so check the version when scaffolding. Limits listed by Vitest: native `alert`, `confirm` and `print` hang the run, and `vi.spyOn` on module exports needs `vi.mock(..., { spy: true })`.

**Playwright Test** runs in Node and drives a real browser (Chromium, Firefox, WebKit) from outside, the way a user would. It is the usual choice for end-to-end tests. It also has a component-testing mode, but it serializes the JSX in the test and rebuilds it in the browser, which makes it a poorer fit for component work than Vitest Browser Mode. Sources call that mode more awkward, and one source group suggests Playwright is better kept for full journeys. I did not confirm whether it is still labelled experimental **[unverified]**.

## Why not Playwright for everything

- **Speed and feedback.** The reducer and cue strategy are where most CUE vectors live. They need no browser, and a Node test runs in milliseconds.
- **Architecture fit.** Decision 0003 makes `core/` a module that can run with every port replaced by a stand-in. Testing it in a browser would hide whether it truly has no browser dependency. Running it in plain Node proves that.
- **Component isolation.** Playwright cannot call `react-dom`'s `render()` directly, so component tests are indirect.

## Why not Vitest for everything

jsdom is a simulation. It does not compute layout, real focus order, CSS media queries, colour contrast or the accessibility tree, and it has no real audio. Several CUE and WCAG items need those, so a real browser is required for them.

## What Playwright gives this project

| Need | Playwright feature | Source status |
|---|---|---|
| Reduced motion (CUE-MOT-001) | `reducedMotion: 'reduce'` in config or context options, or `page.emulateMedia` | Documented |
| Automated WCAG checks | `@axe-core/playwright` scans the rendered page | Documented in several guides |
| Keyboard-only use (CUE-CTL-002) | `page.keyboard`, plus focus assertions | Standard |
| Announcements (CUE-ANN-001, 002) | Can read the text that appears in the `aria-live` region and count changes | Reasonable, **[unverified]** whether it reflects what a screen reader speaks |
| Timing (CUE-TGT-002) | `page.evaluate` with `performance.now()` around a mocked clock | Needs design in the scaffold |
| Web Audio start (CUE-AMB-001) | Chromium launch flags can relax autoplay rules for tests | A search summary said so without giving the flag. **[unverified]** |
| Many browsers and a throttled CPU | Browser projects and Chrome DevTools Protocol throttling | Standard, throttling **[unverified]** |

## What nobody automates

- **axe-core finds only part of the problems.** The sources agree on a range of about 30 to 50 percent, and a figure of that kind is an estimate, not a measurement. It cannot judge reading order, whether a label is meaningful, or cognitive load.
- **Playwright does not drive a screen reader.** It sees the browser's accessibility tree, not what NVDA says. So the WCAG audit log needs a manual screen-reader pass for each page, as the brief already states.
- Focus management problems, such as whether focus moves correctly, need explicit assertions. axe does not catch them on its own.

## Tool choices to try in the scaffold

1. Vitest, with `jsdom` and Testing Library, for `core/` and components. Start with plain Node for `core/`.
2. Playwright Test with `@axe-core/playwright`, one spec per page, which writes into that page's WCAG audit log.
3. Add Vitest Browser Mode only if a component test hits a jsdom limit. Do not add it first.
4. Keep Playwright specs few and slow-tolerant, and run them separately from the quick Vitest run so the quick loop stays fast.

## Proposed split of the CUE conformance vectors

| Vector | Where it runs |
|---|---|
| 1 to 5 (cue timelines, mode switch, dropped frames, clipped ending) | Vitest on `core/` with recorded event streams |
| 6 (captions in each mode) | Vitest on `core/` for the text, Playwright for what appears on the page |
| 7 (announcement log) | Playwright reading the live region, then a manual NVDA pass |
| 8 (an equivalent for every cue) | Vitest for the payload, and a manual check |

## For someone new to Vitest

- `npm i -D vitest` and a `test` script. Test files end in `.test.ts`.
- `vitest` watches and reruns on change. `vitest run` runs once, which suits CI.
- Fake time (`vi.useFakeTimers()`) lets a test step a mock event stream through seconds of simulated time in a blink. That is the main reason it fits the mock stream design.
- Fake ports are plain objects that implement the interfaces in `core/ports.ts`. Vitest needs no special framework for that.

## Decisions and first results (2026-10-05)

Steven decided:
- Vitest 5.0.3 (the version the docs show as current).
- Our own `Clock` port, so front-end component tests can emulate drift. Built as `SimulatedClock` with offset and drift (`src/prototypes/ui/src/adapters/simulatedClock.ts`).
- Keep the Chromium autoplay flag, and keep the Firefox equivalent on hand. Both are in `playwright.config.ts`: `--autoplay-policy=no-user-gesture-required` and the prefs `media.autoplay.default` and `media.autoplay.blocking_policy` set to 0 (**[unverified]** for Firefox).
- Code lives in `src/prototypes/ui/`, structured so the modules move to an eventual `src/ui` unchanged.

First results, on the dev machine, Playwright 1.63.0 and Vitest 5.0.3:
- 5 Vitest tests pass (clock, App shell). `tsc -b` and `oxlint` are clean.
- 4 Playwright tests pass in Chromium and Firefox (an axe scan at WCAG 2.2 AA tags, and an AudioContext start).
- **The autoplay check does not discriminate.** A control run with no flag and no prefs, in headless Chromium and Firefox on a blank page, also reported `running`. So the test passes either way, and these settings may not be needed in headless mode. Headed runs, and a page with a real user-gesture rule in force, were not tried. Treat the flags as harmless insurance until a headed run shows otherwise.

## Questions this leaves open

1. Whether Playwright's reduced-motion and throttling settings match what real users have. Check against one manual run.
2. Whether a mock clock is easier at the port level (our own `Clock` port) or with Vitest fake timers. Leaning towards our own port, since it keeps `core/` free of test-tool details.
3. How the audit log is written: by hand, or generated from the Playwright and axe output with manual rows added.

## Sources

- [Vitest Browser Mode vs Playwright (Epic Web)](https://www.epicweb.dev/vitest-browser-mode-vs-playwright)
- [Vitest browser mode guide](https://vitest.dev/guide/browser/)
- [Vitest 4 Browser Mode: Component Testing Without Playwright (SitePoint)](https://www.sitepoint.com/vitest-4-browser-mode-component-testing-without-playwright/)
- [Vitest Browser Mode vs Playwright Component (PkgPulse)](https://www.pkgpulse.com/guides/vitest-browser-mode-vs-playwright-component-testing-vs-2026)
- [Playwright Accessibility Testing: What axe and Lighthouse Miss](https://www.davidmello.com/software-testing/test-automation/playwright-accessibility-testing-axe-lighthouse-limitations)
- [Axe-Core Playwright Accessibility Testing: A Practical Guide (QA Madness)](https://www.qamadness.com/a-you-oriented-guide-to-axe-core-playwright-accessibility-testing/)
- [Playwright TestOptions (reducedMotion)](https://playwright.dev/docs/api/class-testoptions)
