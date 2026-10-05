*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Prototype brief: speech synthesis (TTS)

Read [`../PROTOTYPES.MD`](../PROTOTYPES.MD) first. Build this alongside transcription. It carries **the riskiest figure in the project**: whether the only license-clean, good-quality voice can keep ahead of real time on 4 cores while a language model is also running.

## Goal

Measure whether Kokoro can speak the interviewer's replies without gaps on the minimum-spec machine, alone and beside a running LLM, and learn what to fall back on if it cannot.

## Spec to answer

[`specs/speech/README.MD`](../../../specs/speech/README.MD) and [`specs/common/README.MD`](../../../specs/common/README.MD).

| Priority | Requirements |
|---|---|
| High | TTS-STR-001 to -004; TTS-FAI-001, -004; COM-RES-001 |
| High | TTS-CAN-001, -002; TTS-ALN-001 |
| Medium | TTS-FAI-002, -003; TTS-VOI-001, -002; TTS-INP-001 |

## Scope

**In**

- A harness that feeds **text pieces on a timeline** (sentence by sentence, as an LLM would write them) and captures audio frames, the alignment of text to audio spans, and the time each frame was produced.
- A **simulated playback clock**: a consumer that plays frames at real-time rate and counts underruns (gaps), so TTS-STR-003 can be checked without a speaker.
- Implementations behind the same boundary:
  1. **Default (Tier 1 and dev machine):** Kokoro 82M (Apache-2.0), ONNX on CPU, as the main subject.
  2. **Tier 0 candidate:** Inflect-Nano-v1 (Apache-2.0), only to learn whether it is a usable fallback.
  3. **Dev machine variant:** Kokoro on GPU, for comparison with CPU.
- A **load test** for the minimum-spec question: run the speech layer on 4 pinned cores while a local LLM runtime serves Qwen3.5 4B (Q4_K_M) generating at the same time (`SPEC.md` §3.2.1). Report the real-time factor and underruns **alone and under load**.
- A **scorer**: round-trip intelligibility. Transcribe the output with a fixed recognizer and compare words. Use whisper.cpp base and say so.

**Out**

- Delay, clipping and dropping (the simulator). Voice cloning. Emotion control.
- Any other layer, the browser, a speaker.

## Questions this prototype must answer

1. **The central question (TTS-TGT-002).** On 4 pinned cores, what is Kokoro's real-time factor alone, and with the LLM generating? Are there underruns with sentence-sized pieces? If so, at what point does it stop keeping up?
2. How long until the first audio frame after the first sentence arrives (TTS-TGT-001)? Does a short first sentence help?
3. How much of the memory is the model and how much the runtime (reports range from 0.4 to 2.0 GB, COM-RES-001)? Does it fit the 2 GB speech reserve with the recognizer and listening layers?
4. What is the time from a cancel to silence, and can the layer then accept new text without a restart (TTS-CAN-001, -002)?
5. Can text pieces be aligned to audio spans? At sentence level, easily? At word level, at all (TTS-ALN-001)? What does the as-heard caption need?
6. Is the end of every utterance complete, or does the engine clip or add silence (TTS-FAI-004)?
7. Are technical terms intelligible (TTS-FAI-003)? Use the technical-terms list as text and score the round trip.
8. Does the voice stay the same across a long session, and can the speaking rate be changed without damage (TTS-VOI-001, -002)?
9. If Kokoro fails the central question on 4 cores, what is the best fallback among the license-clean options: a smaller Kokoro setting, Inflect-Nano, or text-only output? Report quality as well as speed.

## Measurements to produce

| Target | Measure |
|---|---|
| TTS-TGT-001 | Delay from first text piece to first audio frame, p50 / p95 |
| TTS-TGT-002 | Real-time factor and underruns, alone and under LLM load, on 4 pinned cores; and on the dev machine unpinned |
| TTS-TGT-003 | Time from cancel to silence |
| TTS-TGT-004 | Round-trip word recovery on the technical-terms text and on ordinary sentences |
| COM-RES-001 | Load time, resident memory, peak memory |

## Conformance vectors to run

The seven in the spec, as data (text pieces on a timeline plus expected observations).

## Candidate technology

- Python (decision 0002), ONNX Runtime for Kokoro. The LLM runtime for the load test is whatever the implementer can start quickly with the manifest model, and must be named.
- Pin cores and limit memory as described in the shared rules.
- Check Kokoro's license text and the voices' licenses and write down what you find.

## Deliverables

- Code in `src/prototypes/speech/`.
- The simulated playback consumer and the scorer.
- `docs/research/prototype-speech.md` as in the shared rules, with a clear recommendation on the Tier 0 and Tier 1 speech choice.

## Done when

The shared definition of done holds, the load test has been run, and the report states whether Tier 1 can offer spoken replies, or must fall back to text and captions.
