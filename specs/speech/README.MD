*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Speech synthesis (TTS)

Status: **first draft.** Also bound by the common requirements COM-ISL, COM-ISO, COM-ID, COM-DET, COM-RES, COM-LOC, COM-FLT and COM-INP in [`specs/common`](../common/README.MD).

## Purpose

Turn the interviewer's text into audio, starting at the first sentence boundary and stopping on demand.

## Boundary

**Takes in**

- Text in sentence-sized pieces, arriving over time
- A cancel signal
- Settings: voice, speaking rate

**Puts out**

- Audio as a stream of frames, with the format stated (sample rate, channels)
- For each text piece, the audio span that carries it (EVT-TYPE-006)
- On cancel, how much of the text was spoken

**Not this layer's job:** delaying, clipping or dropping audio. That is the simulator's job. This layer produces clean, complete audio.

## Requirements

### Streaming

- **TTS-STR-001** The layer MUST begin producing audio when the first sentence-sized piece of text has arrived, without waiting for the rest.
- **TTS-STR-002** Audio MUST be delivered as frames as it is produced, not only as a finished whole.
- **TTS-STR-003** After the first audio, the rest of an utterance MUST be available early enough to play without a gap.
- **TTS-STR-004** The audio format (sample rate and channels) MUST be stated with the audio, and consumers MUST NOT have to assume it.

### Alignment

- **TTS-ALN-001** For each text piece, the layer MUST report which span of the audio carries it. Sentence level is the minimum, and word level is a SHOULD.

### Cancellation

- **TTS-CAN-001** On cancel, the layer MUST stop producing audio within a stated time and MUST report how much of the text had been spoken.
- **TTS-CAN-002** After cancel, the layer MUST accept new text without being restarted.

### Faithfulness

- **TTS-FAI-001** The layer MUST speak the text it is given, and MUST NOT omit, reorder or add words.
- **TTS-FAI-002** If the layer cannot speak part of the text, it MUST say which part, and MUST NOT skip it silently.
- **TTS-FAI-003** The layer SHOULD speak common technical terms and abbreviations intelligibly (for example product names, languages, acronyms, code symbols), since interviews are technical.
- **TTS-FAI-004** The last audio of an utterance MUST complete the text. The layer MUST NOT clip the end of its own output.

### Voice

- **TTS-VOI-001** The voice MUST stay the same throughout a session unless the user changes it.
- **TTS-VOI-002** The speaking rate MUST be adjustable, since a slower rate is an accessibility need.

### Input

- **TTS-INP-001** Empty text MUST produce no audio and complete normally. Very long text MUST be handled by splitting at sentence boundaries.

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| TTS-TGT-001 | Delay from the first text piece to the first audio frame | to be set |
| TTS-TGT-002 | Real-time factor on the minimum-spec machine, alone and with other layers running | to be set (this is the riskiest figure in the project) |
| TTS-TGT-003 | Time from cancel to silence | to be set |
| TTS-TGT-004 | Intelligibility, as words recovered after transcribing the output | to be set (a benchmark) |

## Conformance vectors (planned)

1. One sentence: audio begins, covers the text, completes (TTS-STR-001, TTS-FAI-004).
2. Text arriving a sentence at a time: no gap in playback against a simulated playback clock (TTS-STR-003).
3. Cancel part-way: audio stops, the spoken amount is reported, new text then works (TTS-CAN-001, TTS-CAN-002).
4. A list of technical terms and acronyms, checked by round-trip transcription (TTS-FAI-003).
5. Alignment of three sentences to audio spans (TTS-ALN-001).
6. Empty text, and a very long paragraph (TTS-INP-001).
7. The same text twice in one session: same voice (TTS-VOI-001).

## Running alone

Feed text pieces on a timeline. Capture the frames and the alignment. Play them into a recording clock to check for gaps, and transcribe the result to check faithfulness.

## Assumptions about neighbouring layers

- The interviewer delivers text in sentence-sized pieces as it is written (INT-STR-001).
- The session supplies the cancel signal and knows when the user started speaking.
- The consumer plays frames on a steady clock.

## Open questions

1. Whether word-level alignment is needed, or sentence level is enough for as-heard captions.
2. Whether the layer should be told the intended emotion or emphasis, or only the plain text.
3. Pronunciation control for names and terms, and who maintains it.

## Source

`SPEC.md` §3.1, §3.2, §9 (TTS), §4.2 (captions).
