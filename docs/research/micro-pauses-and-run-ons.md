*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Micro-pauses and run-ons: what to train and tune

Research date and source access date: 2026-10-05. Input to the turn detector and Listening slot (SPEC §3.2, §9), the Interviewer and Speech slots (SPEC §3.2, §8.4), and the `benchmarking/` plan (SPEC §11). Companion to [latency-perception.md](latency-perception.md), which covers *latency*. This note covers *pause behavior*, which is a modeling and tuning problem.

Conventions: **[unverified]** marks a figure from a search excerpt, a vendor page, or my own inference. **[verified]** means I read the primary page. Several primary PDFs (Weingartová 2014, the IWSDS 2025 survey, arXiv 2609.11066) came back unreadable, so those findings are **[unverified]**.

**How I read the request.** "Micro-pause" and "run-on" each have a listener side and a speaker side, and both matter here, so this note covers four problems:

| | Candidate speaks (interviewer, output) | Candidate speaks (user, input) |
|---|---|---|
| **Micro-pause** | **P1:** too few or badly placed pauses in the interviewer's TTS, so speech sounds rushed, or odd gaps appear between streamed chunks | **P3:** short mid-answer pauses (thinking, searching for a word) misread as "turn over," so the interviewer cuts the candidate off |
| **Run-on** | **P2:** the interviewer LLM writes long, stacked, comma-spliced replies, so the TTS has no natural breath points and the user loses the thread | **P4:** the candidate talks for a long time with no clear ending, or trails off, so the detector waits too long or never decides |

If you meant only a subset (for example only P3 and P2), the rest can be dropped. Say so and I will trim.

## Summary

- **P3 is the highest-stakes problem for an interview trainer, and the human baselines do not transfer.** Conversation research is built on short turns (mean about 2 s, median about 1 s). Interview answers run far longer, with long thinking pauses *inside* the answer. A detector tuned on casual chat will cut candidates off.
- **Silence alone cannot tell a hesitation from a finished turn.** This is the consistent finding from the turn-taking literature, from LiveKit, and from Pipecat. Both open-source detectors exist because of it. Both also have the opposite failure: they can still fire early on a mid-thought pause.
- **The SPEC's detector is trained on short-turn data we do not control.** Smart Turn v3.x was trained on about 270k samples (v3.1 train set), with contributions from several companies, and its own docs say it is not designed for very short audio. A third-party page says its corpus is largely TTS-generated **[unverified]**. We should fine-tune or at least test it on interview-style speech with long pauses.
- **Candidates who pause more are hurt most.** One vendor-reported figure: 686 ms average pause for Mandarin-English bilinguals against 546 ms for native English speakers **[unverified]**. A fixed threshold penalizes exactly the people practicing for interviews in a second language, or with a disfluency. This is an accessibility issue (SPEC §4.2), not a polish item.
- **For the interviewer's output, the main controls are punctuation and sentence length.** TTS engines treat punctuation as the main pause instruction, and a missing period runs thoughts together. The LLM controls this, so the pause "training" for P1 and P2 is mostly *teaching the Interviewer LLM to write for the ear*, plus a sentence streamer that does not add odd gaps.
- **Kokoro, our default TTS, has reported gap artifacts on long text** (a self-interruption "for a split of a second" in kokoro-onnx issue #11, cause unconfirmed). Chunk-boundary behavior needs measuring in our pipeline before we tune around it.
- **There is no published "ideal" pause table I would trust.** Numbers below are anchors and proposals to tune by ear, like the SPEC's presets.

## 1. What a pause is: the human baseline

| Finding | Value | Source | Status |
|---|---|---|---|
| Probability the floor changes hands is lowest for mid-length pauses and highest for short and long ones; the floor-change probability falls within the first 500 ms of a pause and rises again near 1,500 ms | see left | Weingartová et al. 2014 (Czech) | **[unverified]** (excerpt) |
| Pause categories within a turn | silent pause, hesitation pause (with "um"/"uh"), breath pause | same | **[unverified]** |
| Pause minimum used to count a pause | 120 ms in one study; silences under 180 ms bridged in another (they are consonant closures, not pauses) | Weingartová 2014; Heldner and Edlund 2010 | **[unverified]** |
| Breath pauses are longer than gap transitions | yes | Weingartová 2014 | **[unverified]** |
| "Uh" signals a short delay, "um" a longer one; both work as floor-holding signals | yes | Clark and Fox Tree 2002 | **[unverified]** (excerpt) |
| Most turn transitions fall between -100 and +500 ms | yes | same excerpt set | **[unverified]** |
| Chunk (words without a 200 ms pause between them) | working definition in speech-production work | MPI production-comprehension paper (excerpt) | **[unverified]** |

What this means for the build:

- **A "micro-pause" is a within-turn silence, roughly 120 ms to about 1 s.** Between-turn gaps are 0-500 ms (latency-perception.md §1.1). The two ranges overlap around 200-500 ms, which is why silence length alone is not enough to decide. A 400 ms silence can be either one.
- **Fillers are signals, not noise.** "Um" tells the interviewer the candidate is still going. Our VAD and STT must not drop them, and our turn detector must treat them as a hold cue. Vendor sources say fillers also *confuse* simple VADs (they look like speech starting or ending), which cuts both ways **[unverified]**.
- **Interview speech is not conversation speech.** After a question, a candidate may think for several seconds before the first word. Mid-answer they may stop for 1-3 s to find the next point. Nothing in the conversation corpora measures this. That gap in the evidence is itself a finding (§7).

## 2. P3: micro-pauses misread as the end of the turn

### 2.1 How the open-source detectors work

| Detector | How it decides | Key numbers | Source / status |
|---|---|---|---|
| **Silero VAD + Smart Turn v3.x** (Pipecat) | VAD flags a pause; Smart Turn classifies the last up-to-8 s of raw audio as complete or incomplete, using prosody, pace and intonation | VAD `stop_secs` recommended 0.2 s; `SmartTurnParams.stop_secs` default 3.0 s as the silence fallback; model is 8M params (Whisper Tiny encoder plus a linear head); about 10 ms on some CPUs, under 100 ms on most cloud instances; 16 kHz mono PCM; "not designed to run on very short audio segments" | Pipecat docs and Hugging Face / GitHub model cards, **[verified]** (pages read) |
| **LiveKit turn detector** | Language model (Qwen2.5-0.5B-Instruct base) on the *transcript* of the last up to 6 turns (128 tokens) predicts end of utterance | endpointing `min_delay` 0.5 s, `max_delay` 3.0 s; `false_interruption_timeout` 2.0 s; `resume_false_interruption` on by default; v0.4.1 cut false-positive interruptions 39.23% (relative) against v0.3.0 | LiveKit docs **[verified]**; model-card figures **[unverified]** (search excerpt) |

Notes on these:

- **Both tools document the same two failure modes:** firing too early (interrupting) and waiting too long (feeling slow). LiveKit adds that model-based detection can still "overreact to mid-sentence pauses." The detector is a mitigation, not a fix.
- **They are complementary.** Smart Turn reads sound (so it sees trailing intonation and hesitation sounds the transcript loses). LiveKit reads words (so it sees an unfinished clause, or a half-read phone number). Keeping the detector swappable (SPEC §9) is right, and fusing both is a documented research direction (an "Easy Turn" paper combines acoustic and linguistic cues **[unverified]**, from a title and an excerpt).
- **The interruption side has a recovery mechanism.** LiveKit "opens a silence window" after a suspected interruption and, if it was false (a "uh-huh"), resumes the agent's speech. That matters for backchannels (the *candidate* saying "mm-hm" while the interviewer talks) and is a pattern worth copying.
- **Our SPEC example config (§3.4) uses `vad_stop_secs: 0.2` and `max_silence_secs: 2.0`.** The 0.2 matches Pipecat's recommendation. The 2.0 s fallback is *shorter* than Pipecat's 3.0 s default. For interview answers that is probably too short (see §2.3).

### 2.2 Training and data

- **Smart Turn's training set:** `smart-turn-data-v3.1-train` (about 270k samples) and a test set (about 31.5k), with named contributor companies and a public data-collection game. Whether the audio is synthetic or real is not stated on the model card I read. A third-party page says the corpus is "largely TTS generated" **[unverified]**. The model card does not say how fillers and pauses were handled.
- **Language variants exist and are being trained on real telephone data** (Tamil, Hinglish and Bangla projects all appear in the results). That shows fine-tuning Smart Turn on a new domain is a practiced path, not a research project.
- **License:** Smart Turn is BSD-2-Clause (SPEC §10), so fine-tuning and shipping a derivative is allowed. Training data licensing would need its own check.

### 2.3 Candidates who pause more

- A vendor blog reports 686 ms average pause for Mandarin-English bilinguals against 546 ms for native English speakers, with wide spread in both **[unverified]**.
- The same sources say standard systems assume a 300-500 ms pause ends an utterance, which "breaks down" for learners searching for vocabulary **[unverified]**.
- A proposed remedy is an **adaptive grace period**: lengthen the wait when the semantic detector says "incomplete," and scale it to the speaker's own pace **[unverified]**.

This links to SPEC §4.2: captions and controls exist as accommodations, and a "give me a sec" control exists (SPEC §4.1). The detector should honor the same principle. A candidate who pauses a lot must not be penalized by the machinery, only by the interviewer's *behavior* if that is the training goal.

### 2.4 Proposed pause policy for an interview (to test, not decided)

Three different silences need three different rules. A single `max_silence_secs` cannot serve all of them.

| Situation | What it is | Proposed handling |
|---|---|---|
| **Response window** (after the interviewer finishes, before the first word) | The candidate is thinking. Silence is expected and can be long. | Long wait. Never time out into a new question quickly. After a long silence (about 5-10 s), offer a gentle prompt, as an interviewer would. A "your turn" cue is already present (SPEC §4). |
| **Mid-answer pause** (after at least one sentence, short silence) | Hesitation or planning. | Defer to the semantic detector. Hold at least about 1-2 s of silence even if it says "complete." The detector's job is to *shorten* waits after a clearly finished answer, not to cut early. |
| **End-of-answer silence** | The candidate has finished. | Reply after the detector says "complete" plus a short padding. This is where latency tuning (latency-perception.md §8.1) applies. |

These cut-offs are my proposals, anchored only by the LiveKit defaults (0.5 s min, 3.0 s max) and the Pipecat defaults (0.2 s VAD stop, 3.0 s fallback). They need measuring on real interview audio.

## 3. P4: run-on user speech and unclear endings

- **Smart Turn looks at the last 8 s only** and runs once per pause. A very long answer is fine for it (it never sees the whole thing), but a candidate who rambles with no pauses never triggers a decision at all. That is a VAD-level cap question: SPEC §8.3 already says to cap STT utterance length (30 s windows for Parakeet).
- **Trailing off** (falling intonation then silence with no clear closing) is the hard case for both detectors, and the fallback timeout is what resolves it. The incomplete-then-timeout path is documented in Pipecat (an "incomplete" turn is marked complete anyway after `stop_secs`) **[verified]**.
- **Interview-specific:** a rambling answer is *behavior being trained* (conciseness, STAR structure). The interviewer should not interrupt it by default (double-talk policy in SPEC §5.4), but could be configured to cut in after a long monologue as a "hard mode." The measuring metric is the answer length distribution, not just detector accuracy.

## 4. P1: micro-pauses in the interviewer's speech

### 4.1 What controls pauses in TTS

| Control | How it works | Source / status |
|---|---|---|
| **Punctuation** | Commas, periods, ellipses and em dashes are the main prosodic instruction; a missing period runs thoughts together | TTS practitioner guides (Bland, Inworld, LMNT) **[unverified]**, consistent with each other |
| **Explicit break tags** | SSML-style `<break>` in ms (for example 250 or 600 ms), where the engine supports it | practitioner guides **[unverified]** |
| **Pause insertion models** | Predict phrase breaks and pause lengths from text; duration-aware insertion exists for multi-speaker TTS (arXiv 2302.13652) | **[unverified]** (title and abstract excerpt) |
| **Local duration control** | Research systems add per-token pause and duration control (MAGIC-TTS, arXiv 2604.21164) | **[unverified]** (excerpt) |
| **Kokoro pause tags** | A `[pause:1.5s]` syntax appears in Kokoro wrapper projects | **[unverified]**; likely a wrapper feature, not the base model |

I did **not** find a verified statement of which of these Kokoro-82M ONNX supports natively. That has to be tested directly (§7).

### 4.2 Sentence streaming and chunk gaps

- Our design streams the LLM's tokens and starts TTS at the first sentence boundary (SPEC §3.1, §8.4). That means the TTS engine sees *one sentence at a time*, so it cannot plan prosody across sentences, and the gap between sentences is whatever our streamer and the engine add.
- **kokoro-onnx issue #11 reports a "split second" self-interruption on long text,** suspected to come from batched processing, with no confirmed cause or fix **[verified that the issue says this; the cause is unconfirmed]**.
- **Kokoro JS streaming** has a documented hang: the text splitter waits forever for more input unless explicitly closed **[unverified]** (PR excerpt). That is a library bug, but it shows the streaming path is less exercised than the batch one.
- Practitioner guidance for chunking: split at sentence or paragraph boundaries, not arbitrary characters, because separate chunks may have different loudness or an unnatural pause even when each sounds fine alone **[unverified]**.

So P1 has two measurable parts: **the gap between consecutive sentence chunks** (ours, measurable), and **pause behavior inside a sentence** (the engine's).

### 4.3 Perception

- Practitioner sources say listeners "reliably detect and negatively evaluate even small differences in pause timing between sentences" **[unverified]**, with no number given.
- Speech-rate work: 120-150 wpm for clear delivery, comprehension falling above about 160 wpm, and strategic pauses of 1-2 s before key information raising recall by up to 30% **[unverified]**, from non-peer-reviewed pages. I would not cite the 30% figure.
- Text sets a ceiling on how much pause a TTS can add: pause lengths we want (say 300-600 ms at a sentence end) must come from punctuation and our streamer, since the model will not invent them.

## 5. P2: run-on text from the Interviewer LLM

- **Reply length:** the SPEC already says one or two sentences (§8.4). A benchmark source reports 10-50% higher performance in conversations with shorter responses, and that every extra word adds about 50-150 ms of TTS time **[unverified]**.
- **What "run-on" looks like in LLM output:** stacked questions ("Tell me about X, and also how did you handle Y, and what would you do differently?"), comma-spliced clauses, lists and markdown, long preambles. All of these sound worse spoken than read. TTS reads markdown characters literally **[unverified]**.
- **Common prompt rules** from voice-agent guides: 1-3 sentences, no lists or markdown, contractions, one question at a time **[unverified]**. Some guides also suggest asking for fillers and ellipses where a human would pause **[unverified]**. For an *interviewer* I would **not** do that by default: a trainer persona that says "um" is a stylistic choice, and ellipses in TTS can produce long, odd pauses.
- **The LLM controls pauses indirectly** through punctuation. "One idea per sentence, end each with a period" is the lever. This is the part the user called "model training": either a prompt (cheap, try first), few-shot examples, or a small fine-tune on spoken-style interviewer turns.

### 5.1 Prompt vs fine-tune

| Approach | Cost | Control over pauses | Notes |
|---|---|---|---|
| System prompt rules (short sentences, one question, no lists) | none | coarse | Try first. Small models (Qwen3.5 2B-4B at Tier 0-1) follow style rules less reliably than a 9B |
| Few-shot examples of ideal spoken turns | tokens per turn (cuts into KV budget, SPEC §8.3) | medium | Static examples can sit in the cached prefix (SPEC §8.4 KV caching) |
| Output post-processor (split long sentences, strip markdown, enforce one `?`) | low, deterministic | high, but mechanical | Cheap safety net that runs in the sentence streamer. Works for any model |
| LoRA fine-tune on interviewer turns written for the ear | training data plus time | high | Worth it only if the first three fail on the Tier 0-1 models |

My recommendation is to build the post-processor and prompt rules first, measure, and fine-tune only if the small models still run on. That is a plan, not a finding.

## 6. Interactions between the problems

- **P2 causes P1.** A long reply gives the TTS a long sentence, which it may rush or split badly, and gives the candidate more to lose at the end ("Which part was the question?"). Short sentences fix both.
- **P3 and the cue modes.** If the detector cuts the candidate off, the "Listening" cue (SPEC §4) flips to "Thinking" mid-thought. In `perceived` mode that flip arrives late too (SPEC §6.3), so a candidate might see the interviewer "start thinking" a second after they resumed talking. Double-talk policy (SPEC §5.4) governs what happens next, and LiveKit's resume-after-false-interruption is a precedent.
- **P3 and the Conditions Simulator.** Uplink delay (SPEC §5.1) shifts when the detector sees a pause, so a "laggy" preset will worsen false cutoffs. The benchmark should cross the two.
- **P3 and fairness.** The detector settings and the simulator's presets must never conflate "the candidate paused" with "the connection lagged."

## 7. What to measure and train: proposals for `benchmarking/`

These are proposals. They are meant to make "dial in the pauses" testable.

| Metric | What it catches | How |
|---|---|---|
| **False cutoff rate** (interviewer starts while the candidate is still talking) | P3 | Audio with injected mid-answer pauses of 0.2-3 s, labeled with true turn ends |
| **Late-response rate and end-of-turn latency (p50, p95)** | the opposite failure | same audio, time from true end to reply start |
| **Pause survival curve** (fraction of mid-answer pauses survived, by pause length) | the shape of P3 | sweep pause length, plot |
| **Same, by speaker type** (native, L2, slow, fast) | fairness | needs real or well-synthesized speech from several groups |
| **Inter-sentence gap at chunk boundaries** (ms, p50, p95) | P1 | log the TTS output timeline between consecutive chunks |
| **Reply length** (words, sentences) and **questions per turn** | P2 | log from the Interviewer slot |
| **Markdown or list leakage rate** | P2 | simple regex over outputs |
| **Run-on rate** (sentences over N words, comma-splice heuristic) | P2 | simple text heuristic |

Data sources to build the audio set:

- **Synthetic first:** generate answers with a TTS that has pause control, insert silences of known length at known positions. Cheap and labeled, but a TTS-only set carries the same weakness the Smart Turn corpus is said to have **[unverified]**.
- **Recorded second:** a small set of real interview-style answers with long thinking pauses, recorded by volunteers (with consent and a license, SPEC §10). The public Smart Turn data-collection game is a model for this.

## 8. Findings for the spec

For the spec owner. I have not edited `specs/` or the body of `SPEC.MD`.

1. **SPEC §3.4 `max_silence_secs: 2.0`** is shorter than Pipecat's 3.0 s fallback default and probably too short for interview answers. Split it into separate response-window and mid-answer settings (§2.4).
2. **SPEC §9 Turn detection:** add that the detector sees fillers as hold cues, and that interview speech has long within-turn pauses the conversation corpora do not cover.
3. **SPEC §4.2 and §11:** the turn detector's behavior on slower or disfluent speakers is an accessibility concern. Add a benchmark that reports false cutoffs by speaker group.
4. **SPEC §8.4:** "keep replies to one or two sentences" should also say "one question per turn, no lists or markdown, sentences ending in a period," because the TTS reads punctuation as its pause instruction.
5. **SPEC §3.1 / §8.4:** the sentence streamer is where inter-sentence gaps are controlled, so it needs a pause policy, not just a splitter.
6. **SPEC §12:** add an open question: how Kokoro-82M ONNX handles pauses, long text and chunk boundaries.

## 9. Unverified items and follow-ups

1. **Read the primary papers:** Weingartová et al. 2014, Clark and Fox Tree 2002, Skantze's 2021 turn-taking review, the IWSDS 2025 survey, and the "Less can be more" paper (arXiv 2609.11066). Their PDFs were unreadable here.
2. **Find real data on within-answer pause lengths in interviews or monologues,** for native and non-native speakers. The 546 vs 686 ms figure comes from a vendor blog and is average conversational pause, not a mid-answer thinking pause.
3. **Test Smart Turn v3.2 on long-pause audio** (§7): its false-cutoff behavior is unmeasured in any source I found, and its training data composition is unconfirmed.
4. **Test Kokoro-82M ONNX directly:** pause-tag support, inter-sentence gaps in streaming, behavior on long text (the kokoro-onnx issue's cause is unconfirmed).
5. **Check whether fillers in the interviewer's own speech help or hurt** a practice tool. The voice-agent advice to add "um" is aimed at customer-service bots, not interview trainers.
6. **Check small-model compliance** with spoken-style prompt rules at Tier 0-1 (Qwen3.5 0.8B-4B). No source tests this.
7. **Find a primary source for the 700 ms floor-holding band,** shared with latency-perception.md §1.1.

## Sources

Read in full or in part (**[verified]**):

- [Pipecat, Smart Turn overview](https://docs.pipecat.ai/api-reference/server/utilities/turn-detection/smart-turn-overview)
- [Pipecat, smart-turn on GitHub](https://github.com/pipecat-ai/smart-turn)
- [Hugging Face, pipecat-ai/smart-turn-v3](https://huggingface.co/pipecat-ai/smart-turn-v3)
- [LiveKit, turn-taking tuning](https://docs.livekit.io/agents/logic/turns/tuning/)
- [LiveKit, turn detection for voice agents](https://livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection)
- [kokoro-onnx issue #11, unwanted pauses](https://github.com/thewh1teagle/kokoro-onnx/issues/11)

Search excerpts only (**[unverified]**):

- [LiveKit, turn-detector model card](https://huggingface.co/livekit/turn-detector) and [improved end-of-turn model, 39% fewer interruptions](https://livekit.com/blog/improved-end-of-turn-model-cuts-voice-ai-interruptions-39)
- [Soniqo, Smart Turn v3.2 guide](https://soniqo.audio/guides/turn) (source of the "largely TTS generated" claim)
- [Weingartová et al. 2014, Transitions, pauses and overlaps in Czech](https://www.isca-archive.org/speechprosody_2014/weingartova14b_speechprosody.pdf)
- [Heldner and Edlund 2010, Pauses, gaps and overlaps in conversations](https://www.diva-portal.org/smash/get/diva2:388247/FULLTEXT01.pdf)
- [Clark and Fox Tree 2002, Using uh and um in spontaneous speaking](http://www.columbia.edu/~rmk7/HC/HC_Readings/Clark_Fox.pdf)
- [IWSDS 2025, A Survey of Recent Advances on Turn-taking Modeling](https://aclanthology.org/2025.iwsds-1.27.pdf)
- [Less can be More: What Aspects of Speech Drive End-of-Turn Detection (arXiv 2609.11066)](https://arxiv.org/pdf/2609.11066)
- [Easy Turn, acoustic and linguistic end-of-turn (arXiv 2509.23938)](https://arxiv.org/pdf/2509.23938)
- [Duration-aware pause insertion for multi-speaker TTS (arXiv 2302.13652)](https://arxiv.org/abs/2302.13652)
- [MAGIC-TTS, local duration and pause control (arXiv 2604.21164)](https://arxiv.org/pdf/2604.21164)
- [Speak, building a voice agent platform](https://www.speak.com/blog/building-speaks-voice-agent-platform) (source of the 686 vs 546 ms figure)
- Voice-agent prompting and TTS guides: [Deepgram](https://developers.deepgram.com/docs/prompting-voice-agents), [Inworld](https://docs.inworld.ai/tts/best-practices/prompting-for-tts), [LMNT](https://docs.lmnt.com/guides/llm-prompt), [Bland](https://www.bland.ai/blog/how-to-make-text-to-speech-sound-more-natural); vendor material, cited only for practice
- [Kokoro streaming and chunking notes (FluidAudio PR, kokoro-js PR, Kokoro-TTS-Pause)](https://github.com/ibuhs/Kokoro-TTS-Pause)
