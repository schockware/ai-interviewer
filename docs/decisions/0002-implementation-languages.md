*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# 0002: Implementation languages

Decided by Steven. Answers the language question left open in `src/README.MD` and `SPEC.md` §3.3. Status: **C# and Python decided. TypeScript with React is the expected third, not yet confirmed.**

## Decision

The project is built in more than one language, each doing the job it is best placed for:

| Language | Role | Why |
|---|---|---|
| **C#** | Coordination between the other languages | One language owns the conversation flow, so no model runtime decides what happens next |
| **Python** | Hosting the model-backed layers | Most speech and language tooling is written in or first available for Python |
| **TypeScript with React** (expected) | The user interface | Mainstream, with the widest package ecosystem, and the web platform provides the accessibility hooks the SPEC already assumes |

## What this implies

- **Layer boundaries become process and language boundaries.** This is what the technology-agnostic specs in `specs/` were for: a layer is defined by what crosses its edge, so it can be written in any of the three languages.
- **The event stream (`EVT`) and every layer boundary need a language-neutral schema.** A shared schema is the only way three languages stay in agreement. It cannot be defined as a type in one of them.
- **Conformance vectors must be data, not code.** `specs/{layer}/conformance/` holds inputs and expected outputs that each language's test harness reads, so one set of vectors serves every implementation.
- **`SPEC.md` §3.3 no longer fits as written.** It says slots implement small Python interfaces. Those become language-neutral contracts, and Python is where the model-backed slots are hosted.
- **Language-neutral runtimes help.** The LLM slots already use OpenAI-compatible endpoints, so a local runtime such as llama.cpp can serve C# or Python equally.
- **Setup gets harder.** The goal of one-command setup (`SPEC.md` §1) now spans up to three toolchains plus model downloads. This is a real cost of the decision.

## Tentative mapping of layers to languages (proposal, not decided)

| Layer | Likely home |
|---|---|
| Session orchestration, event stream, hardware fit | C# |
| Listening, transcription, speech synthesis, interviewer host, follow-up, evaluator | Python (model hosting), called from C# |
| Conditions simulator | C#, since it works on the timestamped stream the orchestrator owns |
| Cues, captions and accessibility | TypeScript with React |
| Audio input and output | Open (see below) |

## Open items

Items 1 to 5 were settled in [decision 0003](0003-transport-ui-and-service-architecture.md): WebSocket from the browser, gRPC between application layers, an ordinary browser as the first client, browser audio for now, .NET 10 with a layered Web API, and C# supervising the Python workers.

6. **Tests and benchmarks across languages:** a language-neutral runner, or one per language reading the same vector files.
7. **Confirming the third language** once the user interface work starts. It is effectively confirmed for the browser client by decision 0003.
