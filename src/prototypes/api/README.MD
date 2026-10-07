*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# api (prototype)

C# .NET 10 hexagonal Web API. **Prototype zone: nothing here is verified.** It follows [decision 0003](../../../docs/decisions/0003-transport-ui-and-service-architecture.md) and implements the page-flow contract in [`contracts/page-flow.md`](../../../contracts/page-flow.md) (setup, hardware, start). No real AI runs yet: every AI layer is a stub adapter.

## Layout

```
AiInterviewer.slnx
src/
  AiInterviewer.Business/   the hexagon: contract types, ports, use cases. References nothing.
  AiInterviewer.Adapters/   tier 3: in-memory stores and stub AI layers. References Business.
  AiInterviewer.Api/        tier 1: endpoints, wire DTOs, JSON, composition root. References both.
tests/
  AiInterviewer.Business.Tests/   unit tests against hand-written fakes, plus an architecture guard
  AiInterviewer.Api.Tests/        HTTP tests through the real pipeline (WebApplicationFactory)
```

Dependencies point inward only. `ArchitectureTests` fails if Business references anything beyond the base class library.

## Run

```
dotnet run --project src/AiInterviewer.Api      # http://localhost:5036, OpenAPI at /openapi/v1.json in Development
dotnet test AiInterviewer.slnx
```

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
- Storage is in memory and is forgotten on restart. No Python worker, gRPC contract or LLM runtime is connected.
- `ApplicationSetupPage` `loading` has no server path: the server answers `ready`, or `error` if a store is unreachable.

## Conventions here

- Explicit declarations: ids and names are types that cannot be blank, results are `Outcome` (`Succeeded` or `Failed`), unions are sealed record hierarchies, and `required` wire fields reject null. Nullable reference types are on and warnings are errors.
- JSON attributes and converters live only in `AiInterviewer.Api/Wire`.
