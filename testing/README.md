*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# testing

Testing answers one question: **is this model implemented and integrated correctly?** It does not ask whether a model is *good* at its job. That is [`benchmarking/`](../benchmarking/README.md).

Status: **framework design, no code yet.** Anything here is a proposal until `SPEC.md` §11 and a decision record adopt it.

## What testing covers

| Layer | Question | Lives in |
|---|---|---|
| **Slot contract tests** | Does every implementation of a slot behave to the interface in SPEC §3.3? | `contracts/` |
| **Load and footprint checks** | Does the model load, and does its measured memory match the fit calculator's prediction (SPEC §8.3)? | `contracts/` |
| **Integration tests** | Do the slots work together: streaming, turn-taking, cancellation, event stream, simulator on and off? | `integration/` |
| **Golden-file tests** | Does the event stream, including `perceived` timestamps, match recorded output for a seeded run? | `integration/` |
| **Accessibility checks** | Keyboard-only use, screen-reader announcements, reduced motion, caption contrast (SPEC §11). | `integration/` |

## Where the checks come from

Each layer is specified in [`specs/`](../specs/README.MD), technology-agnostic. The contract tests run the **conformance vectors** that sit beside each layer's spec (`specs/{layer}/conformance/`) against every implementation, and the seam checks run each layer's stated assumptions about its neighbours. Specs define what must be true. Testing proves it.

## Model experimentation is built in

Contract tests are written once per slot and run against **every registered candidate** for that slot. Adding a model to the candidate list adds it to the test matrix with no new test code. A model that fails its slot's contract tests cannot be entered in a benchmark.

Contract checks per slot (the first set to write):

- **Listening** (`is_turn_complete`): returns on a clip with known pause and end points, handles silence, handles audio shorter than the model window.
- **Transcription** (`transcribe_stream`): yields partial then final text, handles empty audio, handles an utterance over the length cap by chunking.
- **LLM slots**: OpenAI-compatible request and streaming response work against the runtime, thinking mode is off for live turns, stop conditions work.
- **Speech** (`synthesize_stream`): yields audio at the first sentence boundary, supports cancellation mid-sentence.
- **Footprint**: loaded memory and load time are recorded, and a warning is raised if the measured figure exceeds the prediction by more than a configured margin.

A slot implementation must not need to know whether simulation is active (SPEC §3.3), so every contract test runs once with the simulator off and once with it on.

## Rules

- Tests are deterministic. Seed everything, and use fixed audio fixtures in `fixtures/`.
- Tests do not assert quality (word error rate, judge scores). Those belong in benchmarking.
- Tests may use a tiny stand-in model where a real one is too heavy, but the contract tests for each real candidate must run at least once per model release.
- Results are written to `testing/results/` (gitignored). They are generated and never committed or edited by hand.

## Phase 1: testing only

The first passes are testing, not benchmarking. The goal is to prove that each candidate model is wired in correctly and that the pipeline behaves, before anyone asks which model is best. No quality or speed comparison is made yet.

Fixtures come from mock interviews written and recorded by Steven, who plays both the interviewer and the interviewee. A few short ones go in `fixtures/` for the contract and integration tests. The long, full-length interviews are saved for benchmarking (see `benchmarking/README.md`).

## Open items

1. Test runner and language. The project uses several languages (decision 0002), so conformance vectors have to be data files that each language's harness reads. Decide whether there is one runner or one per language.
2. The candidate list lives in [`ai-models/`](../ai-models/README.md), shared with `benchmarking/` and the fit calculator.
3. Fixture format and naming for the mock interviews: audio, a reference transcript, and labeled turn boundaries.
4. How to run contract tests on machines without a GPU, in CI.
