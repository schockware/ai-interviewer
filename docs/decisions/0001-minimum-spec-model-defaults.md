*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# 0001: Model defaults by minimum spec and dev machine

Answers SPEC §3.2, §3.2.1 and §3.2.2. Status: **provisional**, pending `benchmark` on 4-core x86. Evidence is in `docs/research/llm-size-ladders.md` and `docs/research/speech-stack-footprints.md`.

## Rule

A model stays in §3.2 only if it fits the Tier 1 minimum from SPEC §8: 4 CPU cores, about 6 GB free RAM, about 2 GB for the speech stack and about 3.5 GB for the LLM. Models that need more are removed from §3.2 and may return as higher-tier choices. A second filter removes any model with a license question that could affect the repo's license or the app's users (decided 2026-10-02).

## Removed from §3.2 and why

| Model | Reason |
|---|---|
| Parakeet TDT 0.6B v3 (as default) | Peak RAM 1.5 GB on short clips to 5.5 GiB on long audio, which uses most or all of the speech reserve. Not natively streaming. Kept as the dev-machine STT (§3.2.2) |
| Nemotron streaming | GPU tier. No CPU benchmark, and a 600M encoder is unlikely to be real-time on 4 cores |
| faster-whisper small and larger, whisper.cpp medium and large | 1.5 GB (small int8) to 3.9 GB (large) RAM. Only tiny and base fit |
| LiveKit turn detector (v1, v1-mini, text) | Custom license, a request quota with cloud fallback for self-hosted use, undisclosed size, and the text model needs about 500 MB. Poor fit for a fully offline default |
| Piper | License filter: current releases are GPLv3 (the MIT original is archived) |
| Supertonic 3 | License filter: OpenRAIL-M use restrictions |
| Moonshine v2 | License filter: the v2 paper and the repo word the weights license differently, and legacy non-English models are non-commercial. No published RAM or x86 latency either |
| Pocket TTS | RTF 0.71 on 4 Xeon cores, only 1.4x real time |
| Kitten TTS | 10.5 s first token in the one benchmark that measured it. (Inflect-Nano stays as a Tier 0 option despite its "buzzy" quality) |
| Phi-4-mini, Gemma 4 E2B as Tier 1 examples | Predicted 4.1 and 3.7 GB, above the 3.5 GB budget. Moved to Tier 2 |

## Chosen

- **Minimum (§3.2.1):** Silero + Smart Turn v3.2 int8, whisper.cpp base, Qwen3.5 4B Q4_K_M, Kokoro. Tier 0 steps down to whisper.cpp tiny and Qwen3.5 2B, with Inflect-Nano as a lower-cost TTS option.
- **Dev machine (§3.2.2, i9-14900KF, RTX 5080 16 GB, 64 GB DDR5-6000):** same listening stack, Parakeet v3 int8 on CPU, Qwen3.5 9B Q8_0 on GPU, Kokoro on CPU. Chosen for predictable latency by giving the LLM the GPU alone. Gemma 4 12B Q6_K is an optional larger model. Larger models help behavioral consistency at best, not latency, and need a hardware disclaimer.

## Risks and open items

1. **Kokoro is the riskiest minimum default.** Its published 4-core x86 RTF is 0.5-0.67 alone, and its peak memory is reported at 0.4-2.0 GB. If it cannot stay ahead of real time on Tier 0 or Tier 1, those tiers fall back to spoken input with text and caption output.
2. **whisper.cpp base is not streaming,** so transcript latency after the turn ends is unmeasured on 4 cores.
3. **No 4-core benchmark exists for the combined stack** (SPEC §12 items 2 and 13). Tier 1 may need to step down to the Tier 0 models.
4. **Dev-machine consistency is a hypothesis.** Compare p50 and p95 turn latency with TTS on CPU against TTS on GPU, and Qwen3.5 9B against Gemma 4 12B.
5. **Native OS speech synthesis** was not researched. It has no model license or memory cost and could be a Tier 0 TTS fallback.
