*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Hardware fit and model sizing

Starting point for SPEC §12 (Open Questions), mainly items 1, 2 and 6, and it feeds §8 (Hardware Tiers). Status: **discussion, nothing decided**.

## Steven's preliminary findings

- GPU use is limited mostly by **VRAM**, not compute. Whether a model fits decides whether the GPU path works at all.
- So any model we adopt needs **multiple sizes or quantization modes**, so that setup (or the user) can pick the best fit for the hardware.
- CPU models have **RAM requirements** too, from which we can derive **minimum system specs**.

## What this implies for the spec

1. **Model selection becomes a first-class concern.** "One default model per slot" (§3.2) becomes "one default *family* per slot, with a ladder of variants".
2. **A candidate only counts if it has a ladder.** A slot-filler with a single size (Kokoro, 82M) is fine when it is tiny. A large model with only one size is a risk.
3. **Setup needs a hardware probe and a fit calculator.** The probe reads free VRAM, free RAM, core count and GPU backend. The calculator picks the largest variant that fits with headroom. The user can override it.
4. **Tiers (§8) are the output of the fit calculator, not a hand-written table.** The hand-written table is a starting estimate until the calculator is validated.

## Memory budget (to be validated)

For each slot, the footprint is roughly:

- **Weights** ≈ parameters × bits-per-weight / 8. Q4_K_M is about 4.5-5 bits in practice, so 8B ≈ 5 GB. This matches §8's reported figures.
- **KV cache** ≈ 2 × layers × KV heads × head dim × context length × bytes per element. This grows with context, and the resume and job description are static context for the whole session. It can matter as much as the weights on small cards.
- **Runtime overhead**: CUDA context, activations and scratch buffers. This is hundreds of MB and varies by runtime.
- **Other slots share the same memory**: STT, TTS, VAD and turn detector (§8.1 already says to leave ~2 GB VRAM headroom).

Total demand = sum over all loaded slots, compared against free VRAM for GPU-resident models and free RAM for the rest. **Free** is the key word, because a browser or game can already hold several GB of VRAM.

## Candidate ladders to research

Sizes below are recalled from memory and are all **[unverified]**.

| Slot | Family | Variants to confirm |
|---|---|---|
| LLM | Qwen3 | ~0.6B up to ~32B, plus MoE variants |
| LLM | Gemma 3 | ~1B / 4B / 12B / 27B (own license terms, see §10) |
| LLM | Llama 3.2 | 1B / 3B |
| STT | Whisper family | tiny through large / turbo |
| STT | Parakeet | 0.6B and larger |
| STT | Moonshine | tiny / base |
| TTS | Kokoro | single size; check RAM on CPU |
| TTS | Piper | per-voice quality levels (licensing open, §12 item 9) |

For each variant we want: weight file size per quantization, measured resident memory (not just file size), tokens/sec or real-time factor on CPU and GPU, and license.

## Open questions for this thread

1. **Where does the fit calculator live?** Probably in `benchmark` or setup (§11, roadmap item 5). It should be usable before any model is downloaded.
2. **Estimate or measure?** The formula gives a prediction. Loading the model gives the truth. Probably do both: predict to choose, verify on first load, fall back one rung on failure.
3. **How much headroom?** §8.1 says "a couple of GB" of VRAM. That should become a rule tied to which other slots are on the GPU.
4. **Which resource is the minimum spec?** §8 says 4 cores and ~8 GB RAM. With STT, TTS, VAD and a 3-4B LLM all resident, 8 GB may be tight once the OS is counted. This links to §12 item 2.
5. **Mixed placement.** Should the LLM be on the GPU and STT/TTS on the CPU (or the reverse) when VRAM is short? That is a layer-offload question as well as a per-slot one.
6. **Non-CUDA backends** (§12 item 1) change what "free VRAM" means (integrated GPUs and Apple unified memory share system RAM).

## Proposed next steps

1. Research each ladder above and record the real variant sizes, quantizations and licenses in `docs/research/`.
2. Gather measured memory and speed data per variant, noting hardware and runtime.
3. Draft a `decisions/` record for the fit-calculator approach, then update SPEC §3.2 and §8.
