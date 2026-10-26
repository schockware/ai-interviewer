*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# api (prototype)

C# .NET 10 hexagonal Web API. **Prototype zone: nothing here is verified.** It follows [decision 0003](../../../docs/decisions/0003-transport-ui-and-service-architecture.md) and implements the page-flow contract in [`contracts/page-flow.md`](../../../contracts/page-flow.md) (setup, hardware, start). No real AI runs yet: every AI layer is a stub adapter.

## Layout

```
AiInterviewer.slnx
src/
  AiInterviewer.Business/   the hexagon: contract types, ports, use cases. References nothing.
  AiInterviewer.Adapters/   tier 3: SQLite stores (Sqlite/), in-memory stores and stub AI layers. References Business.
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

## Storage

Resumes, roles and sessions are kept in SQLite by default and survive a restart. The `Storage` section of `appsettings.json` picks the adapter; a value it does not know stops the app from starting instead of falling back.

| Setting | Values | Default |
|---|---|---|
| `Storage:Provider` | `Sqlite` persists. `InMemory` is for mock and test mode and forgets everything on restart (decision 0004, mocks in production, point 5) | `Sqlite` |
| `Storage:Sqlite:Path` | A file path, relative to the project folder, or `:memory:` for a private database that lives as long as the process | `data/ai-interviewer.sqlite` |

Under `dotnet run` the file lands at `src/AiInterviewer.Api/data/ai-interviewer.sqlite`, which is gitignored. Delete the folder to start over. The schema is created on open; there is no migration step yet, so a schema change means deleting the file. The HTTP tests use `:memory:`, so they run through the SQLite adapter and never touch that file. Steven decided 2026-10-26: SQLite is the local-development store, and the persistence ports stay completely agnostic of the engine. The `Sqlite/` folder is the only place that knows SQLite; adapters for MSSQL, MySQL, PostgreSQL, MongoDB and CosmosDB are a task (`TASKS.MD`), each to pass the same store contract suite.

## Endpoints

| Route | Contract | Success | Failure |
|---|---|---|---|
| `GET /application-setup` | `ApplicationSetupPage` | 200 | |
| `POST /resumes` | `UploadResume` -> `ResumeProcessed` | 200 | 422 unreadable file |
| `POST /job-descriptions/uploads` | `JobDescriptionUpload` -> `JobDescriptionProcessed` | 200 | 422 |
| `POST /job-descriptions/pastes` | `JobDescriptionPaste` -> `JobDescriptionProcessed` | 200 | 422 empty text |
| `POST /interviews/prepare` | `PrepareInterview` | 202 | 422 form not ready |
| `POST /interviews/error-checks` | `CheckErroredInterview` -> `Error` | 200 | 404, 409 nothing failed |
| `POST /interviews/start` | `StartInterview` -> `CueSettings` | 200 | 404 not prepared, 409 not ready |

### Real-time (SignalR)

SignalR carries the WebSocket channel. Only a smoke-test hub exists so far, mapped in Development only:

| Hub | Method | Behavior |
|---|---|---|
| `/hubs/test` | `Echo(string message)` | Calls the caller's client method `echo` with `message` |
| `/hubs/test` | `Probe(string method, string message)` | Calls the caller's client method named `method` with `message`. A blank `method` throws `HubException` |

Both answer the calling connection only. Session management is not designed yet, so no real hub, `ServerCue` or `ClientCue` delivery exists.

Any malformed body (missing or null field, unknown property, unknown discriminator, numeric enum, blank id) is a 400 with `{ "message": ... }`. Paths follow the OpenAPI draft; **the status codes are that draft's proposals.**

## Proposals and guesses (need Steven's judgment)

- **`{custom-local}` and `{cloud}` wire shape.** The contract leaves them undefined. Here they are `{ "type": "custom-local" }` and `{ "type": "cloud" }`, and a named option is a bare string.
- **`roleFocus` on the wire** is one string: `"unanswered"` or a RoleId, as the contract writes it. A RoleId spelled `unanswered` therefore cannot exist.
- **Cue settings values.** The contract has the shape, not the values. `CueSettings.CleanCallProposal` is all zeros with ratios of 1.0 (a clean call) and a `clipped-ending` ramp, as placeholders.
- **Hardware readiness.** Audio must be verified and rated clear, intermittent or readable. Video may be skipped, but a video check that ran must also pass. The spec says only "required hardware settings".
- **`hot-incomplete=>cold`** is accepted and stored as a cold interview, so the preparer sees what it will build.
- **Preparing the same `sessionId` again replaces the session** (treated as a retry).
- **The error-checks response** reuses `Error` as a diagnosis message, as the OpenAPI draft does.
- **Roles** are only those the user adds. The "industry-standard titles" list from the spec is not built.

## Stubs and gaps

- `PlainTextDocumentReader` reads `.txt` and `.md` only. PDF and Word are refused with a message, not guessed at.
- `InstantInterviewPreparer` marks every session `Ok` immediately, so the `Error` path and `InterviewPrepared` delivery are only reachable in tests. How `InterviewPrepared` reaches the client (push or poll) is undecided.
- `ServerCue`, `ClientCue`, `VerifyHardware`, `HardwareVerified` and the audio stream need the WebSocket channel, which is not built. The audio frame format is an open item in decision 0003.
- Storage is a single SQLite file with no migrations (see Storage above). No Python worker, gRPC contract or LLM runtime is connected.
- `ApplicationSetupPage` `loading` has no server path: the server answers `ready`, or `error` if a store is unreachable.

## Conventions here

- Explicit declarations: ids and names are types that cannot be blank, results are `Outcome` (`Succeeded` or `Failed`), unions are sealed record hierarchies, and `required` wire fields reject null. Nullable reference types are on and warnings are errors.
- JSON attributes and converters live only in `AiInterviewer.Api/Wire`. The SQLite session store writes the setup form with its own hand-built JSON (`Sqlite/SetupFormJson.cs`), so the business types stay free of serialization attributes and the stored shape is not the wire shape.
