*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Prototype brief: transcription (STT)

Read [`../PROTOTYPES.MD`](../PROTOTYPES.MD) first. Build this alongside speech synthesis: they are the two audio edges.

## Goal

Measure how fast and how faithfully the two chosen speech recognizers turn the user's speech into partial and final text, and what they cost. The minimum-spec choice has no published speed on 4 x86 cores, and its non-streaming design means the chunking approach is part of what is being tested.

## Spec to answer

[`specs/transcription/README.MD`](../../../specs/transcription/README.MD) and [`specs/common/README.MD`](../../../specs/common/README.MD).

| Priority | Requirements |
|---|---|
| High | STT-STR-001 to -004 |
| High | STT-FAI-001 to -003 |
| High | STT-LEN-001; COM-RES-001; COM-INP-001 |
| Medium | STT-FAI-004; STT-LNG-001; STT-VOC-001 |

## Scope

**In**

- A harness that feeds recorded audio as a timestamped stream in real time and as a finished segment, and captures partial and final pieces with timing and confidence.
- Two implementations behind the same boundary (`SPEC.md` §3.2.1, §3.2.2):
  1. **Minimum spec:** whisper.cpp, base model and tiny model (MIT).
  2. **Dev machine:** Parakeet TDT 0.6B v3, int8 ONNX, on CPU (CC-BY-4.0).
- A **partial-result strategy** for models that are not natively streaming. Try at least one: repeated transcription of a growing window, or fixed chunks with overlap. Describe how seams are merged and how a final replaces partials (STT-STR-002, STT-FAI-003).
- A **scorer**: word error rate against the reference transcripts, with a stated normalization of case and punctuation.

**Out**

- Streaming-native models (Nemotron). Moonshine (license question). Quality tuning.
- Any other layer, the browser, audio capture.

## Questions this prototype must answer

1. **Speed on 4 pinned cores (STT-TGT-001 to -003).** What is the real-time factor for whisper.cpp base and tiny? What is the delay from the end of a turn to final text? Is the minimum-spec choice fast enough for a 20-second answer?
2. What does the growing-window strategy cost compared with chunking, and how do partials behave: how often do they change, and how far?
3. **Length limit (STT-TGT-005).** For Parakeet, how does peak memory grow with segment length (the reports range from 1.5 GB to 5.5 GiB)? What cap keeps it safe, and does chunking at that cap damage the text at the seams?
4. What do both models do with silence and with noise (STT-FAI-001)? Whisper-family models can invent text on silence. Is this a problem here, and what stops it?
5. Can unintelligible spans be marked (STT-FAI-002)? What does each model give that can serve as a confidence (STT-FAI-004)?
6. How do the two do on the technical-terms clip (a rough word error rate, not a benchmark)? Do vocabulary hints exist, and do they help (STT-VOC-001)?
7. What happens with audio in an unsupported language (STT-LNG-001)?
8. Does streaming and whole-segment input of the same audio give the same final text (STT-STR-004)?

## Measurements to produce

| Target | Measure |
|---|---|
| STT-TGT-001 | Delay from end of turn to final text, per implementation and per audio length, p50 / p95 |
| STT-TGT-002 | Delay from speech to a partial piece |
| STT-TGT-003 | Real-time factor on 4 pinned cores and on the dev machine |
| STT-TGT-004 | Word error rate on the fixtures, marked synthetic or real |
| STT-TGT-005 | Longest safe segment, with peak memory by length |
| COM-RES-001 | Load time and resident memory |

## Conformance vectors to run

The eight in the spec, as data. Use synthetic clips where real recordings are missing, and mark them.

## Candidate technology

- Python (decision 0002). whisper.cpp through a binding or its server; ONNX Runtime for Parakeet. Record versions and file hashes.
- Models by manifest id; write draft manifests with sizes and sources where missing.
- Pin cores and limit memory as described in the shared rules.

## Deliverables

- Code in `src/prototypes/transcription/`.
- The scorer, with its normalization rules written down.
- `docs/research/prototype-transcription.md` as in the shared rules.

## Done when

The shared definition of done holds, both implementations run behind the same boundary, and the report says plainly whether whisper.cpp base is acceptable as the minimum-spec default or whether the tier needs a different choice.
