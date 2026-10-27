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

Open http://localhost:5173. The app is the whole page flow from `specs/page-flow.md`, built from the boards in `design/mockups/ui`: Application setup (`Setup.dc.html`, `SetupHot.dc.html`), Hardware setup and verification (`Hardware.dc.html`), the Waiting room (`Waiting.dc.html`), then the interview screen (`Main.dc.html`) with the Accessibility panel (`Accessibility.dc.html`). Every page carries the shared status banner (`StatusBanner.dc.html`) and every setup page the shared preparation progress bar (`PrepProgress.dc.html`); see `SharedStatus.dc.html` for which page shows what. `?page=interview` opens the interview directly.

There is no server. A scripted mock host (`src/adapters/mock/mockSetupHost.ts`) stands in for it, and each page has a "Prototype harness" card, which is not in the mockups, to make it fail, hold no saved data, retry or fail preparation, or return another audio or video quality. The cue engine and the mock interviewer are live on the interview page. Drawn but not wired: the Controls buttons, the microphone row, the caption text (the mockup's sample lines), every Accessibility setting except captions, Advanced settings (a placeholder dialog), and the simulated call condition chosen on the Hardware page (the interview still plays the simulation-off scenario). No microphone or camera is read: the audio and video checks return a scripted quality (the contract leaves the streaming open). The port is fixed at 5173 because the Playwright tests use it.

## QA accommodation canvas

Open http://localhost:5173/qa.html. It is a page for QA testers, not part of the candidate flow: pick a profile (Blind, Deaf or hard of hearing, Color vision deficiency, Low vision, Dyslexia), follow its setup steps, prove the accommodation works, then load the interviewer in the page's test stage and use it as that candidate. `?profile=blind` (or `deaf`, `color`, `low-vision`, `dyslexia`) opens one directly. The code is in `src/qa/`.

- **Blind:** setup steps for NVDA, JAWS and VoiceOver (the top three in WebAIM's 2024 survey) and for Narrator, TalkBack and Orca. **Black out the page** turns all content black on black without hiding anything from the accessibility tree, including inside the embedded interviewer. A random passphrase appears only while blacked out, so the tester can only find it by ear. The key cheat sheet stays visible, opens only from its button, never takes focus and is not a live region.
- **Deaf:** setup steps for OS and browser live captions (Windows, macOS, Chrome, Android, iOS, or the candidate's own service), and a spoken test phrase (browser speech synthesis) to check them.
- **Color vision and low vision:** CSS and SVG filters on the test stage only: protanopia, deuteranopia and tritanopia (Machado 2009 matrices), achromatopsia, two blurs and low contrast, plus zoom, magnifier and contrast-theme steps.
- **Dyslexia:** WCAG 1.4.12 text spacing on the stage and the interviewer. An optional word scramble on a sample question only, labeled as an empathy approximation and not a test: the International Dyslexia Association calls that kind of demo "compelling, powerful, and wrong", because dyslexia is mainly a phonological difficulty.

**Every key command, menu path, blur size and filter strength is a proposal**, written from memory or research and not checked on each device. The cheat sheet marks the least certain rows "check" and links each vendor's own list. The audit log is [`audit/qa-canvas.md`](audit/qa-canvas.md).

## Mock or real

Everything runs on mocks by default. Real integrations are opt-in, per [decision 0004](../../../docs/decisions/0004-integration-modes-and-secrets.md) (proposed).

| To | Do |
|---|---|
| Run the UI on mocks (default) | `npm run dev` |
| Run the UI against the API prototype | Start the API (`dotnet run --project ../api/src/AiInterviewer.Api --launch-profile http`), then `npm run dev:real`, which loads `.env.dev`. Or add `?integration=real` to the address |
| Point at another API | Copy `.env.dev` to `.env.dev.local` (gitignored) and change `VITE_API_PROXY_TARGET`, or set `VITE_API_URL` to call an API directly (see `.env.example`) |

The page always says what is real and what is mock. Today, in real mode, **setup and resume processing reports are real and hardware checks are still mock** (the API has no verify endpoint). The interview cues are always scripted. The Prototype harness cards for the mock server only show in mock mode.

**Role set up.** Application setup (step 1 of 4) ends in a Role set up button, held only while a hot interview has no resume at all; Role set up (step 2 of 4, `ui/RoleSetupPage.tsx`, logic in `core/setup/setupState.ts`) holds the role and its questions, built from `design/mockups/ui/RoleSetup.dc.html` and `RoleQuestions.dc.html`. The role starts unanswered. Choosing one asks the host for its detail (`SetupHost.loadRole`): the description shows under the title, and the Setup questions button is disabled while the look-up runs. The questions default to the AI writing them; a role with saved questions keeps them unless the user purges them (the purge happens at Prepare interview, as the spec says); "Upload my own questions" takes a file or pasted text, one question per line or JSON, which the host counts at once (`uploadQuestions`, `pasteQuestions`) and which becomes the role's questions when the interview is prepared with it. Only an unanswered role, the look-up, or an upload chosen with no file holds Prepare; uploads never do. Both pages share one form in `ui/SetupFlow.tsx`, which stays mounted so coming back keeps the choices. The mock host offers the sample personas' roles (`adapters/mock/samplePersonas.ts` reads `mocked-samples/ai-interviewer-test-personas/output` straight from the repo; `vite.config.ts` allows the folder) plus one role without questions, and settles the questions at Prepare the way the API does. The wire shapes are proposals (`contracts/page-flow.md`, Role set up).

**Test mode.** Add `?mode=test` to the address to open the test drawer on the right, for testers and QA engineers. It holds server-side settings; today, the mock resume uploader's pace (Instant, Quick, Design pace, or custom numbers). Each setting rides on every request to the API as a header (`X-Mock-Uploader-Options: {json}`), so it applies per request: an integration run can be instant while a UX session plays at design pace. The API honors the headers only while its own `TestMode:Enabled` is on (it is in Development) and answers 400 otherwise, which the page shows. In mock mode the headers reach no server; the mock has its harness cards. The settings persist for the tab (`sessionStorage`). Code: `composition/testMode.ts`, `ui/TestDrawer.tsx`.

**Waiting room.** Ready for interview on the Hardware page needs the audio check only; it leads to the Waiting room (`ui/WaitingRoomPage.tsx`, logic in `core/setup/waitingRoom.ts`), which shows every step of getting the interview ready in three groups: your materials (the resume being uploaded and read, the job description or role), the interview scripts the AI writes, and voice and connection. The resume steps come from this session's processing reports; the rest from the host's `PrepReport`, which counts the steps the server has finished (a proposal: the list, the order and the count are the UI's, and the real API answers 202 with every step done at once). When all steps are done a short countdown (`COUNTDOWN_SECONDS`, a placeholder for the design's `[N]`) starts the interview; Training options can pause it, and if the pause is on before the room is ready the countdown starts paused. "While you wait" offers interview tips, FAQ or a role review, one placeholder piece at a time. A resume picked from the saved list, not loaded this session, is taken as read earlier; the server does not confirm that yet (`TASKS.MD`).

**Status banner and progress bar.** `ui/StatusBanner.tsx` and `ui/PrepProgressBar.tsx` are the two shared components (`core/setup/status.ts` holds the words and the rule that the most urgent banner wins: problem, uploading, waiting or retrying, ready). Preparation lives above the pages in `ui/PreparationProvider.tsx`, so the banner and bar follow the user back to Application setup. The interview screen keeps an empty banner slot and gained End interview with a confirmation.

**Microphone, camera and the media streams.** The Hardware page's checks open the real microphone and camera through `navigator.mediaDevices` (the devices port, `adapters/browser/mediaStreams.ts`): the meter shows the live level, the camera a preview, and the pickers list the devices once the browser has allowed one. The quality rating is still the host's scripted answer. The devices chosen there carry into the interview, where Start opens the microphone again, and the camera when one passed its check, and streams them (`ui/useCapture.ts`): the browser's `MediaRecorder` cuts each into chunks every 250 ms, in WebM with Opus (`core/media/capture.ts`, a proposal for decision 0003's open item 1). The audio goes out alone on one stream and video with its audio on another, so the server keeps a clean audio file for transcription beside the full recording. In real mode each stream is a plain WebSocket, not SignalR, to the API's `/streams/{sessionId}/{track}` through the `/api` proxy (`adapters/ws/webSocketUplink.ts`); in mock mode the chunks are counted and dropped. The microphone row shows what is recording, the chunks sent, and Mute, which silences the track without stopping the stream. Nothing is transcribed yet; see the api README, Media streams, and `TASKS.MD`.

**Transcript.** The interview page shows a "Transcript (prototype)" card with the two passes side by side: the live one as the user speaks, partials set apart until a final replaces them, and the large model's reading after the question (`ui/TranscriptCard.tsx`, `core/media/transcript.ts`). It follows the session over the hub through `SetupHost.watchTranscript`; the mock host says a scripted answer, and its harness can make the transcriber unavailable. It is not a caption system and announces nothing. The media streams and the transcript are per question; until questions are generated the interview has one placeholder question (`PLACEHOLDER_QUESTION_ID`). In real mode the transcript needs the Python worker running (`src/prototypes/ai/transcriber`); without it the card names the failure.

**Resume processing.** After a resume is loaded, the server keeps processing it (reading, sectioning, indexing; today a mock that invents three to six steps) and reports each step. The UI follows that through the `SetupHost.watchResumeUpload` port: the mock host scripts the steps, and the real host connects to the API's SignalR `InterviewHub` at `/api/hubs/interview` (the dev proxy carries the WebSocket). The reports live in a `ResumeUploadProvider` context above the pages, so they survive moving on; the status banner says "Uploading your resume…" while they run, and the Waiting room shows the step. The shapes are a proposal; the contract has none.

**Env files hold public values only.** `VITE_` variables are bundled into the page. Only `.env.example` and `.env.dev` are committed, and a test fails if another `.env*` file or a secret-sounding name appears. `.env.dev` holds the connection to the API prototype on this machine: the mode, the proxy target and the URL the browser calls. There are no secrets today; see the decision for where the first one will go.

**How the two prototypes see each other.** The browser calls `/api/...`, the Vite dev server forwards it to the API at `VITE_API_PROXY_TARGET` (default `http://localhost:5036`), and the API answers from the same port it names in its `launchSettings.json`. The proxy means no CORS is involved. The API also allows the origin `http://localhost:5173` (its `appsettings.Development.json`), so setting `VITE_API_URL=http://localhost:5036` to call it directly works too.

## Tests

| Command | What it does |
|---|---|
| `npm test` | Runs the Vitest tests once (core, adapters and component tests, in jsdom) |
| `npm run test:watch` | Reruns Vitest tests when files change |
| `npm run test:e2e` | Runs the Playwright tests in Chromium and Firefox, with an axe scan at WCAG 2.2 AA, and a fake microphone and camera so the checks and the capture run headless. Starts the dev server itself, or reuses one already on port 5173. Set `E2E_PORT` (for example `E2E_PORT=5174 npm run test:e2e`) to run beside a dev server you are using, since a reused server keeps its own mode |
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
| `src/ui/` | React components. They render what they are given and decide nothing. `SetupFlow.tsx` holds the setup form for Application setup and Role set up. `ResumeUploadProvider.tsx` and `resumeUploads.ts` are the resume uploads context with the processing reports, above the pages |
| `e2e/` | Playwright browser journeys (sibling of `src/`) |
| `bdd/` | Behavior scenarios (sibling of `src/`). Not created yet |
| `audit/` | WCAG audit logs, one per page |
