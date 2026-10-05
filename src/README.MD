*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# src

Everything about *how* the interviewer is built. [`specs/`](../specs/README.MD) says what must be true. This folder says how we make it true.

Status: **design only, no code yet.**

## Layout

```
src/
  README.MD
  design/     how each layer is built: technology, structure, trade-offs
              (code folders arrive here when implementation starts)
```

## Languages

Decided in [decision 0002](../docs/decisions/0002-implementation-languages.md): **C#** coordinates, **Python** hosts the model-backed layers, and **TypeScript with React** is the expected user interface. The browser talks to C# over WebSocket and the application layers talk to each other over gRPC. C# is .NET 10 using the ASP.NET Core Web API template, in layers that keep the business logic isolated from presentation, AI services and data ([decision 0003](../docs/decisions/0003-transport-ui-and-service-architecture.md)). The folder layout for each language is not decided yet.

## Rules

- Design answers the spec; it never replaces it. Anything that must be true regardless of technology goes in `specs/`.
- Code under `src/` follows the designs in `src/design/` and cites the requirement IDs it answers.
- Models are referenced by their `ai-models/` id, never by a bare name or URL.
- Tests for this code live in [`testing/`](../testing/README.md) and benchmarks in [`benchmarking/`](../benchmarking/README.md), not under `src/`.

## Open items

1. Layout of the code folders for three languages in one repository (one folder per language, or one per layer).
2. How layers are packaged so each can be run and tested alone, and the open items in decision 0003.
