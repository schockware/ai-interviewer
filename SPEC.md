# Local AI Interviewer: Specification (Draft v0.1)

A local-first, open-source AI interviewer for practicing interviews by voice or text, with clear turn-taking, accessible status cues, and an optional simulator for real-world remote-call conditions.

> **Status:** design draft. Items marked **[unverified]** come from secondary sources or memory and must be confirmed before they are promised in public docs. See [Open Questions](#12-open-questions--unverified-items).

---

## 1. Goals and Non-Goals

### Goals
- **Fix turn-taking.** No laggy dead air, no interrupting the user, no ambiguity about when the interviewer is finished.
- **Run locally** on modest hardware (minimum 4 CPU cores), with optional GPU acceleration (CUDA first, an open alternative later).
- **Voice and text** in one interface, switchable mid-session.
- **Accessible by design**: audio and visual cues are redundant, captions are WCAG-minded, and nothing depends on a single sense.
- **Pluggable at every stage**: users can swap in their own STT, LLM, TTS, and turn detector.
- **Train for real remote interviews** via an opt-in Conditions Simulator (latency, jitter, packet loss, clipped audio).
- **Easy to install and contribute to** (one-command setup, reproducible benchmarks).

### Non-Goals (for now)
- Hiring-decision tooling or candidate screening. v1 is a practice tool.
- Voice cloning or celebrity voices.
- Cloud hosting. Cloud APIs may be used only if the user plugs them in.

---

## 2. Problems This Design Responds To

| Observed problem (from real interview experiences) | Design response |
|---|---|
| 180-300 ms gap between the user making a sound and the interviewer reacting | Streaming pipeline; explicit state cues; simulator can reproduce this on purpose for training |
| 1-2 s delay, with a jittery inflection at the end and audio cut off right where the inflection occurs | Tail-clip simulation; clarification-recovery coaching; accurate captions available |
| Packet loss: periodic sounds dropped, hard to follow | Burst-loss simulation with silence or concealment modes |
| Interruptions and bad turn-taking | VAD plus a semantic end-of-turn model, tunable timeouts, push-to-talk, "give me a sec" control |
| Unclear whether the interviewer had finished the question | Distinct "your turn" cue (chime plus ear bubble), live captions, one question at a time, "repeat that" |

---

## 3. Architecture

### 3.1 Pipeline

```
mic -> [uplink sim] -> VAD -> Turn Detector -> STT -> Follow-up Decider -> Interviewer LLM
                                                                              |
                                                                    [response delay sim]
                                                                              |
speaker <- [downlink sim: delay, jitter, loss, tail clip] <- TTS <- sentence streamer
                                   ^
           Evaluator (async, latency-insensitive): scoring, feedback, session report
```

Everything is **streaming**: transcribe while the user speaks, stream LLM tokens, and start TTS at the first sentence boundary.

### 3.2 Pluggable slots

| Slot | Job | Latency-sensitive? | Default | Alternatives |
|---|---|---|---|---|
| **Listening** | VAD plus end-of-turn detection | Yes | Silero VAD + Smart Turn v3.2 | LiveKit turn detector, custom |
| **Transcription** | Speech to text | Yes | Parakeet TDT 0.6B v3 | Moonshine (lowest tier), faster-whisper, whisper.cpp, Nemotron streaming |
| **Follow-up decider** | "Probe deeper or move on?" | Yes | Small fast LLM | Any |
| **Interviewer** | Writes the next question | Yes | Tier-appropriate LLM (see section 8) | Any |
| **Evaluator** ("thinking") | Scoring, STAR analysis, report | **No** | Same as interviewer, or larger | Larger local model or cloud API |
| **Speech** | Text to speech | Yes | Kokoro (82M) | Piper (see licensing note) |

### 3.3 Integration contract

- **LLM slots** use **OpenAI-compatible endpoints** (`base_url`, `model`, optional `api_key`), so Ollama, llama.cpp server, LM Studio, vLLM, or a cloud API all work through config. **[unverified: confirm current endpoint support per runtime]**
- **STT, TTS, and turn detector** slots implement small Python interfaces (`transcribe_stream`, `synthesize_stream`, `is_turn_complete`).
- A slot implementation must not need to know whether simulation is active.

### 3.4 Example configuration

```yaml
profile: auto            # auto | cpu_min | cpu_comfortable | gpu_16gb | gpu_24gb
interface: both          # voice | text | both

slots:
  stt:
    provider: parakeet
    device: auto         # auto | cpu | cuda
  turn_detector:
    provider: smart_turn_v3_2
    vad_stop_secs: 0.2
    max_silence_secs: 2.0
    push_to_talk: false
  follow_up:
    base_url: http://localhost:11434/v1
    model: qwen3:4b
    thinking: false
  interviewer:
    base_url: http://localhost:11434/v1
    model: qwen3:14b
    thinking: false
  evaluator:
    base_url: http://localhost:11434/v1
    model: qwen3:14b
    thinking: true       # acceptable here: not latency-sensitive
  tts:
    provider: kokoro
    voice: default

ux:
  cue_mode: perceived    # perceived | true_state | debug
  captions: accurate     # accurate | as_heard | off
  ambient_audio: true
  ambient_volume: 0.3
  reduced_motion: auto

simulator:
  preset: clean          # clean | decent_call | laggy_clipped | bad_connection | rough_day | custom
  seed: 42
```

---

## 4. UX: State Machine and Cues

One state machine drives both audio and visual cues.

| State | Visual | Audio | Screen reader / text |
|---|---|---|---|
| **Listening** | Ear bubble | Soft ambient office room tone | "Your turn" |
| **Thinking** | Thought bubble | Pen scribbling or typing | "Interviewer is thinking" |
| **Talking** | Ellipsis (...) | The voice itself | Optional live caption |
| **Idle / paused** | Neutral icon | Silence | "Paused" |

### 4.1 Design notes
- **"Your turn" cue:** a short chime plus the ear bubble appearing makes the handoff unambiguous.
- **Thinking sounds double as latency masking:** a pause reads as someone taking notes, not a stall.
- **Echo trap:** ambient audio played through speakers can be picked up by the mic and trigger VAD. Use separate audio buses (voice, ambient, effects), acoustic echo cancellation, gating of the mic path, or recommend headphones.
- **Controls:** pause, repeat, skip, hint, "give me a sec," optional push-to-talk, and mid-session switching between voice and text.

### 4.2 Accessibility (verify against WCAG 2.2 before release)
- Every audio cue has a visual equivalent, and every visual cue has an audio or text equivalent.
- Icons carry text labels, not shape alone. Status changes use an `aria-live` region, announced once per change.
- Ambient audio has its own mute and volume control. Nothing auto-plays without a way to stop it.
- Animations respect `prefers-reduced-motion`.
- Captions: adjustable size and contrast. Available as an accommodation (not framed as a "cheat" in the UI).
- Captions have two modes: **accurate** (true text, default) and **as_heard** (matches degraded audio, a hard-mode training option). A user relying on captions must not be penalized by a degraded-audio preset.

---

## 5. Conditions Simulator

Opt-in module that emulates remote-call conditions. Disabled by default and adds nothing when off.

**Principle:** simulated conditions are *added to* real pipeline latency, never substituted for it. The UI shows the measured pipeline floor and warns when a requested target is below it.

### 5.1 Parameters

| Parameter | Meaning | Applied |
|---|---|---|
| `uplink_delay_ms` (+ jitter) | User's voice reaches the interviewer late | Mic to VAD/STT; turn detection shifts accordingly |
| `downlink_delay_ms` (+ jitter) | Interviewer's voice reaches the user late | TTS to speaker |
| `response_delay_ms` | Gap before the interviewer starts speaking ("model receipt" latency) | Turn-end to LLM/TTS start |
| `packet_loss_pct` + `burst_length` | Dropped audio frames (about 20 ms frames) | Downlink |
| `loss_mode` | `silence` (hard gaps) or `concealment` (repeated or smeared frames) | Downlink |
| `tail_clip_ms` | Truncates the end of each interviewer utterance | Downlink, end of utterance |
| `seed` | Reproducible randomness | Global |

Loss uses a **burst model**, not independent per-frame drops, because evenly scattered drops sound unnatural.

### 5.2 Presets

Starting values are guesses to be tuned by ear. Only the first two are anchored to measured experiences.

| Preset | Settings |
|---|---|
| **Clean** | All off (default) |
| **Decent call** | ~90-150 ms one-way, light jitter (matches a measured ~180-300 ms round-trip gap) |
| **Laggy / clipped** | 1-2 s `response_delay`, 150-400 ms `tail_clip`, moderate jitter |
| **Bad connection** | 3-10% burst loss, concealment mode, little added delay **(assumed rates)** |
| **Rough day** | Combination, plus custom sliders |

### 5.3 What each trains
- **Short delay:** don't read a small gap as failure; don't talk over the interviewer.
- **Long delay with clipped tail:** recovery skill, e.g. "Just to confirm, was that a question about X?"
- **Packet loss:** ask for repetition rather than guess at missing words.

### 5.4 Policies and indicators
- **Double-talk policy:** `interviewer_yields`, `user_yields`, or `both_continue`.
- A persistent badge ("Simulated: Laggy") is shown whenever a preset is active, so artificial lag is never mistaken for a bug.
- The session report logs conditions and scores turn-taking: interruptions, overlong silences, and clarification requests after clipped or lost audio.

---

## 6. Cue Modes

```yaml
cue_mode: perceived   # perceived | true_state | debug
```

| Mode | Behavior | Best for |
|---|---|---|
| **`perceived`** (default) | Cues are driven by what has actually *arrived* through the simulated connection | Training for today's remote interviews |
| **`true_state`** | Cues reflect the pipeline's real internal state the instant it changes, ignoring simulated delay | Clear signals despite bad conditions; previewing a client-side-cue future |
| **`debug`** | Both timelines at once, with per-transition offsets | Developers, contributors, tuning presets |

### 6.1 Why `perceived` is the default
Most people practicing today will face interviews conducted over ordinary video-call software, where the interviewer's cues and audio reach them late, degraded, or clipped. `perceived` reproduces that experience, so it is the mode most likely to build skills that transfer.

### 6.2 Why `true_state` has its own value
Today, cues in remote conversations are inferred from the audio stream, so they arrive with the network's latency. A plausible future is AI interviewers and assistants whose **client software** shows audio and visual cues generated locally, from state the client already knows (for example, "I sent the user's turn and am waiting for a response," or "audio is currently playing"), rather than waiting on the server's round trip. `true_state` models that world: latency is accounted for by the client, and the user gets clean signals.

**Training hypothesis (to test):** moving from `perceived` to `true_state` should be easier than the reverse, because someone who has learned to wait without perfect signals loses nothing when signals become immediate, while someone trained only on immediate cues has to learn to cope with delay. The project should treat this as a hypothesis to validate with user feedback, not a established fact.

### 6.3 How `perceived` works
Every cue is an event stamped with a true timestamp on the interviewer side. In `perceived` mode those events pass through the same downlink simulator as the audio:

```
pipeline state -> [cue event] -> downlink sim -> cue renderer
TTS audio      -> [frames]    -> downlink sim (+ loss, tail clip) -> speaker
```

Rules:
- **Cues never lead the audio they describe.** The ellipsis appears when the first delayed audio frame arrives, not when TTS started.
- **Talking cue** is derived from received audio with hysteresis (persists through gaps under about 300 ms), so packet loss does not make it flicker.
- **Thinking and listening cues, scribbling sounds, ambient noise, and the "your turn" chime** all arrive late and can themselves be degraded, like any remote audio.
- **Tail clipping is not "repaired" by cues.** If the audio cuts off before the final inflection, the cue still flips to listening when the clipped audio ends.

### 6.4 Debug mode
- Dual-lane timeline (true state above, perceived below) with transition offsets in ms
- Markers for dropped frames, clipped tails, and VAD/turn-detector decisions
- Readout of measured pipeline floor vs. simulated additions
- One-click **JSON timeline export** for bug reports

### 6.5 Interactions
- With no simulation active, `perceived` and `true_state` are identical. Show a note so users don't think the toggle is broken.
- Switching modes mid-session is instant (the renderer just reads a different timeline).
- Screen-reader announcements follow the *displayed* cues, once per change.
- First time a non-Clean preset is chosen, show a dismissible explanation that cues will arrive late like a real call.
- The session report records the cue mode and preset.

---

## 7. Event Stream

The orchestrator emits one stream of events with true timestamps. The simulator, cue renderer, debug view, and export all consume it. This also makes the project a **reference for client-side cue protocols**.

```json
{ "t_true": 4.210, "type": "state", "state": "thinking" }
{ "t_true": 4.980, "type": "state", "state": "talking" }
{ "t_true": 4.985, "type": "audio_frame", "stream": "voice", "seq": 212, "dur_ms": 20 }
{ "t_true": 9.400, "type": "state", "state": "listening" }
```

After simulation, each event also carries `t_perceived` (or `dropped: true`). Event types are additive, and unknown types must be ignored, so third-party clients can render only what they understand.

---

## 8. Hardware Tiers and Model Sizes

Figures are drawn from secondary roundups and **conflict between sources**. Treat them as recommendations and ship a `benchmark` command so users can measure their own machines.

| Tier | Hardware | LLM size | Example models | Reported notes |
|---|---|---|---|---|
| **1: Minimum** | 4 CPU cores, ~8 GB RAM | 2-4B, Q4 | Qwen3.5 4B, Phi-4-mini 3.8B, Gemma 3 2B/4B, Llama 3.2 3B, SmolLM3 3B | One test: Phi-4 Mini ~2.3 GB at ~12 tok/s on CPU; Gemma 3 2B ~15 tok/s; Llama 3.2 3B ~10 tok/s |
| **2: Comfortable CPU / entry GPU** | 8+ cores, 16 GB RAM, or 8 GB GPU | ~7-8B, Q4 | Qwen3 8B | ~5 GB at Q4_K_M; CPU speed claims range from ~5 to ~18 tok/s |
| **3: GPU 12-16 GB** | RTX 4070 to 5080 class | 12-14B, Q4/Q5 | Qwen3 14B, Gemma 3 12B, Phi-4 14B | Qwen3 14B ~8.5 GB at Q4_K_M; Gemma 3 12B ~6.7 GB |
| **4: GPU 24 GB+** | 3090/4090/5090 | 27-32B | Gemma 3 27B, Qwen3 30B/32B, MoE models such as Gemma 4 26B-A4B | A 32B model needs about 24 GB |

Model generations move quickly, so documentation should describe tiers by **size class with example models** and avoid pinning to a single model name.

### 8.1 Interview-specific guidance
- **Optimize time to first sentence, not tokens/sec.** Speech runs at roughly 3-4 tokens/sec, so even about 10 tok/s outpaces the voice if sentences are streamed to TTS as they finish.
- **CPU contention is the real limiter on 4 cores:** LLM, STT, VAD, and TTS compete. Benchmark the whole pipeline, not each model alone.
- **Cache the KV state** for static context (resume, job description) so only each new turn is processed. **[engineering reasoning; verify]**
- **Disable "thinking" modes for live turns.** Reported to roughly halve tokens/sec.
- **Keep interviewer replies to one or two sentences.**
- **Leave VRAM headroom** (a couple of GB) for STT and TTS alongside the LLM.

### 8.2 Reference dev machine
Windows 11, 32-logical-processor i9, RTX 5080 (16 GB, Blackwell). A guide for this class of card suggests a 14B model at Q4/Q5 as the best clean fit, using spare compute for latency rather than forcing a larger model. Blackwell cards need recent CUDA and PyTorch builds, so pin versions in setup docs **[verify exact minimums]**.

### 8.3 Simulating the minimum tier
Developers on larger machines can pin CPU affinity to 4 cores and limit RAM to approximate Tier 1. The `benchmark` command should support this.

---

## 9. Speech and Turn-Detection Notes

### STT
- **Parakeet TDT 0.6B v3:** reported to beat Whisper large-v3 on accuracy at a quarter of the size and run much faster on CPU. Narrower language coverage than Whisper.
- **Moonshine base (61.5M):** small CPU/streaming option for the lowest tier.
- **faster-whisper** is a safe default for a self-hosted server; **whisper.cpp** is the strongest portable CPU option and suits the non-CUDA path.
- **Nemotron streaming** models are built for live text and are optional (useful for live captions of the *user's* speech).

### Turn detection
- Silero VAD runs first. **Smart Turn v3.2** then confirms whether a pause is a finished turn. It analyzes raw audio (prosody, pace, intonation), not a transcript, and covers 23 languages. The int8 ONNX build is about 11 MB, and reported CPU latency is about 20 ms with four threads (**measured on an Apple M5 Pro, not 4-core x86**).
- Pipecat bundles a local Smart Turn analyzer and expects VAD `stop_secs` around 0.2.
- One self-reported third-party benchmark shows LiveKit's turn detector with fewer false cutoffs than Smart Turn v3.2. Keep the detector swappable and tune with real testing.

### TTS
- **Kokoro** (82M parameters, Apache 2.0) is the quality default and can run on CPU, but a real-time benchmark on 4 cores is unverified.
- **Piper** is the speed choice for CPU but is now GPL-3.0-or-later, which affects how the repo can be licensed if it is bundled.

### Orchestration
- **Pipecat** is the leading candidate. A lean custom pipeline remains an option if its dependencies prove too heavy for the minimum tier.

---

## 10. Licensing and Distribution

- **Do not bundle model weights.** Download them at setup, and display each model's license.
- Qwen3 and Phi-4-mini are reported as permissive; **Gemma uses its own Terms of Use**.
- Check the GPL implications of Piper before deciding the repo's license. Smart Turn is BSD-2-Clause; Kokoro is Apache 2.0.
- Provide one-command setup and prebuilt environments for CPU and CUDA profiles. Add an open GPU path later (Vulkan/ROCm/Metal through llama.cpp and ONNX Runtime) **[unverified]**.

---

## 11. Testing and Benchmarks

- `benchmark` command: per-stage and end-to-end latency (turn-end to first audio), CPU load, memory, with optional core pinning
- Reproducible simulator runs via `seed`
- Golden-file tests for the event stream, including `perceived` timestamp calculations
- Accessibility checks: keyboard-only use, screen-reader announcements, reduced motion, caption contrast
- User testing of cue modes to evaluate the `perceived` to `true_state` transfer hypothesis

---

## 12. Open Questions / Unverified Items

1. Non-CUDA GPU backends: which are supported today, and how much speed do they give?
2. 4-core x86 benchmarks for Smart Turn, Kokoro, and a 3-4B LLM running together
3. Current OpenAI-compatible endpoint support in each local runtime
4. WCAG 2.2 criteria mapping for ambient audio, animation, and status messages
5. Latency guidance such as ITU G.114 (about 150 ms one-way) **[recalled from memory]**
6. Minimum CUDA/PyTorch versions for RTX 50-series (Blackwell)
7. Real-world packet-loss rates and codec concealment behavior for realistic presets
8. The `perceived` to `true_state` transfer hypothesis (needs user testing)
9. Piper licensing details (sources are inconsistent about MIT vs. GPL)

---

## 13. Roadmap (Suggested)

1. **Prototype UI**: state machine, cues, captions, cue-mode toggle (no models required)
2. **Voice loop**: VAD, Smart Turn, STT, small LLM, TTS with streaming, on the dev machine
3. **Simulator**: delay, jitter, loss, tail clip, presets, event stream
4. **Debug mode and export**
5. **Tier profiles and `benchmark`**
6. **Evaluator and session report**
7. **Packaging, docs, and a first public GitHub release**
8. **Open GPU backend and additional slot providers**

---

## References (secondary sources consulted during research)
- Parakeet vs Whisper vs Nemotron comparison (openwhispr.com)
- Offline speech-to-text roundups (diyai.io, localaimaster.com)
- Smart Turn v3.2 documentation (docs.pipecat.ai, Hugging Face model cards)
- TurnWave benchmark table (Hugging Face)
- Local TTS comparisons (offlinetts.com, localaimaster.com, promptquorum.com, codesota.com)
- Local LLM roundups and hardware guides (popularai.org, tinyweights.dev, frankx.ai, fast.io, bestllmfor.com, codesota.com)
