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

Open http://localhost:5173. The app is the whole page flow from `contracts/page-flow.md`, built from the boards in `design/mockups/ui`: Application setup (`Setup.dc.html`, `SetupHot.dc.html`), then Hardware setup and verification (`Hardware.dc.html`), then the interview screen (`Main.dc.html`) with the Accessibility panel (`Accessibility.dc.html`). `?page=interview` opens the interview directly.

There is no server. A scripted mock host (`src/adapters/mock/mockSetupHost.ts`) stands in for it, and each page has a "Prototype harness" card, which is not in the mockups, to make it fail, hold no saved data, retry or fail preparation, or return another audio or video quality. The cue engine and the mock interviewer are live on the interview page. Drawn but not wired: the Controls buttons, the microphone row, the caption text (the mockup's sample lines), every Accessibility setting except captions, Advanced settings (a placeholder dialog), and the simulated call condition chosen on the Hardware page (the interview still plays the simulation-off scenario). No microphone or camera is read: the audio and video checks return a scripted quality (the contract leaves the streaming open). The port is fixed at 5173 because the Playwright tests use it.

## Mock or real

Everything runs on mocks by default. Real integrations are opt-in, per [decision 0004](../../../docs/decisions/0004-integration-modes-and-secrets.md) (proposed).

| To | Do |
|---|---|
| Run the UI on mocks (default) | `npm run dev` |
| Run the UI against the API prototype | Start the API (`dotnet run --project ../api/src/AiInterviewer.Api --launch-profile http`), then `npm run dev:real`, which loads `.env.dev`. Or add `?integration=real` to the address |
| Point at another API | Copy `.env.dev` to `.env.dev.local` (gitignored) and change `VITE_API_PROXY_TARGET`, or set `VITE_API_URL` to call an API directly (see `.env.example`) |

The page always says what is real and what is mock. Today, in real mode, **setup and resume processing reports are real and hardware checks are still mock** (the API has no verify endpoint). The interview cues are always scripted. The Prototype harness cards for the mock server only show in mock mode.

**Test mode.** Add `?mode=test` to the address to open the test drawer on the right, for testers and QA engineers. It holds server-side settings; today, the mock resume uploader's pace (Instant, Quick, Design pace, or custom numbers). Each setting rides on every request to the API as a header (`X-Mock-Uploader-Options: {json}`), so it applies per request: an integration run can be instant while a UX session plays at design pace. The API honors the headers only while its own `TestMode:Enabled` is on (it is in Development) and answers 400 otherwise, which the page shows. In mock mode the headers reach no server; the mock has its harness cards. The settings persist for the tab (`sessionStorage`). Code: `composition/testMode.ts`, `ui/TestDrawer.tsx`.

**Pre-flight check.** Start interview opens a short interstitial (`ui/PreflightDialog.tsx`, logic in `core/setup/preflight.ts`) listing every requirement: interview prepared, resume processed (for a hot interview), role chosen, audio verified. The resume and role uploads never block the Hardware page, but the interview does not start until they are complete (Steven, 2026-10-26). The dialog waits on anything still in flight and starts the interview by itself once all is ok; a failure stays up with the reason. A resume picked from the saved list, not loaded this session, is taken as processed earlier; the server does not confirm that yet (proposal in `TASKS.MD`).

**Resume processing.** After a resume is loaded, the server keeps processing it (reading, sectioning, indexing; today a mock that invents three to six steps) and reports each step. The UI follows that through the `SetupHost.watchResumeUpload` port: the mock host scripts the steps, and the real host connects to the API's SignalR `InterviewHub` at `/api/hubs/interview` (the dev proxy carries the WebSocket). The reports live in a `ResumeUploadProvider` context above the pages, so they survive moving on, and the Hardware page shows them in a "Resume processing" card that is not in the mockup. The shapes are a proposal; the contract has none.

**Env files hold public values only.** `VITE_` variables are bundled into the page. Only `.env.example` and `.env.dev` are committed, and a test fails if another `.env*` file or a secret-sounding name appears. `.env.dev` holds the connection to the API prototype on this machine: the mode, the proxy target and the URL the browser calls. There are no secrets today; see the decision for where the first one will go.

**How the two prototypes see each other.** The browser calls `/api/...`, the Vite dev server forwards it to the API at `VITE_API_PROXY_TARGET` (default `http://localhost:5036`), and the API answers from the same port it names in its `launchSettings.json`. The proxy means no CORS is involved. The API also allows the origin `http://localhost:5173` (its `appsettings.Development.json`), so setting `VITE_API_URL=http://localhost:5036` to call it directly works too.

## Tests

| Command | What it does |
|---|---|
| `npm test` | Runs the Vitest tests once (core, adapters and component tests, in jsdom) |
| `npm run test:watch` | Reruns Vitest tests when files change |
| `npm run test:e2e` | Runs the Playwright tests in Chromium and Firefox, with an axe scan at WCAG 2.2 AA. Starts the dev server itself, or reuses one already on port 5173. Set `E2E_PORT` (for example `E2E_PORT=5174 npm run test:e2e`) to run beside a dev server you are using, since a reused server keeps its own mode |
| `npm run test:integration` | Runs the real-API tests (`*.integration.spec.ts`). Needs the API running with its test mode on (Development); skips loudly if it is not running. `INTEGRATION_REQUIRED=1` makes the skip a failure |
| `npm run test:e2e:real` | Runs the real-integration browser tests (`*.real.spec.ts`). Starts the UI in real mode and the API prototype itself |
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
| `src/adapters/` | Implementations of the ports: clocks, the mock event stream and calibrated mock interviewer and mock setup host (`mock/`), the real API client (`http/`), placeholder cue sounds. `setupHostContract.ts` is the behavior suite every setup host must pass |
| `src/composition/` | The one place that picks which adapter backs which port (mode, host wiring). May import everything; nothing imports it except `ui/App` |
| `src/ui/` | React components. They render what they are given and decide nothing. `ResumeUploadProvider.tsx` and `resumeUploads.ts` are the one piece of state above the pages: the resume uploads context with the processing reports |
| `e2e/` | Playwright browser journeys (sibling of `src/`) |
| `bdd/` | Behavior scenarios (sibling of `src/`). Not created yet |
| `audit/` | WCAG audit logs, one per page |
