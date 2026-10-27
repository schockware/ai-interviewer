*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# api (prototype)

C# .NET 10 hexagonal Web API. **Prototype zone: nothing here is verified.** It follows [decision 0003](../../../docs/decisions/0003-transport-ui-and-service-architecture.md) and implements the page-flow contract in [`contracts/page-flow.md`](../../../contracts/page-flow.md) (setup, hardware, start). No real AI runs yet: every AI layer is a stub adapter.

## Layout

```
AiInterviewer.slnx
src/
  AiInterviewer.Business/   the hexagon: contract types, ports, use cases. References nothing.
  AiInterviewer.Adapters/   tier 3: SQLite stores (Sqlite/), in-memory stores, stub AI layers and the sample persona loader (Samples/). References Business.
  AiInterviewer.Api/        tier 1: endpoints, wire DTOs, JSON, composition root (Program.cs, Storage.cs). References both.
tests/
  AiInterviewer.Business.Tests/   unit tests against hand-written fakes, plus an architecture guard
  AiInterviewer.Adapters.Tests/   one store contract suite run against the in-memory and SQLite adapters, plus SQLite persistence tests
  AiInterviewer.Api.Tests/        HTTP tests through the real pipeline (WebApplicationFactory), on a private SQLite database per server
```

Dependencies point inward only. `ArchitectureTests` fails if Business references anything beyond the base class library.

## Run

```
dotnet run --project src/AiInterviewer.Api      # http://localhost:5036, OpenAPI at /openapi/v1.json in Development
dotnet test AiInterviewer.slnx
```

### Connecting the UI prototype

The connection information is public and lives in committed files on both sides; there are no secrets yet (decision 0004).

| Side | File | Holds |
|---|---|---|
| API | `src/AiInterviewer.Api/Properties/launchSettings.json` | The address this API listens on, `http://localhost:5036` (profile `http`) |
| API | `src/AiInterviewer.Api/appsettings.Development.json` | `Cors:AllowedOrigins`, the browser origins that may call this API directly. Development names the UI dev server, `http://localhost:5173`. Outside Development the list is empty and no cross-origin call is allowed |
| UI | `../ui/.env.dev` | The mode, the proxy target (this API's address) and the URL the browser calls |

Start this API, then `npm run dev:real` in `../ui`. The UI's dev server proxies `/api` here, so CORS is not needed on that path; the CORS policy is for calling this API directly from the page.

## Test mode

Steven's call (2026-10-26): integration tests must run quickly while UX sessions play with the UI at design pace, so mock options are settable per request. A request may carry `X-Mock-*` headers; `Testing/TestModeMiddleware.cs` reads them before any endpoint runs. The injected `ResumeUploaderOptions` stay the **defaults**; `IResumeUploader` has a second `BeginAsync` that takes explicit options, and the `/resumes` endpoint uses it for a request that brought a header. Nothing is scoped or swapped.

| Setting | Meaning | Default |
|---|---|---|
| `TestMode:Enabled` | Whether `X-Mock-*` headers are honored. Off: any such header is a **400** with the reason, never silently ignored. The client never decides the server's mode (decision 0004) | `false`; `true` in `appsettings.Development.json` |
| `MockUploader:MinStepDelayMs`, `MaxStepDelayMs` | The uploader's pace when no header says otherwise | 3000, 8000 |

| Header | Value | Effect |
|---|---|---|
| `X-Mock-Uploader-Options` | JSON `{ "minStepDelayMs": 0, "maxStepDelayMs": 0, "seed": 42 }` (`seed` optional) | Explicit options for the resume this request uploads; a seed makes its steps and pauses repeatable. Malformed JSON, an unknown field, a negative minimum or a minimum above the maximum is a 400 |

Header names are case-insensitive, as HTTP headers are. A header starting with `X-Mock-` that this server does not know is a 400. The UI sends these headers from its test drawer (`?mode=test`); the HTTP tests send them too, instead of overriding the options in the test host.

## Storage

Resumes, roles, their questions and sessions are kept in SQLite by default and survive a restart. The `Storage` section of `appsettings.json` picks the adapter; a value it does not know stops the app from starting instead of falling back.

| Setting | Values | Default |
|---|---|---|
| `Storage:Provider` | `Sqlite` persists. `InMemory` is for mock and test mode and forgets everything on restart (decision 0004, mocks in production, point 5) | `Sqlite` |
| `Storage:Sqlite:Path` | A file path, relative to the project folder, or `:memory:` for a private database that lives as long as the process | `data/ai-interviewer.sqlite` |

Under `dotnet run` the file lands at `src/AiInterviewer.Api/data/ai-interviewer.sqlite`, which is gitignored. Delete the folder to start over. The schema is created on open. The only migration is a list of columns added since a table first shipped (`SqliteDatabase.AddedColumns`: `source` on resumes and roles, 2026-10-27), which an older file gains on open; any other schema change still means deleting the file. A session saved before 2026-10-27 has no question plan and is reported as unreadable, so delete the file after pulling this change. The HTTP tests use `:memory:`, so they run through the SQLite adapter and never touch that file. Steven decided 2026-10-26: SQLite is the local-development store, and the persistence ports stay completely agnostic of the engine. The `Sqlite/` folder is the only place that knows SQLite; adapters for MSSQL, MySQL, PostgreSQL, MongoDB and CosmosDB are a task (`TASKS.MD`), each to pass the same store contract suite.

## Samples

Steven's call (2026-10-27): the sample personas in [`mocked-samples/ai-interviewer-test-personas/output`](../../../mocked-samples/README.MD) are loaded for the interview. `Adapters/Samples/PersonaSamples.cs` reads `profiles.json` and `questions/question_bank.json` and adds, per persona, a role (the role title, with the job description as its description), the bank's five core questions as that role's questions, and the resume as a saved resume. Loading is keyed by persona id (`DocumentSource` on each document), so a restart adds nothing.

| Setting | Meaning | Default |
|---|---|---|
| `Samples:Path` | The `output/` folder, relative to the project folder. Empty: nothing is loaded. A path that does not exist stops the app at startup | empty; `appsettings.Development.json` points at the repo folder |

The HTTP tests set it empty so every server starts with no roles; `SampleLoaderTests` in the adapters tests load the real folder.

## Endpoints

| Route | Contract | Success | Failure |
|---|---|---|---|
| `GET /application-setup` | `ApplicationSetupPage` | 200 | |
| `POST /resumes` | `UploadResume` -> `ResumeProcessed` | 200 | 422 unreadable file |
| `POST /job-descriptions/uploads` | `JobDescriptionUpload` -> `JobDescriptionProcessed` | 200 | 422 |
| `POST /job-descriptions/pastes` | `JobDescriptionPaste` -> `JobDescriptionProcessed` | 200 | 422 empty text |
| `GET /roles/{roleId}` | -> `RoleDetail` (PROPOSAL): the description and the saved questions | 200 | 404 unknown role |
| `POST /roles/{roleId}/question-uploads` | `UploadQuestions` -> `QuestionsProcessed` (PROPOSAL): stored for the role, not yet its questions | 200 | 404 unknown role, 422 unreadable or no questions found |
| `POST /roles/{roleId}/question-pastes` | `PasteQuestions` -> `QuestionsProcessed` (PROPOSAL) | 200 | 404, 422 |
| `POST /interviews/prepare` | `PrepareInterview`, now with `form.questions` (PROPOSAL) | 202 | 422 form not ready |
| `POST /interviews/error-checks` | `CheckErroredInterview` -> `Error` | 200 | 404, 409 nothing failed |
| `POST /interviews/start` | `StartInterview` -> `CueSettings` | 200 | 404 not prepared, 409 not ready |

### Media streams (plain WebSockets)

Steven's call (2026-10-26): the browser's audio, and optional video, travel over a regular WebSocket, not SignalR. One stream per track **per question** at `/streams/{sessionId}/{questionId}/{track}`, `track` being `audio` or `composite` (questions are not generated yet; the UI uses a placeholder id for its one question). PROPOSAL for decision 0003's open item 1:

| Message | Meaning |
|---|---|
| First, text | A JSON header: `{ "mimeType": "audio/webm;codecs=opus" }`, whatever the browser's `MediaRecorder` produces |
| Then, binary | One recorder chunk each (the UI sends one every 250 ms), in order. A chunk may arrive in several frames; it is reassembled |
| Close | Ends the stream. The server completes every sink and closes with `"{n} chunks stored"` |

A missing or malformed header, or a text message after it, closes the socket with a policy violation. A plain HTTP request, a blank session or question id, or an unknown track is a 400. Any non-blank session id is accepted, because session management is not designed yet. When the audio track closes, the post-question pass starts on its file (below).

Inside, `MediaIngestService` (Business) fans each chunk out over one **bounded channel per sink** (`System.Threading.Channels`, capacity 32 chunks), so a slow sink holds the socket's read loop instead of losing chunks. `FileMediaStore` writes every track to `{Media:Root}/{sessionId}/{questionId}/{track}-{startedUtc}.{ext}` (`data/media` by default, gitignored), appending and flushing chunk by chunk so the file is valid as far as it got; the audio file stands alone so the post-question transcription reads clean audio, and the composite keeps video with its audio. The audio track's other sink is the transcription feed (next section).

### Transcription (the Python worker over gRPC)

Two passes, both served by `src/prototypes/ai/transcriber` (one Python process, two gRPC services; the contract is `contracts/ai/transcription.proto`, settling decision 0003's open item 5):

| Pass | Model (PROPOSAL, decision 0001) | How |
|---|---|---|
| Real time | whisper base, int8, CPU | `GrpcRealTimeTranscriptionFeed` is the audio track's sink: one bidirectional call per question, every chunk forwarded as it arrives, partial text back while the user speaks and final text as segments settle, each final naming the partials it replaces (STT-STR-002) |
| Post question | faster-whisper large-v3-turbo, float16, GPU (falls back to the CPU) | When the audio track closes, `PostQuestionService` asks the worker to read the finished file, which both processes can see |

Every piece and every failure goes to the transcript sinks: `TranscriptBroadcaster` pushes them to the page over the `InterviewHub` (`WatchTranscript(sessionId)` returns what was said so far, then `transcriptSegment` and `transcriptFailed` arrive), and `FileTranscriptStore` appends them as JSON lines to `{Media:Root}/{session}/{question}/transcript-{real-time|post-question}.jsonl`, which is what the accuracy comparison between the passes will read.

| Setting | Values | Default |
|---|---|---|
| `Transcription:Provider` | `Grpc` talks to the worker. `Counting` keeps a stand-in that counts the audio and has no post-question pass (the tests, or a machine without the worker) | `Grpc` |
| `Transcription:Address` | Where the worker listens | `http://localhost:50051` |

A worker that is not running is reported to the page as a failure of that pass; the audio still reaches its file. Start the worker with `python -m transcriber.server` in `src/prototypes/ai/transcriber` (see its README).

### Real-time (SignalR)

SignalR carries the WebSocket channel. Hubs speak the same JSON as the endpoints (`Wire/WireJson.cs`: camelCase, enums as the contract's strings).

| Hub | Method | Behavior |
|---|---|---|
| `/hubs/interview` | `WatchResumeUpload(string resumeId)` | Joins the caller to that resume's processing reports and returns the latest `ResumeUploadProgress` snapshot. Every later snapshot arrives on the client method `resumeUploadProgress`. A blank id, or a resume this server never processed, throws `HubException` |
| `/hubs/test` (Development only) | `Echo(string message)` | Calls the caller's client method `echo` with `message` |
| `/hubs/test` (Development only) | `Probe(string method, string message)` | Calls the caller's client method named `method` with `message`. A blank `method` throws `HubException` |

`ResumeUploadProgress` (PROPOSAL; the contract has no shape for it): `{ resumeId, displayName, status: "running" | "done" | "failed", steps: [{ name, status: "pending" | "running" | "done" | "failed" }] }`. Each report is a whole snapshot, so a late watcher needs only the latest one. `POST /resumes` still answers synchronously with the id; processing starts as it answers, and the first snapshot exists before the response leaves, so a watch right after the upload always finds it. The latest snapshot per resume is kept in memory only (`Hubs/ResumeUploadBroadcaster.cs`).

Session management is not designed yet: a client names what it wants to watch, and there is no per-session identity. `ServerCue` and `ClientCue` delivery do not exist.

Any malformed body (missing or null field, unknown property, unknown discriminator, numeric enum, blank id) is a 400 with `{ "message": ... }`. Paths follow the OpenAPI draft; **the status codes are that draft's proposals.**

## Proposals and guesses (need Steven's judgment)

- **`{custom-local}` and `{cloud}` wire shape.** The contract leaves them undefined. Here they are `{ "type": "custom-local" }` and `{ "type": "cloud" }`, and a named option is a bare string.
- **`roleFocus` on the wire** is one string: `"unanswered"` or a RoleId, as the contract writes it. A RoleId spelled `unanswered` therefore cannot exist.
- **Cue settings values.** The contract has the shape, not the values. `CueSettings.CleanCallProposal` is all zeros with ratios of 1.0 (a clean call) and a `clipped-ending` ramp, as placeholders.
- **Hardware readiness.** Audio must be verified and rated clear, intermittent or readable. Video may be skipped, but a video check that ran must also pass. The spec says only "required hardware settings".
- **`hot-incomplete=>cold`** is accepted and stored as a cold interview, so the preparer sees what it will build.
- **Preparing the same `sessionId` again replaces the session** (treated as a retry).
- **The error-checks response** reuses `Error` as a diagnosis message, as the OpenAPI draft does.
- **Roles** are those the user adds plus the sample personas' (Samples above). The "industry-standard titles" list from the spec is not built beyond that.
- **Role set up and the questions** (specs/page-flow.md, section 2; `Business/Setup/Questions.cs`). `form.questions` is `{ "type": "keep" }`, `{ "type": "generate" }` (the default) or `{ "type": "uploaded", "questionSetId": ... }`. A questions upload or paste is stored as a set and answered at once with its count; it becomes the role's questions only when the interview is prepared with it, which is when the spec says saved questions are purged. `keep` is refused for a role without questions; `generate` purges and writes new ones. A questions document is plain text, one question per line (blank lines and markdown headings skipped, list markers dropped), or JSON: an array of strings, `{ "questions": [...] }`, or one role from the sample bank (`{ "core": [{ "text": ... }] }`). A whole bank is refused. Follow-ups and triggers are not read.
- **Generated questions come from a template stub, synchronously, inside Prepare.** `TemplateQuestionWriter` fills five templates with the role title. The real interviewer model would write them from the description in the preparer's "Writing the questions" step, so this will move once a model is connected.
- **Mock resume processing.** `RandomStepsResumeUploader` invents three to six steps from a fixed pool, pauses 3 to 8 seconds between them by default (Steven set the pace so the UI can be designed against it; test mode changes it per request), and reads no file. A display name containing `fail` fails at a random step (a harness hook).

## Stubs and gaps

- `PlainTextDocumentReader` reads `.txt` and `.md` only. PDF and Word are refused with a message, not guessed at.
- `RandomStepsResumeUploader` stands in for resume processing (see Proposals). A reporter failure ends its run silently; a real pipeline would record its outcome.
- `TemplateQuestionWriter` stands in for the AI writing a role's questions (see Proposals). Seeded resumes are stored as processed without the mock uploader's steps.
- `InstantInterviewPreparer` marks every session `Ok` immediately, so the `Error` path and `InterviewPrepared` delivery are only reachable in tests. How `InterviewPrepared` reaches the client (push or poll) is undecided.
- `ServerCue`, `ClientCue`, `VerifyHardware`, `HardwareVerified` and the audio stream need the WebSocket channel, which is not built. The audio frame format is an open item in decision 0003.
- Storage is a single SQLite file with no migrations (see Storage above). Media files and transcripts land under `data/media` with no index. The transcription worker is the first Python process; C# does not start or supervise it yet (decision 0003, open item 4), and no LLM runtime is connected.
- `ApplicationSetupPage` `loading` has no server path: the server answers `ready`, or `error` if a store is unreachable.

## Conventions here

- Explicit declarations: ids and names are types that cannot be blank, results are `Outcome` (`Succeeded` or `Failed`), unions are sealed record hierarchies, and `required` wire fields reject null. Nullable reference types are on and warnings are errors.
- JSON attributes and converters live only in `AiInterviewer.Api/Wire`. The SQLite session store writes the setup form with its own hand-built JSON (`Sqlite/SetupFormJson.cs`), so the business types stay free of serialization attributes and the stored shape is not the wire shape.
