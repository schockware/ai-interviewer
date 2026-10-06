*Authored by Steven Chock, with Claude Sonnet 5.5 (Anthropic) as co-author.*

# Synopsis
We keep our prototyping area away from our prod ready code when we haven't proven out the technology in isolation first.

We then graft the proven technology into our prod ready code. This is to avoid the anti-pattern "Prototype as Product".

## Prototyping cadence
Our timebox for prototypes is measured in half day increments. If a technology takes more than 1.5 days, we typically abandon it unless there is nothing better. 

This allows us to keep the timeline tight and screen for more optimal choices. If every choice takes longer than 1.5 days it implies we may have a tricky domain on our hands and we try to derisk the area.

# Running the prototype

The brief is [src/design/ui/PROTOTYPE.MD](../../design/ui/PROTOTYPE.MD). Run every command below from this folder (`src/prototypes/ui/`).

## Requirements

- Node.js 24 or newer (built and tested on 24.19.0) and npm.
- Playwright browsers, installed once (see below).

## First-time setup

```
npm install
npx playwright install chromium firefox
```

## Run the app

```
npm run dev
```

Open http://localhost:5173. The page is the interview screen from `design/mockups/ui/Main.dc.html` (iteration 1) with the Accessibility panel from `Accessibility.dc.html`. The cue engine and the scripted mock interviewer are live. Drawn but not wired: the Controls buttons, the microphone row, the caption text (the mockup's sample lines), and every Accessibility setting except captions. The setup and hardware pages in `contracts/page-flow.md` have no mockups yet and are not built. The port is fixed at 5173 because the Playwright tests use it.

## Tests

| Command | What it does |
|---|---|
| `npm test` | Runs the Vitest tests once (core, adapters and component tests, in jsdom) |
| `npm run test:watch` | Reruns Vitest tests when files change |
| `npm run test:e2e` | Runs the Playwright tests in Chromium and Firefox, with an axe scan at WCAG 2.2 AA. Starts the dev server itself, or reuses one already on port 5173 |
| `npm run typecheck` | Type-checks with `tsc -b` |
| `npm run lint` | Runs oxlint |

Playwright writes its output under `benchmarking/results/prototypes/ui/playwright/`, which is gitignored.

## Test conventions

Decided by Steven, 2026-10-05.

- **Tests live next to the thing they test.** `Button.tsx` has `Button.test.tsx`. `getSomething.ts` has `getSomething.spec.ts`.
- **`.spec.` and `.test.` mean different things:**
  - A **`.spec.`** describes a domain behavior or checks a known specification or requirement (cite the ID, such as `CUE-MOD-005`). It must survive refactoring, so it asserts on behavior and not on how it is built.
  - A **`.test.`** describes a tightly coupled UX, component or integration behavior that constrains how something works. It does not satisfy a specification. Examples: on hover, invalid choices gray out; on click, a message is published for subscribers; a button label in every translation stays inside its maximum width and height.
- **Behavior testing is first class and sits beside `src/`,** not inside it: `e2e/` for browser journeys (Playwright), and a sibling `bdd/` for behavior scenarios once we have some. The `bdd/` folder does not exist yet.

Both suffixes are picked up by `npm test`. A rule of thumb for choosing: if a requirement ID or domain rule explains why the test exists, it is a `.spec.`. If the reason is "this is how we want it to feel or fit together", it is a `.test.`.

## Layout

| Folder | Holds |
|---|---|
| `src/core/` | Pure TypeScript: ports, the event contract (`contract/`), and the cue reducer, strategies and engine (`cues/`). Imports nothing from the other folders |
| `src/adapters/` | Implementations of the ports: clocks, the mock event stream and calibrated mock interviewer (`mock/`), placeholder cue sounds |
| `src/ui/` | React components. They render what they are given and decide nothing |
| `e2e/` | Playwright browser journeys (sibling of `src/`) |
| `bdd/` | Behavior scenarios (sibling of `src/`). Not created yet |
| `audit/` | WCAG audit logs, one per page |
