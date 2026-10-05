*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Transcription (STT)

Status: **first draft.** Also bound by the common requirements COM-ISL, COM-ISO, COM-ID, COM-DET, COM-RES, COM-LOC, COM-PRV, COM-FLT and COM-INP in [`specs/common`](../common/README.MD).

## Purpose

Turn the user's speech into text, streaming while they speak.

## Boundary

**Takes in**

- The user's audio, as a stream or as a finished segment, with timestamps
- Optional vocabulary hints (job titles, technologies, names)
- Settings: language, and the longest segment handled in one piece

**Puts out**

- Partial text while the user speaks, then final text, each piece with the span of audio it covers (EVT-TYPE-005)
- A confidence for each piece

**Not this layer's job:** deciding when the turn ends (listening) or what the words mean (interviewer).

## Requirements

### Streaming

- **STT-STR-001** The layer MUST produce partial text while the user is still speaking.
- **STT-STR-002** The layer MUST produce final text for each segment, and a final piece MUST identify the partial pieces it replaces.
- **STT-STR-003** Each piece MUST state the start and end of the audio it covers on the audio's own clock. Word timing is a SHOULD.
- **STT-STR-004** Streaming a segment and giving the same audio as a whole segment SHOULD give the same final text.

### Faithfulness

- **STT-FAI-001** The layer MUST NOT produce text for silence or noise with no speech in it.
- **STT-FAI-002** The layer MUST mark any span it could not transcribe as unintelligible, and MUST NOT omit it or fill it with guessed text.
- **STT-FAI-003** The layer MUST NOT repeat or drop words at the seams where it splits long audio.
- **STT-FAI-004** The layer SHOULD report a confidence for each piece, low where it was unsure.

### Length and language

- **STT-LEN-001** The layer MUST state the longest segment it handles in one piece. Longer audio MUST be handled without error and without loss (STT-FAI-003).
- **STT-LNG-001** The layer MUST state the languages it supports. It SHOULD report when the audio appears to be in a language it does not support, instead of returning confident wrong text.
- **STT-VOC-001** The layer MAY accept vocabulary hints. If it does not, it MUST say so, and MUST NOT fail when hints are given.

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| STT-TGT-001 | Delay from the end of the turn to final text | to be set |
| STT-TGT-002 | Delay from speech to a partial piece | to be set |
| STT-TGT-003 | Real-time factor on the minimum-spec machine | to be set (below 1 is required for streaming) |
| STT-TGT-004 | Word error rate on interview-style speech | to be set (a benchmark, not a correctness test) |
| STT-TGT-005 | Longest segment in one piece | to be set |

## Conformance vectors (planned)

1. Silence, and noise only: no text (STT-FAI-001).
2. A clear short utterance: partial then final, final replaces partials (STT-STR-001, STT-STR-002).
3. Audio with an unintelligible span: marked, not guessed (STT-FAI-002).
4. Audio longer than the stated limit: no repeated or missing words at the seams, compared with a reference (STT-FAI-003, STT-LEN-001).
5. The same audio streamed and given whole (STT-STR-004).
6. Audio in an unsupported language (STT-LNG-001).
7. Vocabulary hints given to an implementation that ignores them (STT-VOC-001).
8. Empty audio, and one hour of audio (COM-INP-001).

## Running alone

Feed recorded audio as a timestamped stream. Capture the pieces. Compare to the reference transcript with timing.

## Assumptions about neighbouring layers

- The audio holds one speaker, the user.
- Audio reaches the layer in order, with timestamps, and any gap is marked.
- Quality (word error rate) is judged by benchmarking. Here the layer is only held to the behaviors above.

## Open questions

1. Whether word-level timing is needed for captions or only for debugging.
2. How a confidence is expressed so the evaluator can use it (EVL-FAI-002).
3. Whether the layer should be told the question being asked, to improve accuracy, or whether that leaks context between layers.

## Source

`SPEC.md` §3.1, §3.2, §9 (STT).
