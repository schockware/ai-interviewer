*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# src

Everything about *how* the interviewer is built. [`specs/`](../specs/README.MD) says what must be true. This folder says how we make it true.

Status: **design, plus throwaway prototypes under `prototypes/`.** The layout of the real code is not decided.

## Layout

```
src/
  README.MD
  design/       how each layer is built: technology, structure, trade-offs
  prototypes/   throwaway one-layer experiments, kept apart from production code
  prod/         production code, gated by human-written tests (see Rules)
    ui/         React + Vite + TypeScript scaffold, empty so far
                (other code folders for the real layout arrive when it is decided)
```

## Languages

Decided in [decision 0002](../docs/decisions/0002-implementation-languages.md): **C#** coordinates, **Python** hosts the model-backed layers, and **TypeScript with React** is the expected user interface. The browser talks to C# over WebSocket and the application layers talk to each other over gRPC. C# is .NET 10 using the ASP.NET Core Web API template, in layers that keep the business logic isolated from presentation, AI services and data ([decision 0003](../docs/decisions/0003-transport-ui-and-service-architecture.md)). The folder layout for each language is not decided yet.

## Rules

- Design answers the spec; it never replaces it. Anything that must be true regardless of technology goes in `specs/`.
- Code under `src/` follows the designs in `src/design/` and cites the requirement IDs it answers.
- Models are referenced by their `ai-models/` id, never by a bare name or URL.
- **Holistic, feature-level testing is first class** and lives outside `src/`: [`testing/`](../testing/README.md) for conformance, contract and cross-layer tests, and benchmarks in [`benchmarking/`](../benchmarking/README.md). A part with its own tooling may keep its journey and behavior tests (for example `e2e/` and `bdd/`) in sibling folders next to its `src/`, as the UI prototype does.
- **Lower-level tests live next to the code they test:** unit tests, component tests and single-boundary integration tests. A `.spec.` file checks a domain behavior or a requirement, and a `.test.` file constrains a tightly coupled UX or integration behavior. The convention is written out in [`src/prototypes/ui/README.MD`](prototypes/ui/README.MD).

- **Two zones.** `prototypes/` is Claude-run and unverified; `prod/` is gated by human-written tests. See "Human QA and the two zones" in [`CLAUDE.md`](../CLAUDE.md).

## Open items

1. Layout of the code folders for three languages in one repository (one folder per language, or one per layer).
2. How layers are packaged so each can be run and tested alone, and the open items in decision 0003.
