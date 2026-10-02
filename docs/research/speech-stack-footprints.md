*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Speech stack footprints (STT, TTS, VAD / turn detection)

Research date and source access date: 2026-10-02. Input to the hardware fit calculator (SPEC sections 3.2, 8, 9, 12).

Conventions: **[unverified]** marks a figure from a single secondary source, a figure I could not confirm against a primary page, or my own estimate. "File" is size on disk. "Resident" is measured or reported RAM/VRAM at runtime. Where sources disagree the conflict is stated, not resolved.

## Summary

- **Resident memory is rarely published.** Most model cards give file size or parameter count only. Measured peak RAM exists for faster-whisper, whisper.cpp (doc table), Parakeet ONNX, and Piper/Kokoro/Pocket TTS (one Picovoice benchmark). Everything else is [unverified] or estimated.
- **No Smart Turn, Silero, Moonshine or Nemotron benchmark on a 4-core x86 CPU was found.** The only 4-core x86 numbers found are for Kokoro (EPYC 7763 and Xeon 8272CL, 4 cores). SPEC section 12 item 2 stays open for Smart Turn and for the combined LLM+speech stack.
- **Piper licensing (SPEC section 12 item 9) is resolved from primary sources.** `rhasspy/piper` is MIT but archived 2025-10-06 (read-only, last push 2025-08-26). Active development is `OHF-Voice/piper1-gpl`, whose v1.3.0 (2025-07-10) release notes say "Change license to GPLv3". Its `setup.py` and PyPI metadata say `GPL-3.0-or-later`; GitHub's license detector and the `COPYING` file say GPLv3. So the SPEC wording "GPL-3.0-or-later" matches the package metadata. See the Piper section.
- **Kokoro on 4 x86 cores is borderline real-time.** RTF 0.51 to 0.67 on two different 4-core cloud CPUs (sources conflict even for the same CPU), so it is faster than real time but consumes most of a 4-core budget while an LLM also runs.
- **Newer options exist beyond SPEC.md:** Nemotron 3.5 ASR Streaming (2026-06-04, 40 locales), Moonshine v2 streaming (tiny/small/medium), Parakeet v3 ONNX int8, Pocket TTS (MIT, 100M), Supertonic 3 (99M, 31 languages, OpenRAIL-M), Kitten TTS, LiveKit audio turn detector v1/v1-mini, Silero VAD v6.2.
- **Combined speech-stack totals** (resident, excluding LLM): minimal about 0.7 to 3.2 GB RAM, mid about 3.7 to 7.7 GB RAM, high about 5 to 8 GB VRAM. Ranges are wide because the sources conflict. See "Combined stack totals".

## STT

### Whisper family (OpenAI; MIT code and weights)

Parameters and the generic VRAM column come from the OpenAI repo table. whisper.cpp disk/RAM come from its README table (fp16 ggml; "RAM" is the doc's figure, not a fresh measurement). Languages: multilingual (about 99), plus English-only `.en` for tiny to medium. Streaming: not native; chunked pseudo-streaming only, in either runtime.

| Variant | Params | whisper.cpp disk / RAM | OpenAI VRAM (fp16, generic) | Other measured data |
|---|---|---|---|---|
| tiny | 39M | 75 MiB / ~273 MB | ~1 GB | none found |
| base | 74M | 142 MiB / ~388 MB | ~1 GB | none found |
| small | 244M | 466 MiB / ~852 MB | ~2 GB | faster-whisper on i7-12700K (8 threads), beam 5: fp32 2257 MB RSS; int8 1477 MB; whisper.cpp fp32 1049 MB. Times for the same clip: whisper.cpp 2m05s, faster-whisper fp32 2m37s, int8 1m42s |
| medium | 769M | 1.5 GiB / ~2.1 GB | ~5 GB | none found |
| large (v3) | 1550M | 2.9 GiB / ~3.9 GB | ~10 GB | faster-whisper large-v2 on RTX 3070 Ti: fp16 4525 MB VRAM, int8 2926 MB. Large-v3 int8 peak VRAM 1.7 to 2.5 GB **[unverified]** (secondary roundup) |
| large-v3-turbo | 809M | not in the README table I fetched | ~6 GB | faster-whisper issue #1030 as relayed by a secondary blog: fp16 2537 MB, int8 1545 MB peak, 19.2 to 19.6 s on the benchmark clip (GPU not named in the relay) **[unverified]** |

Notes:
- **Quantizations:** faster-whisper (CTranslate2) supports fp16, int8, int8_float16. whisper.cpp supports ggml integer quantization (Q5_0 documented; Q8_0/Q5_1/Q4_x also exist, sizes not verified here **[unverified]**).
- **Backends:** faster-whisper: CPU (x86, ARM) and CUDA. whisper.cpp: CPU (AVX, OpenBLAS), CUDA, Vulkan, ROCm/HIP, Metal, Core ML, OpenVINO, several NPUs. There is no ONNX build in the primary sources I read.
- **Speed (CPU):** "INT8 8 to 12x real-time on CPU" is a secondary claim with no named CPU **[unverified]**. The i7-12700K row above is the only primary figure: small, whole-clip, int8 about 1.5x faster than fp32.
- **Conflict:** the OpenAI table says large needs ~10 GB VRAM while faster-whisper measures 4.5 GB (fp16) and 2.9 GB (int8) for large-v2. The OpenAI figure is for the reference PyTorch implementation; use the runtime-specific figure.
- **Conflict:** int8 "reliably halves VRAM but does not reliably speed up" (Runpod roundup, secondary) versus the faster-whisper README where int8 is faster on CPU. Different hardware; both can be true.

### Parakeet TDT (NVIDIA; NeMo transducer, offline/batch, not natively streaming)

| Variant | Params | File | Resident / speed | Languages | License |
|---|---|---|---|---|---|
| parakeet-tdt-0.6b-v3 (NeMo, fp32) | 600M | ~2 GB safetensors | HF card: "min 2 GB RAM to load"; RTFx 3332 (GPU, batched leaderboard) ; GPUs listed: A10, A100, T4, V100, L4, H100... | 25 European languages (incl. EN, ES, FR, DE, RU, UK) | CC-BY-4.0 |
| v3 ONNX int8 (community, weights-only) | 600M | 741 MB (encoder 669 + decoder 73) | Ryzen AI 9 HX 370, single job: **peak 5.50 GiB** (fp32 ONNX 7.07 GiB), 11.7x real time over 5472 s of meeting audio | same | CC-BY-4.0 (base) |
| v3 ONNX int8 dynamic/static QDQ (community) | 600M | ~652 MB encoder + 18 MB decoder | AMD EPYC 9V74, 8 logical CPUs: RTFx 26 to 54 (RTF 0.038 to 0.018) | same | CC-BY-4.0 (base) |
| v3 int8 via FastAPI wrapper (community) | 600M | n/a | "peak RAM about 1.5 GB on short/medium clips", RTF 0.054 (LibriSpeech); i7-12700K ~29.7x with int8 ORT (RTF 0.033) **[unverified]** (secondary, repo README relayed through search) | same | CC-BY-4.0 (base) |

Other Parakeet sizes (parakeet-tdt-1.1b, tdt_ctc-110m, v2 English 0.6B) were not researched in detail. Treat as **[unverified]** if needed; the 110M variant is the plausible low-tier option and should be checked before the calculator lists it.

**Conflict (important for the calculator):** peak RAM for the v3 int8 ONNX is 1.5 GB (short clips, secondary) versus 5.5 GiB (long audio, primary model card). The authors of the EPYC study note that "multi-minute files can OOM as encoder activations scale with T" and recommend 30 s windows with 2 s overlap. For an interview with utterances of seconds to a minute, plan 1.5 to 3 GB and cap segment length; use 5.5 GiB only as the unchunked worst case.

Streaming: not native. Streaming use is via chunking or via the separate Nemotron streaming models below. Backends: CUDA (NeMo/Triton), ONNX Runtime CPU (community exports), sherpa-onnx style runtimes **[unverified]**.

### Nemotron streaming (NVIDIA; cache-aware FastConformer-RNNT, native streaming)

| Variant | Params | Released | Chunks (algorithmic latency) | Resident / speed | Languages | License |
|---|---|---|---|---|---|---|
| nemotron-speech-streaming-en-0.6b | 600M | 2026-01-05, updated checkpoint 2026-03-13 | 80, 160, 560, 1120 ms | memory not stated on card; a secondary roundup says ~2.25 GB footprint **[unverified]**; tested on V100/A100/A6000/DGX Spark; avg WER 6.93% at 1.12 s chunks | English | NVIDIA Open Model License |
| nemotron-3.5-asr-streaming-multilingual-0.6b | 600M | 2026-06-04 | 80, 160, 320, 560, 1120 ms; 80 ms chunk + 80 ms lookahead = 160 ms algorithmic latency **[unverified]** (secondary) | VRAM not stated; ~240 concurrent streams on one H100 at 80 ms vs 14 for Parakeet RNNT 1.1B; ONNX not stated; community C++ runtime "NeMo-Speech.cpp" with GGUF quantization | 40 locales (19 transcription-ready, 13 broad, 8 adaptation-ready); English WER 7.91% (FLEURS) | OpenMDW-1.1 |

No CPU benchmark found for either; a 24-layer 1024-dim 600M encoder will not be real-time-friendly on 4 cores **[engineering reasoning, unverified]**. Treat as GPU-tier STT.

### Moonshine (Useful Sensors / Moonshine AI)

| Variant | Params | File | Latency / speed | Streaming | Languages | License |
|---|---|---|---|---|---|---|
| Moonshine v1 tiny | 27M | "27MB" **[unverified]** (secondary roundup) | not measured here | no (chunked offline) | English | MIT |
| Moonshine v1 base | 61M | not found | not measured here | no | English (card hints at more) | MIT |
| Moonshine v2 tiny (streaming) | 33.57M | not found | Apple M3: 50 ms response latency, 8.03% compute load; 5.8x lower latency than Whisper Tiny (289 ms) | yes, sliding-window encoder, ~80 ms lookahead | English; avg WER 12.01% | paper says permissive/"Creative Commons"; repo says MIT by default |
| Moonshine v2 small | 123.36M | not found | Apple M3: 148 ms, 17.97% load; avg WER 7.84% | yes | English | as above |
| Moonshine v2 medium | 244.93M | not found | Apple M3: 258 ms, 28.95% load; avg WER 6.65% (paper claims 43.7x lower latency than Whisper Large v3) | yes | English | as above |
| Moonshine Voice runtime (current repo) | "tiny 1 MB" micro models up to large | n/a | no x86 or Pi numbers on the pages I could read | yes | STT: English, Spanish, Mandarin, Japanese, Korean, Vietnamese, Ukrainian, Arabic | MIT by default; **legacy non-streaming non-English models are under the non-commercial Moonshine Community License** |

Backends: ONNX Runtime/own runtime across Python, WASM, iOS, Android, Linux, Windows, Raspberry Pi. No CUDA path documented in what I read.

**Gap:** no resident RAM and no x86 latency for any Moonshine variant. The Apple M3 figures are not a 4-core x86 benchmark. **Licensing nuance:** the v2 paper wording and the repo's MIT statement differ (see conflicts); confirm per-model license before bundling.

### Other notable streaming STT

- Vosk: runs on a Raspberry Pi, 20+ languages, streams, markedly lower accuracy. Secondary only **[unverified]**; no figures collected.
- A 2026 arXiv paper on compact on-device streaming English ASR (arXiv 2604.14493) and X2-Turn (arXiv 2608.10878, joint streaming ASR + turn state) appeared in search results; not evaluated here.

## TTS

### Kokoro (hexgrad; Apache-2.0; 82M params)

v1.0 released 2025-01-27, 8 languages, 54 voices (HF card). Backends: PyTorch (CPU, CUDA), ONNX (CPU, CUDA; community `kokoro-onnx`). Streaming: sentence-level chunked generation; not token-streaming.

| Measure | Value | Hardware | Source type |
|---|---|---|---|
| RTF (lower is faster), ONNX CPU | mean 0.509 | AMD EPYC 7763, **4 cores**, 15.6 GB RAM | heyneo/gauravvij benchmark |
| RTF, ONNX CPU | mean 0.571 (earlier post) and 0.641 to 0.665 (July 2026 post) | Intel Xeon Platinum 8272CL, **4 cores**, 15.6 GB RAM | heyneo benchmark |
| Throughput, PyTorch and ONNX CPU | 5x real time (RTF 0.2), backends equal | AWS c6a.8xlarge, EPYC 7R32, 32 vCPUs | efemaer gist |
| Throughput, GPU | PyTorch CUDA 36x (T4), 96x (A10G), 81x (L4); ONNX CUDA 20x, 32x, 37x | g4dn/g5/g6.xlarge | efemaer gist |
| RTF, CPU | ~0.16 | Apple M3 Pro | VisionStory, secondary **[unverified]** |
| RTF, CPU | 0.869 (slower than real time at 2 threads) | ARM Neoverse-N1, 2 cores | obole-ia benchmark |
| Peak memory | 2.0 GB; model file 341 MB; first-token time 3658 ms | AMD Ryzen 7 5700X (8 cores, threads used not stated) | Picovoice benchmark (vendor with a competing product; treat with care) |
| Weights/VRAM | "under 1 GB VRAM weights, 2 to 3 GB total on GPU with CUDA buffers" **[unverified]**; ONNX int8 about 80 MB **[unverified]** | n/a | secondary roundup |

**Conflicts:** (1) same Xeon 8272CL 4-core reports RTF 0.571 in one post and 0.641 to 0.665 in the newer one; (2) 4-core x86 cloud RTF 0.5 to 0.67 versus 5x (RTF 0.2) on a 32-vCPU instance, so scaling with cores matters and a 4-core machine shared with an LLM may be near 1.0; (3) Picovoice's 2.0 GB peak versus the ~80 MB / 341 MB file sizes elsewhere. These benchmarks are blog-grade, run by a company or an autonomous agent, and only the Xeon/EPYC ones are 4-core x86. All **[unverified]** beyond that.

### Piper (VITS-based, ONNX; voices from rhasspy/piper-voices)

**Licensing facts (checked against GitHub API, repo files, PyPI on 2026-10-02):**

| Fact | Value |
|---|---|
| `rhasspy/piper` | license MIT (GitHub `spdx_id: MIT`); created 2023-01-10; last push 2025-08-26; **archived 2025-10-06**, read-only; README top line: "Development has moved: https://github.com/OHF-Voice/piper1-gpl" |
| `OHF-Voice/piper1-gpl` | created 2025-03-28; GitHub detects `GPL-3.0`; `COPYING` is GPL version 3 (29 June 2007); `setup.py` has `license="GPL-3.0-or-later"` |
| License change | v1.3.0, **2025-07-10**, release notes "Change license to GPLv3" (embeds espeak-ng, which is GPL, which is the likely but unstated reason **[unverified]**) |
| PyPI `piper-tts` | version 1.8.0, `license: GPL-3.0-or-later` |
| Releases | v1.3.0 2025-07-10; v1.4.0 2026-01-30; v1.4.1 2026-02-05; v1.4.2 2026-04-02; v1.5.0 2026-07-17; v1.6.0 2026-07-23; v1.6.1 2026-08-13; v1.7.0 2026-08-15; v1.8.0 2026-09-04 (the fetch tool showed 2023/2024 years; the GitHub API gives 2025/2026, which I use) |
| Maintenance | Open Home Foundation is "looking for maintainers" (README) |
| Voices | licensed per voice (see each voice's MODEL_CARD); some are research or personal use only. Not audited here |

**Resolution of SPEC section 12 item 9:** both statements are true for different repos and dates. The pre-fork project was MIT; every release from the new repo (v1.3.0 onward) is GPL. The exact SPDX identifier is "-or-later" in package metadata but plain GPL-3.0 in GitHub's detection and the full-text `COPYING` file, so the repo itself does not state a "later versions" grant in the license text; use the package metadata unless a maintainer clarifies. **Implication:** bundling or linking new Piper in the app obliges GPL-compatible distribution; the MIT archive (last release before the move) remains usable under MIT but is unmaintained. Also, the old MIT `piper` binaries still embed espeak-ng (GPL) so the MIT label alone was never a clean bill **[engineering note, unverified; check before relying on it]**.

| Measure | Value | Hardware | Source |
|---|---|---|---|
| RTF | 0.12 (siwis-medium), 0.22 (tom-medium) at 2 threads | ARM Neoverse-N1, 2 cores | obole-ia benchmark |
| RTF | ~0.19 to 0.2 | CPU not named | Picovoice/secondary **[unverified]** |
| Peak memory / file / first-token | 2.6 GB / 61 MB / 1720 ms | Ryzen 7 5700X | Picovoice benchmark |
| Memory | "under 100 MB RAM" | n/a | secondary roundups **[unverified]** |

**Conflict:** peak memory 2.6 GB (Picovoice) versus "under 100 MB" (roundups). The Picovoice figure may include runtime/phonemizer overhead or a large-text run; I could not reconcile it. Piper streaming: sentence-level. Backends: ONNX Runtime CPU (primary), CUDA via ORT. Languages: about 30 locales (VOICES.md). No 4-core x86 benchmark found.

### Newer lightweight local TTS

| Model | Params | Size | Speed / memory | Languages | Streaming | License |
|---|---|---|---|---|---|---|
| Pocket TTS (Kyutai) | 100M | ~242 MB (Picovoice) / ~300 MB (secondary) | README: ~6x real time on MacBook Air M4 using 2 cores, ~200 ms to first chunk. Xeon 8272CL 4 cores: RTF 0.714 (flat in text length), i.e. only 1.4x real time. Picovoice: 610 MB peak, 1713 ms first token | EN, FR, DE, PT, IT, ES, NL (+ community) | yes (streaming architecture) | MIT |
| Supertonic 3 (Supertone) | ~99M | 404 MB ONNX assets **[unverified]** | Xeon 4 cores: RTF 0.12 to 0.24 (quality drops at 2 steps, UTMOS 1.53; 5 steps 4.32). RAM not measured | 31 | not stated | OpenRAIL-M (use restrictions apply) |
| Inflect-Nano-v1 | 4.6M | n/a | Xeon 4 cores: RTF 0.145; quality 3.48 UTMOS ("buzzy") | not stated | not stated | Apache-2.0 |
| Kitten TTS Nano 0.8 | ~15M | ~25 to 42 MB | Picovoice: 320 MB peak, 10.5 s first-token (slow); other roundups claim fast **[unverified]** | EN | no | Apache-2.0 **[unverified]** |
| Picovoice Orca | n/a | 7 MB | 41 MB peak, 106 ms first token | n/a | yes | proprietary (not open source; listed for scale only) |

**Conflict:** Pocket TTS "6x real time" (vendor README, M4) versus RTF 0.714 on 4 Xeon cores (third party). Different CPUs; the README figure is not a 4-core x86 number.

## VAD and turn detection

| Model | Params | File | Resident / latency | Languages | Streaming | License | Backends |
|---|---|---|---|---|---|---|---|
| Silero VAD v6.2 (v6.0 2025-08-26, v6.2 2025-12-10) | 309K | ~1.2 MB (soniqo), JIT ~2 MB (README), ONNX 2 MB (v6 per roundup); differences are format-dependent | <1 ms per 30+ ms chunk on one CPU thread (README). RAM not measured here **[unverified]** | trained on 6000+ languages | yes, 32 ms chunks at 16 kHz (8 kHz also) | MIT | PyTorch, ONNX CPU/GPU |
| Smart Turn v3.2 (Pipecat) | 8M (Whisper-Tiny encoder + attention-pooled head) | int8 ONNX 8 MB (README) or 11.1 MB (soniqo); fp32 32 or 33 MB | ONNX int8: 36 ms at 2 threads, 20 ms at 4 threads, **on Apple M5 Pro (not x86)** per SPEC; 12 ms CPU claim in v3 blog; <100 ms on most cloud instances; ~65 ms on a Pipecat Cloud 1x instance; CoreML 3.5 ms per 8 s window. RAM not measured **[unverified]** | 23 (listed in README) | analyzes up to 8 s audio window at pauses | BSD-2-Clause | ONNX CPU (int8), ONNX GPU (fp32), CoreML |
| LiveKit audio turn detector v1 | not disclosed | not disclosed | EOT-bench via LiveKit: 9.9% false cutoffs at 300 ms, 543 ms latency at 5% cutoff rate. If no answer in about 1 s, turn is committed anyway. Cloud-quota/fallback behavior applies to self-hosted agents (see below) | 14 | per turn | not specified for v1 | LiveKit Cloud primarily |
| LiveKit audio turn detector v1-mini | not disclosed | not disclosed | 27.8% false cutoffs at 300 ms, 1070 ms latency at 5%; "optimized for fast CPU inference", bundled with Agents SDKs (Python 1.6.1, TS 1.4.7); use compute-optimized instances such as c6i/c7i | 14 | per turn | "LiveKit Model License" | CPU |
| LiveKit text turn detector (deprecated) | based on Qwen2.5-0.5B-Instruct | 396 MB | <500 MB RAM, ~50 to 160 ms per turn | 14 | per turn | LiveKit Model License | CPU |

Notes and conflicts:
- **Smart Turn file size:** 8 MB (README/HF) versus 11.1 MB (soniqo guide). Likely different measurement (MB versus MiB, or a different v3.x build). Not reconciled. SPEC currently says "about 11 MB".
- **Smart Turn latency:** only the SPEC's Apple M5 Pro number (and the soniqo page quoting it) names hardware; the "12 ms" and "<100 ms" claims name none. SPEC section 12 item 2 remains open.
- **LiveKit comparison:** the SPEC notes a self-reported benchmark where LiveKit has fewer false cutoffs than Smart Turn; that benchmark is LiveKit's own (eot-bench). I did not verify Smart Turn's score on it.
- **LiveKit licensing/cloud:** the LiveKit models carry a custom license and the v1.0 FAQ ties self-hosted use to a monthly request quota with automatic fallback to v1-mini. That makes it a poor fit for a fully offline "local-first" default **[read of a community FAQ; verify before relying]**.

## Combined stack totals

Resident memory, excluding the LLM and OS. Built from the cheapest and the most pessimistic published figure per component; "est." means my estimate where no figure exists (all **[unverified]**). The 4-core x86 CPU budget is a separate issue: Kokoro alone used about 50 to 67% of real time on 4 cores, so the mid configuration on CPU leaves little for an LLM.

| Config | Target | VAD | Turn | STT | TTS | Total (low to high) |
|---|---|---|---|---|---|---|
| **Minimal** (CPU, 4 cores, 8 GB RAM total) | Silero v6 | Silero ~0.05 GB est. | Smart Turn v3.2 int8 ~0.1 to 0.2 GB est. | whisper.cpp base 0.39 GB (README) or Moonshine v2 tiny (RAM unknown); Whisper small int8 via faster-whisper 1.48 GB as a quality step | Piper medium: 0.1 GB (roundups) to 2.6 GB (Picovoice) | about **0.7 to 3.2 GB** with base; add about 1.1 GB if Whisper small int8 replaces base |
| **Mid** (CPU 8+ cores, 16 GB RAM, or 8 GB GPU) | Silero v6 | ~0.05 GB | Smart Turn int8 ~0.15 GB | Parakeet v3 ONNX int8: 1.5 GB (short clips) to 5.5 GiB (unchunked long audio) | Kokoro: ~0.4 GB (file) to 2.0 GB (Picovoice peak) | about **3.7 to 7.7 GB** |
| **High** (GPU, 12 to 16+ GB VRAM) | Silero (CPU, negligible) | ~0.05 GB (CPU) | Smart Turn fp32 on GPU ~0.03 GB file (plus runtime, est. ~0.3 GB) | Nemotron 3.5 streaming ~2.25 GB **[unverified]**; or Parakeet v3 about 2 GB min; or Whisper large-v3 int8 1.7 to 2.5 GB, turbo int8 ~1.5 GB | Kokoro on GPU: <1 GB weights, 2 to 3 GB with CUDA buffers | about **5 to 8 GB VRAM** (roughly 2.25 + 3 + 0.3 to 2.5 + 3 + buffers); keep about 2 GB headroom for the LLM context, as SPEC 8.1 suggests |

Calculator guidance:
1. Reserve **speech stack memory first, then fit the LLM** in what remains. Use the high figure of each range by default and let `benchmark` measure actuals (SPEC section 8).
2. On CPU tiers, model CPU time as well as RAM. The measured 4-core x86 data (Kokoro RTF 0.5 to 0.67) means TTS and STT cannot be treated as free beside a 3-4B LLM.
3. For STT slots, list by tier: tiny/base Whisper or Moonshine v2 (minimum), Parakeet v3 int8 (mid; cap utterance length), Nemotron streaming or Whisper large-v3/turbo (high, NVIDIA GPU). For TTS: Piper (minimum; GPL consequences), Kokoro (default), Pocket TTS or Supertonic 3 as alternates.

## Gaps and open items

- No measured resident RAM for Moonshine, Smart Turn, Silero, Nemotron, Pocket TTS (except Picovoice), Supertonic.
- No 4-core x86 benchmark for any STT, Smart Turn, or Piper. SPEC section 12 item 2 remains open; the only close data is Kokoro on 4-core EPYC/Xeon cloud instances.
- Parakeet 110M/1.1B and Whisper quantized (ggml Q4/Q5/Q8) sizes not collected.
- Several benchmark sources are vendor-run or autonomously produced (Picovoice, heyneo, obole-ia); Picovoice sells a competing TTS engine.
- Piper voice-level licenses (MODEL_CARD per voice) not audited.
- Whether a "-or-later" grant is intended for Piper beyond the package metadata is not stated in the license text.

## Sources

Accessed 2026-10-02 (GitHub API results retrieved the same day).

- https://github.com/OHF-Voice/piper1-gpl (README, COPYING, setup.py, releases) and GitHub REST API `repos/OHF-Voice/piper1-gpl`, `releases`, `repos/rhasspy/piper`
- https://github.com/rhasspy/piper (archive notice 2025-10-06)
- https://pypi.org/pypi/piper-tts/json (license metadata, v1.8.0)
- https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md
- https://github.com/openai/whisper (model table)
- https://github.com/ggml-org/whisper.cpp (README: disk/RAM table, backends)
- https://github.com/SYSTRAN/faster-whisper (i7-12700K and RTX 3070 Ti benchmark tables)
- https://github.com/SYSTRAN/faster-whisper/issues/1030 and https://tesseraai.cloud/en/blog/whisper-large-v3-turbo-vs-large-v3-cpu-eu/ (turbo memory, secondary)
- https://www.runpod.io/articles/guides/best-gpu-for-whisper (secondary)
- https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- https://huggingface.co/ekhodzitsky/parakeet-tdt-0.6b-v3-onnx-weights-only-int8
- https://heyneo.com/blog/parakeet-cpu-optimization-case-study
- https://github.com/mil-ad/parakeet-tdt-0.6b-v3-fastapi-openai and https://deepwiki.com/groxaxo/parakeet-tdt-0.6b-v3-fastapi-openai/1.3-performance-benchmarks (secondary)
- https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b
- https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b
- https://openwhispr.com/blog/parakeet-vs-whisper-vs-nemotron and https://openvoxai.com/blog/best-local-stt-transcription-models-2026 (secondary)
- https://arxiv.org/html/2602.12241v1 (Moonshine v2)
- https://github.com/moonshine-ai/moonshine and https://huggingface.co/UsefulSensors/moonshine
- https://moonshine-voice.readthedocs.io/en/latest/
- https://huggingface.co/hexgrad/Kokoro-82M
- https://gist.github.com/efemaer/23d9a3b949b751dde315192b4dcf0653 (Kokoro CPU/GPU)
- https://heyneo.com/blog/kokoro-supertonic-inflect-nano-pocket-tts-cpu-benchmark (Xeon 8272CL, 4 cores)
- https://heyneo.com/blog/kokoro-tts-vs-supertonic-3-tts and https://github.com/gauravvij/kokoro-tts-vs-supertonic-3-tts (EPYC 7763, 4 cores; via search summary)
- https://github.com/obole-ia/tts-cpu-benchmark (ARM 2-core Piper/Kokoro)
- https://picovoice.ai/blog/on-device-tts/ (peak memory, vendor)
- https://github.com/kyutai-labs/pocket-tts
- https://supertonic3.github.io/ and https://betterstack.com/community/guides/ai/supertonic-3/ (secondary)
- https://medium.com/@mealermed/kittentts-nano-a-tiny-ai-text-to-speech-model-that-runs-on-cpu-without-gpu-c00ef8b2e7aa (secondary)
- https://github.com/snakers4/silero-vad and https://github.com/snakers4/silero-vad/releases, https://soniqo.audio/guides/vad
- https://github.com/pipecat-ai/smart-turn, https://huggingface.co/pipecat-ai/smart-turn-v3, https://soniqo.audio/guides/turn
- https://docs.livekit.io/agents/logic/turns/turn-detector/
- https://community.livekit.io/t/solving-end-of-turn-detection-livekit-turn-detector-v1-0/1453
- https://livekit.com/benchmarks/eot-bench and https://github.com/livekit/eot-bench (not fetched; figures from search summary, **[unverified]**)
- F:\projects\ai-interviewer\SPEC.md (sections 3.2, 8, 9, 12)
