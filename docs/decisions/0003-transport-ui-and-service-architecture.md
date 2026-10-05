*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# 0003: Transport, user interface host and C# architecture

Decided by Steven. Settles the open items in [decision 0002](0002-implementation-languages.md) (items 1 to 5). Status: **decided.**

## Decisions

| Question | Decision |
|---|---|
| Transport between the browser and the C# service | **WebSocket** |
| Transport between application layers (C# to the Python AI workers, and any further service) | **gRPC** |
| Where the user interface runs | **An ordinary browser**, to give the feel of a web chat |
| Desktop version | **Later**, for a Zoom or Teams feel. Added to `ROADMAP.MD` |
| Who captures and plays audio | **The browser**, for now |
| C# runtime and host | **.NET 10, using the ASP.NET Core Web API template** |
| C# structure | **Three tiers, with the business logic as an isolated module** that depends on none of its collaborators. AI layers belong to the third tier with data |
| Supervising the Python workers and model runtimes | **C#**. Whether an AI agent would help with coordination is to be evaluated later |

## Reasoning

- **WebSocket to the browser:** native to every browser, carries events and audio frames in both directions, and needs no extra client library. Horizontal scaling is not a goal, so there is no reason to take on gRPC's browser constraints.
- **gRPC between application layers:** typed contracts and streaming in both directions suit audio frames and partial transcripts moving between C# and Python, and the contract files give three languages one source of truth for schemas.
- **Browser audio on purpose.** Using the browser's microphone and speaker path means developers meet the same setup problems a real remote interview has: permissions, device choice, headphones versus speakers, and echo. The desktop client must later *emulate classic chat setups* in the same way, so the practice stays realistic.
- **Layered C#:** it keeps the conversation logic testable without a browser, a model or a database.

## Architecture

Three tiers. The AI layers are not a fourth tier: they are resources the business logic uses, like data, and sit in the third tier beside storage.

```
Browser (React)
   |  WebSocket: events, audio frames, controls
Tier 1  Presentation   ASP.NET Core Web API: endpoints, WebSocket handling, validation
Tier 2  Business       session orchestration, event stream, conditions simulator, fit logic
                       an isolated module: it defines the interfaces it needs (ports)
Tier 3  Resources      adapters that implement those interfaces
                         AI: gRPC to the Python workers, OpenAI-compatible calls to LLM runtimes
                         Data: sessions, transcripts, reports, settings, hardware profile
```

**The business logic is a module, not a service.** It has no dependency on any other part of the system. It declares what it needs in its own terms (for example "give me the next transcript segment", "store this report") as interfaces, and the other tiers plug in implementations. Nothing in it names a framework, a transport, a model runtime or a storage engine, and it can run in a test with every collaborator replaced by a recorded stand-in. This pattern is usually called **ports and adapters** (also hexagonal architecture, and close to clean or onion architecture). The same idea at function level is "functional core, imperative shell".

Rules for the C# structure:

- The business module references no other project in the solution. Presentation and the resource adapters reference it, never the reverse.
- No framework type, transport type, model runtime type or storage type appears in business code.
- Not everything is a service. A part that is only logic stays a plain module with an interface. A network boundary is added only where a language or process boundary forces one (the Python workers).
- Because the business module owns the interfaces, each AI layer in `specs/` can be replaced with a recorded stand-in for testing.

## Consequences

- **The audio path is browser to C# over WebSocket to Python over gRPC.** Every hop adds latency, and audio is the part where latency matters most. Frame size, encoding and buffering need design and measurement.
- **The echo handling lives in the browser first.** `specs/audio-io` has to say what the browser path must guarantee. The desktop client needs its own answer.
- **Three tiers of language and process:** TypeScript in the browser, C# as the coordinator, Python as the model host. Setup must start and supervise all of them.

## Open items

1. Audio frame format and size over the WebSocket, and how backpressure is handled.
2. What the data layer stores and where. Nothing about storage technology is decided.
3. Whether an AI agent would help coordination, to be evaluated once the plain coordinator exists.
4. How C# supervises Python workers: start-up, health checks, restart and shutdown.
5. The gRPC contract files, and where they live so all three languages generate from the same source.
6. Browser echo cancellation settings, and what the app does when the browser cannot provide a clean microphone path.
