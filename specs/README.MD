*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# specs

What must be true of each layer of the interviewer, regardless of technology. Each layer is specified on its own so it can be built, tested and replaced in isolation.

Status: **structure only.** Every layer has a drafted boundary and no requirements yet. `SPEC.md` remains the overall vision and the home of the current technology choices until each layer's spec takes over its part.

## Spec and design are separate

- A **spec** says what must be true. A **design** says how one implementation achieves it. Never mix them.
- Specs say nothing about languages, frameworks, runtimes, model names, endpoints or file formats. "Returns partial then final text" is spec. "Implements `transcribe_stream`" or "uses Parakeet" is design.
- Specs state **outcomes, not mechanisms**: what is observable at the layer's boundary.
- Designs live in [`src/design/`](../src/design/README.MD). Until a layer has its own design, its technology choices are in `SPEC.md` §3.2 to §3.4 and §8, and in `docs/decisions/`.

## Writing requirements

- Use RFC 2119 words: **MUST**, **SHOULD**, **MAY**.
- Give each requirement a stable ID: `{PREFIX}-{TOPIC}-{NNN}`, such as `LST-TURN-003`. Never reuse or renumber an ID. Retire it instead.
- One requirement states one testable thing. If it cannot be tested at the layer's boundary, rewrite it until it can.
- Where a number matters (a latency, a memory limit), say whether it is a requirement or a target. Provisional numbers are marked **[unverified]**, as in the main spec.

## Isolation rules

- A layer is specified only by what it takes in and puts out. It never names another layer's internals.
- Each layer lists **assumptions about its neighbours**. These make the seams visible and become the checks that `testing/` runs where two layers meet.
- Layers talk through the [event stream](events/README.MD) or through the inputs and outputs stated in their boundary, never through shared hidden state.
- Every layer must be testable with its neighbours replaced by recorded input and captured output.

## Conformance

Each layer will carry shared **conformance vectors** in `specs/{layer}/conformance/`: inputs with the expected observable output. Every implementation of the layer, and every model that can hold its role, is run against the same vectors, so results are comparable. `testing/` executes them. They check correctness, not quality, which stays in `benchmarking/`.

## Layers

| Layer | Prefix | What it does |
|---|---|---|
| [Audio input and output](audio-io/README.MD) | `AIO` | Capture the user's voice and play the interviewer's voice and ambient sound, without one contaminating the other. |
| [Listening: speech activity and end of turn](listening/README.MD) | `LST` | Decide when the user is speaking and when they have finished their turn. |
| [Transcription](transcription/README.MD) | `STT` | Turn the user's speech into text, streaming while they speak. |
| [Follow-up decider](follow-up/README.MD) | `FUP` | Decide, after each answer, whether to probe deeper or move on. |
| [Interviewer](interviewer/README.MD) | `INT` | Write the interviewer's next utterance, one question at a time. |
| [Evaluator](evaluator/README.MD) | `EVL` | Score answers and produce feedback and the session report. |
| [Speech synthesis](speech/README.MD) | `TTS` | Turn the interviewer's text into audio, starting at the first sentence. |
| [Conditions simulator](simulator/README.MD) | `SIM` | Optionally degrade the interviewer's side of the call like a real remote connection. |
| [Cues, captions and accessibility](cues/README.MD) | `CUE` | Show and sound the conversation state and captions, redundantly across senses. |
| [Event stream](events/README.MD) | `EVT` | The one stream of timestamped events every layer reads or writes. |
| [Session orchestration](session/README.MD) | `ORC` | Run the conversation and coordinate the layers. |
| [Hardware fit and model selection](fit/README.MD) | `FIT` | Measure the machine and choose the models that fit it. |

The layers follow the pipeline in `SPEC.md` §3.1. Two things in the SPEC are not layers: the **model registry** (`ai-models/`, facts about models) and **testing and benchmarking** (`testing/`, `benchmarking/`).

## Not yet specified

Interview **content and structure** (the 10-15 minute screen and the 45-60 minute interview in `ROADMAP.MD`, and the later practice modes) is a layer in waiting. It will probably sit above the interviewer and the session layers once the real-time pipeline is specified.

## Suggested order

1. **Event stream**, because every other layer depends on it.
2. **Listening**, since turn-taking is the core problem the project exists to fix.
3. **Transcription** and **speech synthesis**, the two audio-to-text edges.
4. **Interviewer**, **follow-up** and **evaluator**.
5. **Simulator** and **cues**, which build on the event stream.
6. **Session** and **fit**, which tie it together.
7. **Audio input and output** can come in whenever the echo problem needs a decision.

## Open items

1. Whether the spec for a layer lives in its `README.MD` or in a separate file once it grows.
2. Whether later additions are enhancements to one spec set or separate sets. Nothing should be written here that forces the choice.
3. Whether `src/design/{layer}/` should mirror the spec folders exactly (the current plan).
