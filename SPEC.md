# Local AI Interviewer: Specification (Draft v0.1)

A local-first, open-source AI interviewer for practicing interviews by voice or text, with clear turn-taking, accessible status cues, and an optional simulator for real-world remote-call conditions.

> **Status:** design draft. Items marked **[unverified]** come from secondary sources or memory and must be confirmed before they are promised in public docs. See [Open Questions](#12-open-questions--unverified-items).

> **Layer specs:** each layer of the pipeline is being specified on its own, technology-agnostic, in [`specs/`](specs/README.MD). Once a layer has a spec, that spec governs what must be true, and this document keeps the technology choices and the overall vision.

---

## 1. Goals and Non-Goals

### Goals
- **Fix turn-taking.** No laggy dead air, no interrupting the user, no ambiguity about when the interviewer is finished.
- **Run locally** on modest hardware (minimum 4 CPU cores), with optional GPU acceleration (CUDA first, an open alternative later).
- **Voice and text** in one interface, switchable mid-session.
- **An opinionated interview UX first.** The core claim is that simple visual and audio cues help candidates interview better. Training modules come second, and are possible because we own the client.
- **Accessible by design**: audio and visual cues are redundant, captions are WCAG-minded, and nothing depends on a single sense. The same accessibility options double as practice supports (4.6).
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

Every slot is swappable. The candidates listed here are the models that fit the **Tier 1 minimum** (section 8): speech stack of about 2 GB, 4 CPU cores, and LLM of about 3.5 GB. Defaults are in 3.2.1 (minimum spec) and 3.2.2 (reference dev machine). Models that need more than the minimum, such as Parakeet, Nemotron, Kokoro and larger Whisper sizes, are not listed here. They may appear as higher-tier choices in 3.2.2 or section 8, and the reasons for each removal are in `docs/decisions/0001-minimum-spec-model-defaults.md`.

| Slot | Job | Latency-sensitive? | Candidates (meet the minimum) |
|---|---|---|---|
| **Listening** | VAD plus end-of-turn detection | Yes | Silero VAD + Smart Turn v3.2 (int8), custom |
| **Transcription** | Speech to text | Yes | whisper.cpp (tiny, base) |
| **Follow-up decider** | "Probe deeper or move on?" | Yes | The interviewer LLM, with its own short prompt |
| **Interviewer** | Writes the next question | Yes | Qwen3.5 ladder (0.8B, 2B, 4B, 9B), Tier-appropriate otherwise (section 8) |
| **Evaluator** ("thinking") | Scoring, STAR analysis, report | **No** | Same as interviewer, or larger; larger local model or cloud API |
| **Speech** | Text to speech | Yes | Kokoro (82M), Inflect-Nano-v1 (Tier 0 only, quality-limited) |

**License filter:** a model is also left out of this list if its code or weights carry a license question that could affect the license of this repo or the users of the app. All candidates here are MIT, Apache-2.0, BSD or CC-BY. Models removed for this reason (Piper, Supertonic 3, Moonshine v2, LiveKit's detector) can return once the question is settled.

#### 3.2.1 Defaults for the minimum supported spec

Chosen so that a Tier 1 machine (4 cores, at least 6 GB free RAM, CPU only) can run the whole stack. Tier 0 uses the fallback column. All memory and speed figures are **[unverified]** until `benchmark` measures them on 4-core x86 (section 12 items 2 and 13).

| Slot | Default | Tier 0 fallback | Why |
|---|---|---|---|
| **Listening** | Silero VAD v6 + Smart Turn v3.2 int8 (ONNX, CPU) | same | About 10 MB of weights and tens of ms per decision. Smart Turn latency is only measured on an Apple M5 Pro |
| **Transcription** | whisper.cpp base (74M, multilingual, MIT) | whisper.cpp tiny (39M) | About 0.4 GB RAM (base) and 0.27 GB (tiny) per the whisper.cpp README. Not natively streaming, so it transcribes in chunks and finishes shortly after the turn ends, which adds latency. No 4-core x86 speed figure is published |
| **Follow-up decider** | The interviewer LLM instance, with a short prompt | same | A second model does not fit in the minimum budget |
| **Interviewer** | Qwen3.5 4B, Q4_K_M, thinking off, 8K context | Qwen3.5 2B, Q4_K_M | About 3.5 GB resident including a 256 MiB KV cache, because only 1 in 4 layers caches context. Apache-2.0 and ungated |
| **Evaluator** | Same model, run between turns or after the session | same | It is not latency-sensitive, so thinking mode may be on for scoring |
| **Speech** | Kokoro 82M, ONNX (Apache-2.0) | Kokoro, with Inflect-Nano-v1 (Apache-2.0, RTF 0.145, "buzzy" quality) as the lower-cost option | The best-quality Apache-licensed candidate. **This is the riskiest default:** its published RTF is 0.5-0.67 *alone* on 4 x86 cores, likely near 1.0 beside an LLM, and peak memory ranges from 0.4 to 2.0 GB across sources, which would exceed the 2 GB speech reserve |

If a first-load measurement exceeds the budget, the fit calculator steps down one rung (section 8.3). If TTS cannot keep ahead of real time on a Tier 0 or Tier 1 machine, that machine falls back to spoken input with text and caption output.

#### 3.2.2 Defaults for the reference dev machine

Hardware: Windows 11, Intel Core i9-14900KF (hybrid: 8 performance cores and 16 efficiency cores, 32 threads), 64 GB DDR5-6000, RTX 5080 (16 GB VRAM, Blackwell). This is a Tier 4 machine with plenty of spare RAM and CPU. The KF has no integrated graphics, so the RTX 5080 also drives the display and Windows uses part of the VRAM.

**Hardware disclaimer:** these defaults are tuned to this machine and are not requirements. They are a reference configuration for developers and for benchmarking, and they use models that do not meet the minimum spec in 3.2.1.

**"Most consistent"** is read here as predictable latency and behavior, not the highest benchmark score. The rules behind the choices:
1. **Each heavy slot gets its own hardware.** The LLM owns the GPU. STT, TTS, VAD and the turn detector run on the CPU, so they never compete with the LLM for VRAM or GPU compute.
2. **Everything stays resident.** Nothing is paged, swapped or reloaded between turns.
3. **Dense or hybrid models, not MoE,** and a cheap KV cache so latency does not grow as the transcript grows.
4. **Same families as 3.2.1 where possible,** so prompts and quirks carry across tiers.

| Slot | Default | Placement | Why |
|---|---|---|---|
| **Listening** | Silero VAD v6 + Smart Turn v3.2 int8 | CPU | Same as 3.2.1. Pin real-time threads to the performance cores so Windows does not schedule them on efficiency cores |
| **Transcription** | Parakeet TDT 0.6B v3, int8 ONNX (CC-BY-4.0) | CPU | Reported RTF 0.02-0.04 on 8 logical CPUs, so 32 leave wide margin. Best accuracy of the researched models, and captions benefit. Not natively streaming, so chunk at about 30 s windows and cap utterance length. whisper.cpp base (the 3.2.1 default) stays available as the cross-check |
| **Follow-up decider** | The interviewer LLM instance | GPU | Avoids loading a second model |
| **Interviewer** | Qwen3.5 9B, Q8_0, thinking off, 8K context | GPU | About 10.3 GB resident (9.5 GB weights, 0.27 GB KV, 0.5 GB overhead), leaving about 5.7 GB of VRAM for Windows, the CUDA context and spikes. Cheap hybrid KV keeps latency flat as context grows |
| **Evaluator** | Same model with thinking on | GPU, after the session | Optional upgrade: Gemma 4 26B-A4B Q4 on CPU, using the 64 GB of RAM. It fits (about 17 GB) but speed on DDR5-6000 is unmeasured |
| **Speech** | Kokoro 82M, ONNX | CPU | Reported RTF about 0.2 on 32 vCPUs. Apache-2.0. GPU Kokoro is much faster (36-96x real time on cloud GPUs) but shares the GPU with the LLM, which adds jitter |

**Larger-model option.** More parameters should improve *behavioral* consistency (holding to one question at a time, short replies, and the persona over a long session), but not latency consistency, which is better with a smaller model. The behavioral benefit is a hypothesis that `benchmark` and user testing must confirm.
- **Optional alternative: Gemma 4 12B, Q6_K, fully on the GPU.** About 10.7 GB predicted (9.8 GB weights, 0.4 GB KV at 8K, 0.5 GB overhead) against 10.3 GB for the default. It breaks rule 4 (different family from the minimum tier), and its KV size depends on runtime behavior that is unconfirmed (section 12 item 12).
- **Q8_0 of the same model (about 13.6 GB) is not recommended.** With Windows using VRAM for the display, too little headroom remains.
- **Not recommended for consistency:** Qwen3.5 27B, Gemma 4 31B or the 26B-A4B and 35B-A3B MoE models, because they do not fit in 16 GB VRAM and would need CPU offload. Offload makes latency depend on DDR5 bandwidth and expert routing, which breaks rules 1 and 2. They remain valid for the evaluator.
- Any larger model needs the hardware disclaimer above, and the tested VRAM headroom must be stated next to it.

Open checks: (a) rule 1 is a hypothesis, so `benchmark` should compare p50 and p95 turn latency with TTS on the CPU against TTS on the GPU; (b) Blackwell needs recent CUDA and PyTorch builds (section 12 item 6); (c) the Qwen3.5 9B memory figures are predictions, not measurements.

### 3.3 Integration contract

- **LLM slots** use **OpenAI-compatible endpoints** (`base_url`, `model`, optional `api_key`), so Ollama, llama.cpp server, LM Studio, vLLM, or a cloud API all work through config. **[unverified: confirm current endpoint support per runtime]**
- **STT, TTS, and turn detector** slots implement small interfaces (`transcribe_stream`, `synthesize_stream`, `is_turn_complete`). The project uses several languages (see `docs/decisions/0002-implementation-languages.md`), so these are language-neutral contracts. Python is where the model-backed slots are expected to be hosted. **[the transport between languages is not decided]**
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
  captions: off          # off | accurate | as_heard (off matches a real interview; see 4.6)
  interviewer_voice: on  # on | off (off: text only)
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
| **Talking** | Ellipsis (...) | The voice itself | Not announced by default; transcript always available (4.3) |
| **Uninterruptible** | Ear with a slash, with a text label | The voice itself, after a short hold | "The interviewer is not listening during this portion of the interview." (once on entering) |
| **Idle / paused** | Neutral icon | Silence | "Paused" |

### 4.1 Design notes
- **"Your turn" cue:** a short chime plus the ear bubble appearing makes the handoff unambiguous.
- **Thinking sounds double as latency masking:** a pause reads as someone taking notes, not a stall.
- **Echo trap:** ambient audio and screen reader speech played through speakers can be picked up by the mic and trigger VAD. Use separate audio buses (voice, ambient, effects), acoustic echo cancellation, gating of the mic path, or recommend headphones.
- **Controls:** pause, repeat, skip, hint, "give me a sec," optional push-to-talk, mid-session switching between voice and text, and an always-available Accessibility button (4.2).
- **End interview:** a separate control placed below the control group, apart from the other buttons, so it is not hit by mistake. It asks for confirmation first, and the safe choice ("Keep going") takes focus. Confirming closes the session at once, without the interviewer's closing.
- **Uninterruptible:** the opening and the closing of the interview, where the interviewer cannot be interrupted and is not listening. It has its own cue: an ear with a slash plus a text label, so the meaning never rests on the icon or the colour alone. A banner shows the notice "The interviewer is not listening during this portion of the interview." and it is announced once on entering each of the two portions.
- **Hold before the voice (text and braille readers):** the notice would otherwise collide with the interviewer's voice, and a braille display may not carry a live announcement at all. So the notice stays on screen as text, and the voice is held behind a progress bar. The length of the hold is a placeholder until the timing is known. The progress bar has a name and a fixed text value, and its movement is not announced. There is no skip control, because it is not yet known whether the stream can be controlled. The hold is a timed phase inside the Uninterruptible state, not a state of its own. After a pause in the opening or closing, resuming repeats the notice and the hold once. Whether the hold shows for every user or only in screen reader mode is open; for now it follows the timing profile (4.4), and the accessible profile is the default.

### 4.2 Accessibility (verify against WCAG 2.2 before release)
- Every audio cue has a visual equivalent, and every visual cue has an audio or text equivalent.
- Icons carry text labels, not shape alone. Status changes use an `aria-live` region, announced once per change.
- Ambient audio has its own mute and volume control. Nothing auto-plays without a way to stop it.
- Animations respect `prefers-reduced-motion`.
- Braille and deafblind users are covered by the navigable transcript (4.3), because live regions may not reach a braille display.
- Captions: adjustable size and contrast. Off by default, because a real interview shows no transcript (4.6), and one step to turn on from the Accessibility button and at setup. Available as an accommodation and a practice support, never framed as a "cheat" in the UI.
- **Captions button and help.** The main screen has a Captions button (icon plus text label showing on or off) that turns captions on in one press. Next to it, a question-mark button (`aria-label` "Why are captions off?") reveals: "Most online interviews do not have a captioning system. It is defaulted to be off." The same text appears beside the captions setting in the Accessibility panel.
- **No caption progress indicator.** Captions do not highlight words or show a chase icon while speech continues; the Talking cue (ellipsis) is the signal that the interviewer is still speaking.
- **Deaf and hard-of-hearing users** are assumed to bring their own speech-to-text for online interviews, so the off default does not block them. The native captions are still one press away for those who prefer them.
- Captions have two modes: **accurate** (true text, the default once captions are on) and **as_heard** (matches degraded audio, a hard-mode training option). A user relying on captions must not be penalized by a degraded-audio preset.
- **Accessibility button, first class.** An Accessibility button with an icon and a text label is visible on every screen and is never hidden, collapsed or disabled. When a screen loads, focus lands on it first, before any other control. It opens the accessibility settings (screen reader mode, captions, motion, sound levels, push-to-talk, pause timing, and Advanced Accessibility, 4.5), and every setting has a working default, so a user who never opens it still gets a usable session.

### 4.3 Screen reader mode
A screen reader's speech can collide with the interviewer's voice. The page cannot see or pause the screen reader, and neither ARIA nor the browser reports when it has finished speaking, so the cue gating must hold an appropriate block of time itself. The rules below follow `docs/research/screen-reader-live-updates.md` (§5). Screen reader mode is turned on from the Accessibility button, because a page cannot reliably detect a screen reader. Every timing value here is a **proposal** to be confirmed by manual screen reader passes.

- **One speaker at a time.** While the interviewer's voice plays, it is the foreground channel. Non-urgent announcements wait until the voice stops and are then delivered once.
- **One audio timeline.** Interviewer voice and all earcons (chime, scribble, lead-in tone) play through one sequenced queue, so they cannot overlap each other.
- **Gate on played audio.** "Your turn" is announced only after the audio player reports that the last voice frame has actually played (scheduled end plus output latency), followed by a silence guard (proposal: 250 ms). The pipeline's "TTS finished" event is not a valid gate. In `perceived` mode the gate reads the delayed, clipped audio the user hears.
- **Coalesce, and drop stale states.** State announcements are debounced (proposal: 250-500 ms), and only the state that is displayed when the debounce ends is announced. A false cutoff that flips listening, thinking, listening within a second announces nothing new. A state is never announced twice.
- **Per-state policy (defaults):**

  | State or event | Announced | Notes |
  |---|---|---|
  | Listening | "Your turn", polite (`role="status"`), after the gate | The chime plays first; the text follows it |
  | Thinking | "Thinking", polite, only if it is still current after a threshold (proposal: 500 ms) | Shorter flips are earcon only |
  | Talking | Not announced | The voice is the signal. An opt-in setting can turn it on |
  | Uninterruptible | "The interviewer is not listening during this portion of the interview.", polite, once on entering the opening and once on entering the closing | Shown as a banner as well. The voice is held behind a progress bar (4.1) |
  | Paused | "Paused", polite, after the voice has faded out | Follows a user action |
  | Control feedback | A few words, polite | For example "Muted", "Repeating" |
  | Blocking errors (microphone or connection lost) | Assertive (`role="alert"`) | The only interrupting case |
  | Simulation badge, first-use explanation | Once, on first appearance, polite | |

- **Short strings.** Announcements are a few words ("Your turn", "Thinking", "Paused"), to keep any collision short.
- **Lead-in before the voice.** A short tone, then a gap (proposal: 150 ms tone, 300 ms gap), precedes each interviewer utterance.
- **Hold the voice after a recent announcement** for its estimated speaking time (words divided by the user's reader rate, set in Accessibility settings).
- **Live region hygiene.** The status region exists and is empty at load. Repeating identical text uses clear, then set after a short delay (proposal: 100 ms). Focus never moves to announce anything.
- **Captions are not a live region by default.** A persistent, navigable transcript (`role="log"`, finished sentences only) is the main channel for braille and deafblind users, since live regions may not reach a braille display. An opt-in live-caption setting appends one final sentence at a time, never word by word.
- **Announcement setting, three-way, remembered:** quiet while the interviewer speaks (default), always announce (for users who duck other audio), or off (chime and transcript only).
- **Sound:** the interviewer's voice gets its own volume control, independent of system volume. Ambient sound defaults to off in screen reader mode.
- **Keyboard:** a documented shortcut pauses the interviewer. It must not clash with screen reader keys, and single-character shortcuts can be turned off or remapped.
- **First-run note:** headphones are recommended, because screen reader speech on speakers can reach the microphone. Screen reader ducking (NVDA, JAWS, VoiceOver) is mentioned as an option the user controls; the design never depends on it.
- **`ariaNotify()`** may be added only as a feature-detected enhancement, using either it or the live region for a given message, never both.

### 4.4 Two timing profiles
The cue timing has two competing targets:

- **Natural:** tuned to match human conversational timing (turn gaps near 200 ms, thinking cue at 300-500 ms; see `docs/research/latency-perception.md`).
- **Accessible:** tuned so screen reader speech fits around the interviewer's voice (gates, guards, debounce and holds in 4.3). It is slower by design.

**The accessible profile is the default for now.** Reconciling the two (for example, using the natural profile only when screen reader mode is off) is deferred until the timing is tuned with real users. The profile in use is recorded in the session report.

### 4.5 Advanced Accessibility
Screen readers differ in how they handle live updates (for example, TalkBack treats every region as assertive, NVDA re-announces speech an alert interrupted, and JAWS with Chrome may speak polite regions at the first break). The Accessibility panel therefore has an **Advanced Accessibility** section with a screen reader profile:

- **Profiles:** Generic (default), NVDA, JAWS, Narrator, VoiceOver on macOS, VoiceOver on iOS and iPadOS, TalkBack, and Orca. A profile adjusts delivery only: debounce, guard and hold times, clear-then-set delay, and whether `ariaNotify()` is used. It never changes what is announced.
- **Generic** uses the accessible defaults in 4.3 and is safe for any screen reader.
- **Reader rate** (words per minute) for the hold estimate.
- Profile values come from manual passes with each screen reader and browser pair, which are not done yet. Until a profile has been tested, it is shown as experimental and behaves like Generic.

### 4.6 Accessibility options as practice supports
Because the project owns the client, it can offer what real interview software does not. A real AI or human interview shows no transcript, so the **defaults recreate a real interview**: interviewer voice on, captions and transcript off. A candidate practicing verbal context gathering does so with the defaults.

The accessibility options are also **practice supports** for any candidate. One setting serves both purposes, in one place (the Accessibility button), and the UI never treats either use as lesser.

| Setting | As an accommodation | As a practice support |
|---|---|---|
| Captions and transcript | Deaf, hard-of-hearing, braille and deafblind users | A candidate who struggles to follow the AI's speech reads along, then turns it off as they improve |
| Interviewer voice off (text only) | Users who cannot use audio output | Rely on the transcript alone, for example to focus on structuring answers before working on listening |
| Screen reader mode and timing profiles (4.3-4.5) | Screen reader users | More room around each handoff while learning the turn-taking rhythm |
| "Give me a sec", pause timing, push-to-talk | Slower or disfluent speech, second-language speakers | Practice thinking before answering without being cut off |
| Cue sounds and visual cues | Redundant channels for any single sense | The core UX; turning cues off rehearses a plain video call |

Rules:
- **Defaults are the realistic interview.** Supports are opt-in, one step away, and offered at setup.
- **Exception:** turning on screen reader mode also turns on the transcript, because it is the main channel for braille users (4.3).
- **Never penalize.** The session report records which supports were on, so a candidate can track progress toward the realistic setting. It never lowers a score because a support was on.


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
- The session report records the cue mode, the preset, and which practice supports were on (4.6).

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

Figures are drawn from secondary roundups and **conflict between sources**. Treat every number here as **provisional** until the `benchmark` command has measured it. Supporting research is in `docs/research/` (LLM ladders, speech-stack footprints, and developer and non-technical hardware profiles).

### 8.1 How the minimum is defined

- **Minimums are stated against free resources, not installed.** An 8 GB laptop with a browser and a video call open has roughly 1.5-3 GB free **[estimate, not measured]**. A 16 GB laptop has roughly 7-9 GB free. Setup reads *free* RAM and VRAM, and shows the user the number it used.
- **Reserve the speech stack first, then fit the LLM into what remains.** Speech stack (VAD, turn detector, STT, TTS), excluding the LLM, is roughly 0.7-3.2 GB at the minimal configuration, 3.7-7.7 GB at mid, and 5-8 GB of VRAM at high. The ranges are wide because published figures conflict, so the fit calculator uses the high figure until `benchmark` measures the real one.
- **Memory placement is per slot.** When VRAM is short, the LLM takes the GPU and speech runs on the CPU, if there is enough RAM. Apple silicon and integrated GPUs share one pool, so count them as RAM.
- **Disk:** the downloaded stack is roughly 5-10 GB for small configurations. Setup checks free disk before downloading.
- **Not supported for local mode:** Chromebooks and locked-down school or library machines, and any machine below the Tier 0 floor. These get a text-only or remote-backend mode, with a clear message, instead of a failed setup.

### 8.2 Tiers

Tiers come from the fit calculator's output. This table is the starting estimate for it, using the model-size ladders in `docs/research/llm-size-ladders.md`. "LLM budget" is the memory left for the LLM after the speech reserve.

| Tier | Free memory and hardware | LLM budget | LLM size class | Example models (Q4_K_M unless noted) |
|---|---|---|---|---|
| **0: Constrained** (best effort) | 4 cores, at least 4 GB free RAM, CPU only. Typically an 8 GB machine with other apps closed | ~2 GB | 0.8-2B | Qwen3.5 0.8B or 2B, Llama 3.2 1B. Speech limited to the smallest STT and TTS |
| **1: Minimum** (supported) | 4 cores, at least 6 GB free RAM (typically 16 GB installed), CPU only | ~3.5 GB | 2-4B | Qwen3.5 4B (the default, see 3.2.1), Qwen3.5 2B at Q8 |
| **2: Comfortable CPU** | 8+ cores, at least 10 GB free RAM | ~6 GB | 4-9B | Gemma 4 E2B or E4B, Phi-4-mini, Qwen3.5 9B (tight) |
| **3: GPU 8 GB** | 8 GB VRAM, speech on CPU with 16 GB RAM | ~6 GB VRAM | 4-9B | Gemma 4 E4B, Qwen3.5 4B at Q8, Qwen3.5 9B at IQ4_XS (tight) |
| **4: GPU 12-16 GB** | RTX 4070 to 5080 class, or Apple silicon with 24 GB+ | ~10-14 GB | 9-14B | Qwen3.5 9B at Q6/Q8, Gemma 4 12B at Q4/Q5 |
| **5: GPU 24 GB+** | 3090/4090/5090, or 32 GB+ free on a large Mac | ~22 GB | 26-32B | Qwen3.5/3.8 27B, Gemma 4 31B, MoE such as Gemma 4 26B-A4B |

Notes:
- **CPU-only is tighter than the memory column suggests.** On 4 cores the LLM, STT, VAD and TTS compete for CPU time. Kokoro alone used about 50-67% of real time on 4 cores in the one published benchmark, and no 4-core x86 benchmark exists for the other components. Tier 1 and below therefore depend on `benchmark` results.
- **MoE models need all weights in memory.** Gemma 4 26B-A4B and Qwen3.x 35B-A3B decode at small-model speed but need 17-22 GB at Q4. They suit Tier 5 and 32 GB RAM machines, not smaller tiers.
- **Mixed GPU/CPU placement for MoE** (experts on CPU, attention on GPU) is possible in some runtimes **[unverified]** and is not assumed.
- The previous model names in this section (Qwen3, Gemma 3, Phi-4, Llama 3.2) are now a generation behind, and Gemma 3 and Llama 3.2 are gated behind click-through licenses. Qwen3.5 and Gemma 4 are Apache-2.0 and ungated.

Model generations move quickly, so documentation should describe tiers by **size class with example models** and avoid pinning to a single model name.

### 8.3 Fit calculator rules

- The ladder is **data-driven per model**: layers, KV heads, head dimension, layer-type pattern (full, linear or sliding window), window size, total and active parameters, and the real file size of each quantization. KV-cache size varies by 10x or more between architectures at the same parameter count, so one global formula is not used.
- Weights ≈ parameters × bits-per-weight / 8, with about 4.7-5.2 bits for Q4_K_M, 5.7 for Q5_K_M, 6.6 for Q6_K and 8.5 for Q8_0. The calculator uses the exact size of the file it will download.
- KV cache = 2 × KV-carrying layers × KV heads × head dim × context × bytes per element.
- Default planning assumptions, all configurable: 8K context, about 0.5 GB runtime overhead, about 2 GB headroom. All three are **[unverified]**.
- **Verify on first load.** Read the runtime's reported model and KV buffer sizes, compare with the prediction, and step down one rung on failure.
- Cap utterance length for STT. Parakeet v3 int8 peak memory is reported at 1.5 GB on short clips and 5.5 GiB on long audio.

### 8.4 Interview-specific guidance
- **Optimize time to first sentence, not tokens/sec.** Speech runs at roughly 3-4 tokens/sec, so even about 10 tok/s outpaces the voice if sentences are streamed to TTS as they finish.
- **CPU contention is the real limiter on 4 cores:** LLM, STT, VAD, and TTS compete. Benchmark the whole pipeline, not each model alone.
- **Cache the KV state** for static context (resume, job description) so only each new turn is processed. **[engineering reasoning; verify]**
- **Disable "thinking" modes for live turns.** Reported to roughly halve tokens/sec. Qwen3.5 9B and 27B default to thinking on, so setup must pass the right chat-template flag.
- **Keep interviewer replies to one or two sentences.**
- **Leave headroom** (a couple of GB) for STT and TTS alongside the LLM, or run them on the CPU.

### 8.5 Reference dev machine
Windows 11, 32-logical-processor i9, RTX 5080 (16 GB, Blackwell). With speech running on the CPU, this is a Tier 4 machine. A guide for this class of card suggests a 12-14B model at Q4/Q5 as the best clean fit, using spare compute for latency rather than forcing a larger model. Blackwell cards need recent CUDA and PyTorch builds, so pin versions in setup docs **[verify exact minimums]**.

### 8.6 Simulating the minimum tier
Developers on larger machines can pin CPU affinity to 4 cores and limit RAM to the Tier 1 free-memory figure (not the installed figure) to approximate it. The `benchmark` command should support this.

---

## 9. Speech and Turn-Detection Notes

### STT
- **Parakeet TDT 0.6B v3:** reported to beat Whisper large-v3 on accuracy at a quarter of the size and run much faster on CPU. Narrower language coverage than Whisper.
- **Moonshine v2 (tiny 34M, small 123M):** small streaming models, but not adopted for now because the v2 paper and the repo word the weights license differently, and the legacy non-English models are non-commercial. Revisit once the license is confirmed.
- **faster-whisper** is a safe default for a self-hosted server; **whisper.cpp** is the strongest portable CPU option and suits the non-CUDA path.
- **Nemotron streaming** models are built for live text and are optional (useful for live captions of the *user's* speech).

### Turn detection
- Silero VAD runs first. **Smart Turn v3.2** then confirms whether a pause is a finished turn. It analyzes raw audio (prosody, pace, intonation), not a transcript, and covers 23 languages. The int8 ONNX build is about 11 MB, and reported CPU latency is about 20 ms with four threads (**measured on an Apple M5 Pro, not 4-core x86**).
- Pipecat bundles a local Smart Turn analyzer and expects VAD `stop_secs` around 0.2.
- One self-reported third-party benchmark shows LiveKit's turn detector with fewer false cutoffs than Smart Turn v3.2. Keep the detector swappable and tune with real testing.

### TTS
- **Kokoro** (82M parameters, Apache 2.0) is the default for every tier (3.2.1 and 3.2.2). Its published 4-core x86 real-time factor is 0.5-0.67 with nothing else running, so on the minimum tier it is the riskiest default.
- **Piper** is the fastest researched CPU option, but current releases are GPLv3, so it is left out until the repo license is decided. Supertonic 3 (OpenRAIL-M use restrictions) is left out for a similar reason.

### Orchestration
- **Pipecat** is the leading candidate. A lean custom pipeline remains an option if its dependencies prove too heavy for the minimum tier.

---

## 10. Licensing and Distribution

- **Do not bundle model weights.** Download them at setup, and display each model's license.
- Qwen3 and Phi-4-mini are reported as permissive; **Gemma uses its own Terms of Use**.
- Defaults are chosen so that nothing copyleft or use-restricted is needed (Piper and Supertonic 3 are out for now). Smart Turn is BSD-2-Clause, Kokoro and Qwen3.5 are Apache 2.0, whisper.cpp and Silero are MIT, and Parakeet is CC-BY-4.0.
- Provide one-command setup and prebuilt environments for CPU and CUDA profiles. Add an open GPU path later (Vulkan/ROCm/Metal through llama.cpp and ONNX Runtime) **[unverified]**.

---

## 11. Testing and Benchmarks

Testing and benchmarking are first-class and live at the repository root. [`testing/`](testing/README.md) checks that each model is implemented and integrated correctly (contract and integration tests). [`benchmarking/`](benchmarking/README.md) measures how well each model does its role (effectiveness plus resource cost). Both run against any registered candidate for a slot, so model experimentation is a config change. The list below is the required coverage.

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
9. Piper licensing details (sources are inconsistent about MIT vs. GPL). Research found the original `rhasspy/piper` is MIT but archived, and the maintained successor is GPLv3. Whether it is "or later" rests on package metadata only. Per-voice licenses are not audited. Piper is not a default, so this only matters if it is added back
10. Measured free RAM and free disk on real 8 GB and 16 GB machines with a browser and a video call open (current figures are estimates)
11. Time to first token for a 2-4K-token prompt on small GPUs and CPUs, with prefix caching
12. How llama.cpp sizes the Gemma 4 KV cache (sliding-window trimming and shared KV layers), which changes Tier 3-5 estimates
13. Combined CPU budget on 4 cores (LLM, STT, TTS, VAD, turn detector together). The Tier 0 and Tier 1 floors depend on it
14. Recommended screen reader timing for real-time UI changes (announcement delays, guard silences, live-region politeness). First research is in `docs/research/screen-reader-live-updates.md`; the section 4.3 values still need manual screen reader passes to confirm
15. Which screen reader and browser pairs the project commits to test (research proposes NVDA and JAWS with Chrome, NVDA with Firefox, VoiceOver with Safari), and current `ariaNotify()` support (sources conflict)
16. How to reconcile the natural and accessible timing profiles (4.4)
17. ~~Whether captions need their own in-progress indicator~~ **Resolved 2026-10-06:** no. The Talking cue (section 4) already shows that the interviewer is still speaking, so captions carry no separate highlight or chase icon

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
- Latency perception research (turn-taking gaps, video-call delay, web UI thresholds, cue timing): `docs/research/latency-perception.md`
