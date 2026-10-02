*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# LLM size ladders for the interviewer slot

Research input for the hardware fit calculator (SPEC §3.2 and §8, and `docs/discussions/2026-10-02-hardware-fit-and-model-sizing.md`). Researched and written 2026-10-02. Status: **research, nothing decided**.

Conventions: "GB" is decimal (10^9 bytes) as Hugging Face reports file sizes; "MiB" is 2^20 bytes as llama.cpp logs report buffers. File sizes were read from the Hugging Face tree API (primary), mostly from the Unsloth GGUF repos. Layer, KV-head and head-dim numbers were read from each model's `config.json` (primary). Anything that rests on one secondary source, or that I could not verify, is marked **[unverified]**. Conflicts are called out in their own section instead of being resolved silently.

## Summary

1. **The landscape has moved well past SPEC.md's names.** Current open-weight generations as of 2026-10-02: **Qwen3.5** (Feb-Mar 2026: 0.8B, 2B, 4B, 9B, 27B, 35B-A3B), **Qwen3.6** (Apr 2026: 27B, 35B-A3B), **Qwen3.8** (Aug 2026: 27B dense on HF; Qwen3.7 was never released as open weights, per one secondary source), **Gemma 4** (2026: E2B, E4B, 12B, 26B-A4B, 31B, all Apache-2.0), plus Ministral 3 (3B/8B/14B), Granite 4.1 (3B/8B), LFM2, and gpt-oss-20b. Llama 3.2 1B/3B, Phi-4-mini and SmolLM3 are still the latest in their lines that I could find (no successor found **[unverified]**), and are now a generation behind in quality.
2. **Licensing got easier.** Qwen, Gemma 4, Phi-4, SmolLM3, Ministral 3, Granite 4.1 and gpt-oss are Apache-2.0 or MIT and ungated, so setup can download them anonymously. Gemma 3 and Llama 3.2 are gated behind click-through licenses on the official repos (community GGUF mirrors exist, but the license terms still apply). LFM2 uses a custom license.
3. **KV-cache cost now varies by 10x or more between families at the same parameter count.** Qwen3.5/3.6/3.8 are hybrid (3 of every 4 layers are linear attention with a small fixed-size state), so only 1/4 of layers carry a KV cache: Qwen3.5-9B costs 32 KiB per token (256 MiB at 8K) versus 144 KiB per token (1,152 MiB) for Qwen3-8B. Gemma 3/4 use sliding-window layers (5 of 6 layers) that cap their cache at 512-1024 tokens. The fit calculator needs per-model layer types, not one uniform formula.
4. **The formula holds.** File size = params x bits-per-weight / 8 with measured bits-per-weight of about 4.7-5.2 for Q4_K_M, about 5.7 for Q5_K_M, about 6.6 for Q6_K and about 8.5 for Q8_0, over 14 checked variants. The KV formula reproduces a real llama.cpp log (a 70B-class model, 160 MiB at 512 ctx) exactly, and the Phi-4-mini figures from a third-party table. Details below.
5. **Gaps.** Measured *resident* memory (as opposed to file size) with named hardware is thin: I found only a handful of real data points, mostly from single blog posts. Tokens/sec data with named hardware is plentiful for old models and sparse for 2026 models on small GPUs and CPUs. Interviewer-specific latency (time to first token on a 2-4K prompt) was not found anywhere. Gemma 4 KV arithmetic depends on llama.cpp internals I could not confirm (see the KV adjustments section).
6. **Gotcha for the interviewer use case.** The Unsloth cards say Qwen3.5-9B and 27B run in thinking mode by default (the 0.8B card says non-thinking by default), and Gemma 4 advertises "configurable thinking modes". A conversational interviewer needs thinking off for latency, so setup must pass the right chat-template flag.

## Method for the per-variant tables

- **Params**: from the `safetensors.total` field of the HF model API (includes vision towers where the checkpoint bundles them, and double-counts tied embeddings for some small models, marked `*`). Active params for MoE come from model cards or config (experts per token), see the notes.
- **GGUF sizes**: Unsloth repos unless stated (their "UD-" files are Unsloth Dynamic quants, which are mixed-precision and not identical to plain llama.cpp Q4_K_M; where only a UD- file exists it is used and said so). The vision projector (`mmproj`) file is excluded; it is a separate download.
- **KV f16 B/token** = 2 (K and V) x (number of layers that carry a full-context KV cache) x KV heads x head_dim x 2 bytes. Hybrid and sliding-window models use only the layers that grow with context; arithmetic is shown in the KV section.
- **Predicted resident** = Q4_K_M file + KV at 8K (f16) + 0.5 GB runtime overhead. The 0.5 GB overhead (CUDA context, compute buffers) is my assumption **[unverified]**; the llama.cpp maintainer says the CUDA runtime needs memory not shown in the buffer logs (discussion #9784). It is a prediction, not a measurement. Measured numbers are in the speed and memory section.
- **Max ctx** is the model's advertised or configured maximum. Usable context is bounded by memory, not by this number.

## Per-family tables

### Qwen3.5 / 3.6 / 3.8

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Qwen3.5-0.8B | 0.87B (incl. vision) dense | 0.53 | 0.59 | 0.64 | 0.81 | 1.52 | 262K | 12,288 | 96 | 1.1 | Apache-2.0 |
| Qwen3.5-2B | 2.27B dense | 1.28 | 1.44 | 1.57 | 2.01 | 3.78 | 262K | 12,288 | 96 | 1.9 | Apache-2.0 |
| Qwen3.5-4B | 4.66B dense | 2.74 | 3.14 | 3.53 | 4.48 | 8.42 | 262K | 32,768 | 256 | 3.5 | Apache-2.0 |
| Qwen3.5-9B | 9.65B dense | 5.68 | 6.58 | 7.46 | 9.53 | 17.90 | 262K | 32,768 | 256 | 6.4 | Apache-2.0 |
| Qwen3.5-27B / Qwen3.8-27B | 27.8B dense | 16.74 | 19.61 | 22.45 | 28.60 | 54.70 | 262K | 65,536 | 512 | 17.8 | Apache-2.0 |
| Qwen3.5-35B-A3B / Qwen3.6-35B-A3B | 35.95B total / ~3B active | 22.02 | 26.25 | 28.85 | 36.90 | 69.40 | 262K | 20,480 | 160 | 22.7 | Apache-2.0 |

### Qwen3 (previous gen)

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Qwen3-0.6B | 0.75B* dense | 0.40 | 0.44 | 0.50 | 0.64 | 1.20 | 32K (40,960 config) | 114,688 | 896 | 1.8 | Apache-2.0 |
| Qwen3-1.7B | 1.7B dense | 1.11 | 1.26 | 1.42 | 1.83 | 3.45 | 32K | 114,688 | 896 | 2.5 | Apache-2.0 |
| Qwen3-4B | 4.02B dense | 2.50 | 2.89 | 3.31 | 4.28 | 8.05 | 32K | 147,456 | 1152 | 4.2 | Apache-2.0 |
| Qwen3-8B | 8.19B dense | 5.03 | 5.85 | 6.73 | 8.71 | 16.39 | 32K | 147,456 | 1152 | 6.7 | Apache-2.0 |
| Qwen3-14B | 14.77B dense | 9.00 | 10.51 | 12.12 | 15.70 | 29.54 | 32K | 163,840 | 1280 | 10.8 | Apache-2.0 |
| Qwen3-32B | 32.76B dense | 19.76 | 23.21 | 26.88 | 34.82 | - | 32K | 262,144 | 2048 | 22.4 | Apache-2.0 |
| Qwen3-30B-A3B | 30.53B total / ~3.3B active | 18.56 | 21.73 | 25.09 | 32.48 | - | 32K | 98,304 | 768 | 19.9 | Apache-2.0 |

### Gemma 4

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gemma 4 E2B | 5.12B total (incl. per-layer embeddings) / 2.3B effective | 3.11 | 3.36 | 4.50 | 5.05 | 9.31 | 128K | see text | 54 | 3.7 | Apache-2.0 |
| Gemma 4 E4B | 8.0B total / 4.5B effective | 4.98 | 5.48 | 7.07 | 8.19 | 15.05 | 128K | see text | 148 | 5.6 | Apache-2.0 |
| Gemma 4 12B | 11.96B dense | 7.12 | 8.41 | 9.79 | 12.67 | 23.83 | 256K | see text | 384 | 8.0 | Apache-2.0 |
| Gemma 4 26B-A4B | 25.8B total (card: 25.2B) / 3.8B active | 16.95 | 21.15 | 23.17 | 26.86 | 50.50 | 256K | see text | 280 | 17.7 | Apache-2.0 |
| Gemma 4 31B | 30.7-31.3B dense | 18.32 | 21.66 | 25.20 | 32.64 | 61.40 | 256K | see text | 1120 | 20.0 | Apache-2.0 |

### Gemma 3 (previous gen)

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gemma 3 1B | 1.0B dense | 0.81 | 0.85 | 1.01 | 1.07 | 2.01 | 32K | 26,624 | 43 | 1.4 | Gemma terms (gated) |
| Gemma 3 4B | 4.3B dense | 2.49 | 2.83 | 3.19 | 4.13 | 7.77 | 128K | 139,264 | 276 | 3.3 | Gemma terms (gated) |
| Gemma 3 12B | 12.19B dense | 7.30 | 8.45 | 9.66 | 12.51 | 23.54 | 128K | 393,216 | 832 | 8.7 | Gemma terms (gated) |
| Gemma 3 27B | 27.43B dense | 16.55 | 19.27 | 22.17 | 28.71 | - | 128K | 507,904 | 1056 | 18.2 | Gemma terms (gated) |

### Llama 3.2

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Llama 3.2 1B | 1.24B dense | 0.81 | 0.91 | 1.02 | 1.32 | 2.48 | 128K | 32,768 | 256 | 1.6 | Llama 3.2 Community (gated) |
| Llama 3.2 3B | 3.21B dense | 2.02 | 2.32 | 2.64 | 3.42 | 6.43 | 128K | 114,688 | 896 | 3.5 | Llama 3.2 Community (gated) |

### Phi-4 family

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Phi-4-mini-instruct | 3.84B dense | 2.49 | 2.85 | 3.16 | 4.08 | 7.68 | 128K | 131,072 | 1024 | 4.1 | MIT |
| Phi-4 (14B) | 14.66B dense | 8.89 | 10.41 | 12.03 | 15.58 | 29.32 | 16K | 204,800 | 1600 | 11.1 | MIT |

### SmolLM3

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SmolLM3-3B | 3.08B dense | 1.92 | 2.21 | 2.53 | 3.28 | 6.16 | 64K trained, 128K w/ YaRN | 73,728 | 576 | 3.0 | Apache-2.0 |

### Other notable families

| Variant | Params (total / active) | Q4_K_M GB | Q5_K_M GB | Q6_K GB | Q8_0 GB | BF16/F16 GB | Max ctx | KV f16 B/token | KV f16 @8K MiB | Predicted resident, Q4_K_M @8K (GB) | License |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ministral 3 3B | 3.85B (incl. vision) dense | 2.15 | 2.47 | 2.82 | 3.65 | 6.87 | 256K | 106,496 | 832 | 3.5 | Apache-2.0 |
| Ministral 3 8B | 8.92B dense | 5.20 | 6.06 | 6.97 | 9.03 | 16.99 | 256K | 139,264 | 1088 | 6.8 | Apache-2.0 |
| Ministral 3 14B | 13.95B dense | 8.24 | 9.62 | 11.09 | 14.36 | 27.02 | 256K | 163,840 | 1280 | 10.1 | Apache-2.0 |
| Granite 4.1 3B | 3.40B dense | 2.10 | 2.44 | 2.80 | 3.62 | 6.81 | 128K | 81,920 | 640 | 3.3 | Apache-2.0 |
| Granite 4.1 8B | 8.79B dense | 5.35 | 6.25 | 7.22 | 9.35 | 17.59 | 128K | 163,840 | 1280 | 7.2 | Apache-2.0 |
| LFM2-2.6B | 2.57B hybrid conv+attn | 1.56 | 1.83 | 2.11 | 2.73 | 5.14 | 128K | 16,384 | 128 | 2.2 | LFM Open License v1.0 (custom) |
| gpt-oss-20b | 20.9B total / ~3.6B active | 11.62 | 11.72 | 12.04 | 12.11 | 13.79 | 128K | 24,576 | 192 | 12.3 | Apache-2.0 |
Footnotes for the tables:

- `*` Qwen3-0.6B: the HF count of 0.75B appears to double-count the tied embedding matrix (the model is marketed as 0.6B).
- **Qwen3.5 family**: all three generations share the same hybrid design (Gated DeltaNet linear-attention layers plus a full-attention layer every 4th layer; 24 layers for 0.8B/2B, 32 for 4B/9B, 64 for 27B, 40 for 35B-A3B). Qwen3.5-27B and Qwen3.8-27B have identical parameter counts and the same layer config, and the Qwen3.8-27B GGUF sizes are within 2% of Qwen3.5-27B (UD-Q4_K_M 16.46 GB, UD-Q8_0 29.05 GB), so one row covers both. Qwen3.6-35B-A3B has the same config as Qwen3.5-35B-A3B (UD-Q4_K_M 22.13 GB). Qwen3.5-35B-A3B has 256 experts with 8 routed per token (config); "~3B active" is from the model name. The small Qwen3.5 sizes are multimodal (vision encoder bundled in the repo; the GGUF text file excludes it). Qwen3.5-122B-A10B and 397B-A17B exist per one secondary source (codersera.com) **[unverified]**, are far above consumer hardware, and are omitted.
- **Qwen3 (previous gen)**: standard transformer; native 32K context (config max 40,960); 128K via YaRN is documented by Qwen from memory **[unverified here]**. Best-known ladder and a safe fallback if hybrid-attention support in a runtime is immature.
- **Gemma 4**: five sizes confirmed on HF (E2B, E4B, 12B, 26B-A4B, 31B), all Apache-2.0 and ungated. The "E" models use per-layer embedding (PLE) tables: total params include large embedding tables that can stay in host RAM, so GPU residency is far below file size (one measured case below). 26B-A4B has 128 experts, 8 routed plus 1 shared per token, 3.8B active (model card). The KV column is the SWA-aware derived figure, see the KV adjustments section; the no-trimming figure is 2.3-6x higher. The 26B-A4B quant files are Unsloth `UD-` variants (no plain Q4_K_M was listed).
- **Gemma 3 (previous gen)**: 5 local sliding-window layers per global layer; KV column is SWA-aware (full-cache figures are 208 / 1,088 / 3,072 / 3,968 MiB at 8K). Official repos are gated (manual approval); the Unsloth mirrors are not gated but redistribute under the Gemma terms (flagged in SPEC §10 already).
- **Llama 3.2**: the Llama 3.2 Community License applies, with gated access on the official repo. The 1B config was read from the Unsloth mirror because the official repo returned 401. No newer small Llama found **[unverified: I did not search exhaustively]**; Llama 4 is large MoE only.
- **Phi-4**: Phi-4-mini-instruct (Feb 2025) is the newest Phi small instruct model I could verify on HF. A Phi-4-reasoning-vision-15B updated 2026-08-31 is mentioned by one secondary source **[unverified]**. Phi-4-mini head_dim = 3072/24 = 128 (derived, not in config). Context 128K; the 14B Phi-4 is 16K only, a poor fit.
- **SmolLM3**: 3 of every 4 layers use RoPE and the 4th uses NoPE; this does not reduce KV size (all 36 layers cache), so the standard formula applies. Its 4 KV heads make its cache about half that of Phi-4-mini. Fully open weights and recipe. Only one size, so no ladder (the discussion doc treats that as a risk). No SmolLM4 found.
- **Ministral 3**: Mistral's late-2025 edge family (3B/8B/14B), Apache-2.0, 256K context per config; each HF param count includes a vision encoder. It has a real ladder.
- **Granite 4.1**: 3B and 8B confirmed on HF (April 2026, Apache-2.0); a 30B is mentioned by a secondary source **[unverified]**. The config shows a plain attention stack, head_dim derived as hidden/heads (64 for 3B, 128 for 8B).
- **LFM2-2.6B**: hybrid short-convolution plus attention (8 of 30 layers use attention, 8 KV heads, head_dim 2048/32 = 64 derived). Very small KV cache. License is the custom "lfm1.0" license; I did not read its terms **[unverified]**.
- **gpt-oss-20b**: ships natively in MXFP4, so every GGUF "quant" is about 11.6-12.1 GB. 12 of 24 layers are full attention (8 KV heads, head_dim 64), the other 12 use a 128-token window. Active parameter count (~3.6B) is from memory of OpenAI's card **[unverified]**. It is a reasoning model; short interview replies need its low reasoning-effort setting. Too large for anything below 16 GB.

## Verified formulas

### Weights: params x bits / 8

File size divided by parameters gives effective bits per weight (bpw), computed from the tables above:

| Variant | Params | Quant | File GB | Effective bpw |
|---|---|---|---|---|
| Qwen3-8B | 8.19B | Q4_K_M | 5.03 | 4.91 |
| Qwen3-8B | 8.19B | Q5_K_M | 5.85 | 5.71 |
| Qwen3-8B | 8.19B | Q6_K | 6.73 | 6.57 |
| Qwen3-8B | 8.19B | Q8_0 | 8.71 | 8.51 |
| Llama 3.2 3B | 3.21B | Q4_K_M | 2.02 | 5.03 |
| Llama 3.2 3B | 3.21B | Q8_0 | 3.42 | 8.52 |
| Phi-4 | 14.66B | Q4_K_M | 8.89 | 4.85 |
| Phi-4 | 14.66B | Q8_0 | 15.58 | 8.50 |
| Qwen3-14B | 14.77B | Q4_K_M | 9.00 | 4.87 |
| Qwen3-32B | 32.76B | Q4_K_M | 19.76 | 4.83 |
| Gemma 3 12B | 12.19B | Q4_K_M | 7.30 | 4.79 |
| Phi-4-mini | 3.84B | Q4_K_M | 2.49 | 5.19 |
| Qwen3.5-9B | 9.65B (incl. vision) | Q4_K_M | 5.68 | 4.71 |
| Qwen3.5-4B | 4.66B (incl. vision) | Q4_K_M | 2.74 | 4.70 |

Worked example, Qwen3-8B Q4_K_M: 8.19e9 x 4.5 / 8 = 4.61 GB with the "4.5 bits" rule of thumb in the discussion doc, versus 5.03 GB actual (8% under); at 5.0 bits the prediction is 5.12 GB (2% over). **Conclusion: use about 4.9 bpw for Q4_K_M (4.7-5.2 observed), 5.7 for Q5_K_M, 6.6 for Q6_K, 8.5 for Q8_0.** Small models whose embedding or output matrix is kept at higher precision run higher (Phi-4-mini 5.19, Llama 3.2 3B 5.03). Models whose HF count includes a vision tower (Qwen3.5, Ministral) read a little low because the GGUF text file excludes it. The calculator should prefer the real file size from the repo listing over the formula, because quantizer recipes differ (see conflicts).

Resident versus file size: llama.cpp memory-maps GGUF weights, and for GPU offload the buffer is the weight bytes. The one measured resident figure I found for a small model is Gemma 4 E2B Q4_0 (3.35 GB file) using only 1,598 MiB of VRAM on a 4 GB GTX 1650 Ti Max-Q, because 58% of the file is an embedding table left in host memory (dev.to post, single source **[unverified]**). So for E-series models, VRAM need is well below file size, while CPU RAM need is not.

### KV cache: 2 x layers x kv_heads x head_dim x ctx x bytes

Verified against data:

1. **llama.cpp discussion #9784, real log, a 70B-class model with 80 layers, 8 KV heads, head_dim 128** (the standard Llama 70B shape; the post does not name the checkpoint, so the shape is my assumption): predicted 2 x 80 x 8 x 128 x 512 ctx x 2 B = 167,772,160 B = **160.0 MiB**. Logged: `Metal KV buffer size = 160.00 MiB`. Exact match.
2. **Llama 3.1 8B, n_ctx 512** (a search-result snippet of an `imatrix.log`, secondary **[unverified]**): 2 x 32 x 8 x 128 x 512 x 2 = 67,108,864 B = **64 MiB**; logged `CUDA0 KV buffer size = 64.00 MiB`. Match.
3. **Phi-4-mini, third-party table** (atomic.chat / tinyweights via search, **[unverified]**): 2 x 32 x 8 x 128 x 2 B = 131,072 B/token, so 4K = 0.5 GiB, 8K = 1.0 GiB, 32K = 4.0 GiB, 128K = 16 GiB. The table quotes exactly those numbers.
4. **Hybrid model, Qwen3.8-27B on a 24 GB-class card** (computingforgeeks.com, single source **[unverified]**): 16 full-attention layers (config), 4 KV heads, head_dim 256, so 2 x 16 x 4 x 256 x 2 B = 65,536 B/token = 64 KiB. At 262,144 ctx in f16 that is 16 GiB; llama.cpp `q4_0` is 18 bytes per 32 elements (0.5625 B/elem vs 2 B for f16), so 16 GiB x 0.28125 = 4.5 GiB. The post reports 16.3 GB weights plus 262K context at q4_0 = 22.2 GB total. Predicted 16.3 + 4.8 (4.5 GiB in GB) = 21.1 GB, leaving about 1.1 GB for recurrent state, compute buffers and CUDA context. Consistent. Ollama Q4_K_M, 131K at q4_0: 17 + 2.4 = 19.4 GB predicted vs 20.9 reported, about 1.5 GB overhead.

**Correction to a formula seen in the wild:** the same discussion quotes "hidden_size x ctx x bytes x layers x 2", which assumes full multi-head attention (kv_heads x head_dim = hidden_size). For grouped-query models this overestimates by (attention heads / KV heads), 8x for Llama 70B: its worked example gives about 1.2 GiB for ctx 512, against the 160 MiB actually logged. Use KV heads x head_dim, never hidden_size.

### KV formula adjustments by architecture (what the fit calculator needs)

- **Hybrid linear attention (Qwen3.5/3.6/3.8, LFM2)**: count only the layers of type `full_attention` (every 4th for Qwen). The linear layers hold a fixed-size recurrent state independent of context. For Qwen3.5-9B I estimate about 2 MiB per linear layer (32 value heads x 128 x 128 x 4 B fp32) x 24 layers = about 48 MiB **[unverified: my estimate, not read from llama.cpp]**. Small, but nonzero, and not affected by KV-cache type flags.
- **Sliding window (Gemma 3/4, gpt-oss)**: layers with a window cache at most `min(ctx, window)` tokens, if the runtime implements a trimmed SWA cache. llama.cpp has SWA-aware caching for Gemma 3 (and `--swa-full` to disable the saving) from memory **[unverified for Gemma 4]**; without it the cache is the full-ctx figure, which for Gemma 4 31B at 8K is 6.7 GiB instead of 1.1 GiB.
- **Gemma 4 specifics (derived from config, runtime behavior unverified)**: global layers use head_dim 512 and fewer KV heads (31B: 4 global KV heads vs 16 local); `attention_k_eq_v` is true for 12B/26B/31B (I assumed global layers store K only, halving their size); the E-models share KV across the last 18-20 layers (`num_kv_shared_layers`), so only 15 (E2B) or 24 (E4B) layers own a cache. Worked example, 31B at 8K f16: 10 global layers x (2 x 4 KV heads x 512 x 2 B x 0.5 = 4,096 B per token) x 8,192 ctx / 2^20 = 320 MiB; plus 50 sliding layers x (2 x 16 x 256 x 2 B = 16,384 B per token) x 1,024 window / 2^20 = 800 MiB; total 1,120 MiB. If the runtime does not implement K=V sharing or window trimming, expect up to 6x more. **The fit calculator should read the real KV buffer on first load** (llama.cpp prints it) rather than trust this number.

Per-token f16 KV for each non-Gemma-4 row (layers x KV heads x head_dim, x2 for K+V, x2 bytes):

| Model | Layers carrying KV | KV heads | head_dim | B/token | 8K MiB |
|---|---|---|---|---|---|
| Qwen3-0.6B / 1.7B | 28 | 8 | 128 | 2x28x8x128x2 = 114,688 | 896 |
| Qwen3-4B / 8B | 36 | 8 | 128 | 147,456 | 1,152 |
| Qwen3-14B | 40 | 8 | 128 | 163,840 | 1,280 |
| Qwen3-32B | 64 | 8 | 128 | 262,144 | 2,048 |
| Qwen3-30B-A3B | 48 | 4 | 128 | 98,304 | 768 |
| Qwen3.5-0.8B / 2B | 6 of 24 | 2 | 256 | 12,288 | 96 |
| Qwen3.5-4B / 9B | 8 of 32 | 4 | 256 | 32,768 | 256 |
| Qwen3.5/3.8-27B | 16 of 64 | 4 | 256 | 65,536 | 512 |
| Qwen3.5/3.6-35B-A3B | 10 of 40 | 2 | 256 | 20,480 | 160 |
| Llama 3.2 1B | 16 | 8 | 64 | 32,768 | 256 |
| Llama 3.2 3B | 28 | 8 | 128 | 114,688 | 896 |
| Phi-4-mini | 32 | 8 | 128 (derived) | 131,072 | 1,024 |
| Phi-4 14B | 40 | 10 | 128 (derived) | 204,800 | 1,600 |
| SmolLM3-3B | 36 | 4 | 128 (derived) | 73,728 | 576 |
| Ministral 3 3B / 8B / 14B | 26 / 34 / 40 | 8 | 128 | 106,496 / 139,264 / 163,840 | 832 / 1,088 / 1,280 |
| Granite 4.1 3B / 8B | 40 | 8 | 64 / 128 (derived) | 81,920 / 163,840 | 640 / 1,280 |
| LFM2-2.6B | 8 of 30 | 8 | 64 (derived) | 16,384 | 128 |
| gpt-oss-20b (full layers only) | 12 of 24 | 8 | 64 | 24,576 | 192 (+ small SWA part) |
| Gemma 3 1B / 4B / 12B / 27B (full cache, no SWA trim) | 26 / 34 / 48 / 62 | 1 / 4 / 8 / 16 | 256 / 256 / 256 / 128 | 26,624 / 139,264 / 393,216 / 507,904 | 208 / 1,088 / 3,072 / 3,968 |

### KV-cache quantization options

- llama.cpp `--cache-type-k` / `--cache-type-v` (`-ctk`, `-ctv`): `f16` (default), `q8_0` (34 bytes per 32 elements = 1.0625 B, 53% of f16), `q4_0` (18 bytes per 32 = 0.5625 B, 28% of f16, "about 3.6x compression"); `q4_1`, `q5_0`, `q5_1`, `iq4_nl` exist from my memory of the docs **[unverified]**. Quantizing the V cache requires flash attention; confirmed in discussion #20969 for the experimental turbo types and long-standing for the standard types from memory.
- Quality: q8_0 is close to lossless in community reports; q4_0 shows small perplexity changes (the same discussion cites about 1.6% variance), and asymmetric choices (K at q8_0, V at q4_0) are recommended because K vectors need more precision. Single secondary source **[unverified]**.
- Experimental "TurboQuant" 3-4 bit KV types (4.9x / 3.8x compression) exist only in forks and were **not in mainline llama.cpp** in that discussion; do not plan around them.
- For hybrid models, KV quantization shrinks only the full-attention layers' cache; the recurrent state stays full precision. The Qwen3.8-27B case shows q4_0 enabling 262K context on 24 GB; the same source reports that combining speculative multi-token prediction with full context failed at startup on 24 GB.
- For an interviewer (resume plus job description plus growing transcript, probably 4-16K tokens), KV quantization is rarely needed on hybrid or small-KV models; it is mainly a lever for Qwen3/Llama/Phi-style models on 4-8 GB cards, where f16 KV at 8K costs 0.9-1.2 GB.

## Reported speed and measured memory, with hardware

Sparse and mostly secondary. Decode speed is memory-bandwidth-bound: tokens/sec is roughly usable bandwidth divided by bytes of weights read per token (for MoE, only the active experts). Use these as sanity anchors, not spec numbers.

| Model / quant | Hardware and runtime | Reported speed | Memory notes | Source quality |
|---|---|---|---|---|
| Llama 7B Q4_0 (3.56 GB class) | Apple M1 (68 GB/s) / M2 (100) / M3 (100) / M4 (120) / M4 Pro (273) / M4 Max (410-546), llama.cpp Metal | tg128: 14 / 22 / 21 / 24 / 50 / 70-83 t/s; pp512: 108-118 / 146-180 / 187 / 221 / 364-450 / 714-886 | n/a | llama.cpp discussion #4167, community table |
| Qwen3.5-4B Q4_K_M | RTX 4090 and RTX 3090, Ollama (SaladCloud) | 128.3 and 76.4 t/s | "fits anything from an RTX 3060 12 GB upward" (as stated) | secondary, single blog |
| Qwen3.5-9B Q4_K_M | RTX 5090 and RTX 3090, Ollama (SaladCloud) | 93.1 and 70.7 t/s | n/a | secondary, single blog |
| Qwen3.5-9B Q4_K_M | RTX 4060 8 GB | 22-28 t/s | about 7 GB VRAM (another source says about 5.5 GB, see conflicts) | search summary of a page that returned 403 **[unverified]** |
| Qwen3.8-27B Q4_K_XL, llama.cpp | RTX 4090 (24 GB) | 109-113 t/s with MTP speculation; about 47 t/s at 262K ctx | 16.3 GB weights + q4_0 KV at 262K = 22.2 GB total; Ollama Q4_K_M, 131K, q4_0 = 20.9 GB | computingforgeeks.com, single source **[unverified]** |
| Gemma 4 E2B Q4_0 (3.35 GB file) | GTX 1650 Ti Max-Q 4 GB vs i7-1360P CPU, llama.cpp | GPU decode 4.27x CPU decode (4.04-4.34x); CPU about 15.7-17.6 t/s per a search summary, so GPU about 67-75 t/s (derived) **[unverified]** | 1,598 MiB VRAM resident; 58% of the file (embedding table) stays in host memory | dev.to post, single source |
| Gemma 4 26B-A4B Q4_K_M | Ryzen 5 7640HS + Radeon 760M iGPU, 96 GiB DDR5, Vulkan | tg128 about 21 t/s, pp512 about 239 t/s | about 17 GiB model, unified memory, BIOS framebuffer 8-16 GiB matters | dev.to post, single source |
| Llama 3.1 8B Q8_0 | same Radeon 760M, Vulkan | tg128 about 9.8 t/s, pp512 about 236 t/s | about 8 GiB | same post |
| Gemma 4 26B-A4B (Q4-class) | dual Xeon E5-2690 v2, DDR3-1866, CPU only | 5.2 t/s decode, about 16 t/s prompt eval | file about 15 GB as stated (HF says 16.95 GB for UD-Q4_K_M) | kunalganglani.com, single source |
| Phi-4-mini Q4_K_M | i7-12700 CPU / Ryzen 7 5700X CPU / Apple M3 / RTX 3060 | 12 / 9 / 14 / 80 t/s | about 4 GB RAM | promptquorum.com, single source **[unverified]** |
| Gemma 4 E2B, Llama 3.2 3B, Qwen3 8B (all Q4_K_M) | i7-12700 CPU | 15 / 10 / 4-5 t/s | about 3 / 3.5 / 6 GB RAM | promptquorum.com, same post **[unverified]** |
| Phi-4-mini Q4 | NVIDIA A4000 (estimate, not a measurement) | about 77 t/s | about 2 GB weights | localai.computer **[unverified]** |
| Llama 3.2 3B Q4_K_M | Raspberry Pi 5 8 GB | 3-5 t/s | about 2.0 GB RAM | tinyweights.dev / Stratosphere Lab blog, search summaries **[unverified]** |

Takeaways: (a) 2025-26 3-4B models at Q4 reach roughly 10-17 t/s on a recent 8-12-core laptop CPU, which is conversational (about 7 words per second at 10 t/s) but with slow prompt processing; (b) 8B-class dense models fall to 4-5 t/s on CPU, borderline; (c) MoE models with about 4B active (Gemma 4 26B-A4B, Qwen3.x-35B-A3B, Qwen3-30B-A3B) decode at "4B speed" but need the whole model in RAM (17-22 GB at Q4), so they suit 32 GB RAM machines and 24 GB GPUs, not 8-16 GB ones; (d) on Apple unified memory, bandwidth predicts speed well.

I found no measured time-to-first-token for 2-4K-token prompts on small GPUs. Prompt-processing figures (pp512) above are the best proxy. For an interviewer that re-sends the resume and job description each turn, prefix caching matters more than raw prefill speed.

## Which ladder fits which memory class

Method (my rules, **[unverified]** assumptions, not measured): LLM budget = total memory minus about 2 GB for other slots (STT, TTS, VAD) and headroom, per SPEC §8.1; the requirement is Q-file + KV at 8K f16 + about 0.5 GB runtime overhead at or below that budget. For CPU-only, reserve about 4-5 GB of RAM for the OS, app, and STT/TTS. Entries are the largest that fits, with the next rungs down as fallbacks. Assumes thinking mode off.

| Memory class | LLM budget | Largest rung that fits (and how) | Fallbacks |
|---|---|---|---|
| 4 GB VRAM | about 2 GB | Qwen3.5-2B Q4_K_M (1.28 + 0.10 KV + 0.5 = 1.9 GB); Gemma 4 E2B Q4 may fit via host-resident embeddings (1.6 GB measured on one card) | Qwen3.5-0.8B Q8 (1.4 GB), Llama 3.2 1B Q8 (2.1, borderline), LFM2-2.6B Q4 (2.2, borderline) |
| 6 GB VRAM | about 4 GB | Qwen3.5-4B Q4_K_M (2.74 + 0.27 + 0.5 = 3.5 GB) or Q5_K_M (3.9 GB); SmolLM3 Q8 (4.3, borderline); Phi-4-mini Q4 (4.1, borderline) | Qwen3.5-2B Q8, Granite 4.1 3B Q4 (3.3), Ministral 3 3B Q4 (3.5) |
| 8 GB VRAM | about 6 GB | Gemma 4 E4B Q4_K_M (4.98 + 0.16 + 0.5 = 5.6 GB, less if embeddings stay on host), or Qwen3.5-4B Q8 (5.2 GB), or Qwen3.5-9B IQ4_XS (5.17 + 0.27 + 0.5 = 5.9, tight) | Qwen3.5-4B Q6_K; Qwen3.5-9B Q4_K_M needs 6.5 GB, so it does not fit this budget |
| 12 GB VRAM | about 10 GB | Qwen3.5-9B Q6_K (7.46 + 0.27 + 0.5 = 8.2 GB) or Q5_K_M (7.4 GB); Gemma 4 12B Q4_K_M (7.12 + 0.4 + 0.5 = 8.0 GB) or Q5 (9.3 GB) | Ministral 3 8B Q6_K (8.6), Qwen3-8B Q6_K (8.4) |
| 16 GB VRAM | about 14 GB | Gemma 4 12B Q8_0 (12.67 + 0.4 + 0.5 = 13.6 GB) or Qwen3.5-9B Q8_0 (10.3 GB, with lots of context room); Ministral 3 14B Q6_K (12.9) | Qwen3-14B Q5, gpt-oss-20b (about 12.7 GB at 8K; reasoning-model caveat) |
| 24 GB VRAM | about 22 GB | Qwen3.5/3.8-27B Q5_K_M (19.6 + 0.5 + 0.5 = 20.6 GB) or Q4_K_M (17.8 GB); Gemma 4 31B Q4_K_M (18.3 + 1.2 + 0.5 = 20.0 GB); Gemma 4 26B-A4B Q4 (17.0 + 0.3 + 0.5 = 17.8 GB, "4B-active" speed) | Qwen3.6-35B-A3B Q4 (22.1 GB of weights) does not fit without expert offload to CPU |
| 8 GB RAM, CPU-only | about 3 GB | Qwen3.5-2B Q4/Q5 or Gemma 4 E2B Q4 (3.1 GB file; about 15 t/s class on a 12-core CPU per one source); Qwen3.5-4B Q4 is borderline (3.5 GB) | Qwen3.5-0.8B, Llama 3.2 1B. Confirms the discussion doc's worry that 8 GB is tight |
| 16 GB RAM, CPU-only | about 10 GB | Qwen3.5-9B Q4 (6.5 GB; about 5 t/s class **[unverified]**) or Gemma 4 E4B Q4 (about 5.6 GB); Qwen3.5-4B Q5-Q8 is faster | Phi-4-mini Q4, SmolLM3, Ministral 3 3B |
| 32 GB RAM, CPU-only | about 24 GB | Gemma 4 26B-A4B Q4 (17.5 GB; about 5-10 t/s on a mid CPU per one source; best quality per unit latency here) or Qwen3.5-27B Q4 (17.7 GB, but dense, likely 1-3 t/s, bandwidth-derived **[unverified]**) | Gemma 4 12B Q4 (8 GB), Qwen3.5-9B |

Mixed placement note: MoE models offload cleanly (experts to CPU, attention and shared layers on GPU), which is how a 24 GB card could run Qwen3.6-35B-A3B; this needs runtime support for expert offload (llama.cpp `--n-cpu-moe` or tensor overrides, from memory **[unverified]**).

## Conflicts and uncertainties between sources

1. **Gemma 4 lineup**: an early web summary said four sizes (E2B, E4B, 26B MoE, 31B dense); Google's model card and the HF API show five, including a 12B. I went with the model card and HF. **Release date** also differs: a search summary says April 3, 2026; HF `createdAt` is 2026-03-02 for the E-models and 2026-05-23 for the 12B. Repo creation may have preceded public launch; I did not resolve this.
2. **Qwen3.5-27B Q4_K_M size**: Unsloth 16.74 GB, bartowski about 18 GB. Different quantizer recipes (Unsloth uses per-tensor dynamic precision). A fit calculator must use the actual size of the exact file it will download.
3. **Qwen3.5-9B Q4_K_M VRAM**: about 7 GB (one source, RTX 4060 8 GB) vs about 5.5 GB (another). The file is 5.68 GB, so 5.5 GB cannot include KV and overhead; 7 GB looks plausible with some context. Neither source stated the context size.
4. **llama.cpp KV formula in discussion #9784**: states an MHA-style formula using hidden_size whose worked example gives about 1.2 GiB; the same thread's real log shows 160 MiB for the same shape at ctx 512. The GQA formula (kv_heads x head_dim) reproduces the log, so I used it.
5. **Gemma 4 26B-A4B Q4_K_M size**: 16.95 GB (Unsloth UD-Q4_K_M, HF API) vs about 15 GB (kunalganglani.com). Used HF.
6. **Qwen3.5-0.8B GGUF card** describes the architecture as "Gated Delta Networks combined with sparse Mixture-of-Experts"; the config has no experts for this size (the sentence looks copied from a larger card), so I treated it as dense. Also, my page-fetch summaries of the 0.8B and 2B configs both showed 24 layers and 2 KV heads; I confirmed this by running a script over the raw `config.json` files (hidden sizes 1024 and 2048 differ).
7. **Qwen3.8 and the 3.7 gap**: Qwen3.8-27B and a 180B "Flash-Next" are visible on the HF Qwen org page, confirming the 3.8 generation. The statement that Qwen3.7 had no open weights, and the existence of a 2.4T-A95B open model under a custom license, come only from codersera.com **[unverified]**.
8. **Gemma 4 E-series parameter counts**: "E2B/E4B" in the name vs 2.3B/4.5B "effective" and 5.1B/8B total in the card. Use total for disk and CPU RAM, effective for compute.

## Implications for the fit calculator

- Make the ladder data-driven per model: store layers, KV heads, head_dim, layer-type pattern (full vs linear vs sliding), window size, total and active params, and the real per-quant file sizes. Do not use one global KV formula.
- Candidate families for the interviewer slot (not a decision): **Qwen3.5** as the primary ladder (0.8B, 2B, 4B, 9B, then 27B and 35B-A3B for big machines; cheap KV, Apache-2.0, ungated) and **Gemma 4** as the second (E2B, E4B, 12B, 26B-A4B, 31B; Apache-2.0). Fallbacks with the most mature runtime support: Qwen3, Llama 3.2, Phi-4-mini, SmolLM3, Ministral 3.
- Verify on first load: read llama.cpp's model buffer and `KV buffer size` lines, compare with the prediction, and step down one rung on failure (discussion open question 2).
- Disable thinking mode for the interviewer and re-measure memory and speed with that setting.
- Keep the 0.5 GB overhead, 2 GB headroom, and 8K context assumptions configurable; they are my assumptions and I did not measure them.

## Sources

All accessed 2026-10-02.

Primary (Hugging Face APIs and files, read directly):

- HF tree API for GGUF repos, e.g. https://huggingface.co/api/models/unsloth/gemma-4-E4B-it-GGUF/tree/main, and the same pattern for `unsloth/Qwen3.5-{0.8B,2B,27B,35B-A3B}-GGUF`, `unsloth/Qwen3.6-35B-A3B-GGUF`, `unsloth/Qwen3.8-27B-GGUF`, `unsloth/gemma-4-{E2B,12B,26B-A4B,31B}-it-GGUF`, `unsloth/gemma-3-{1b,4b,12b,27b}-it-GGUF`, `unsloth/Llama-3.2-{1B,3B}-Instruct-GGUF`, `unsloth/Phi-4-mini-instruct-GGUF`, `unsloth/phi-4-GGUF`, `unsloth/SmolLM3-3B-GGUF`, `unsloth/Qwen3-{0.6B,1.7B,4B,8B,14B,32B,30B-A3B}-GGUF`, `unsloth/Ministral-3-{3B,8B,14B}-Instruct-2512-GGUF`, `unsloth/granite-4.1-{3b,8b}-GGUF`, `unsloth/gpt-oss-20b-GGUF`, `LiquidAI/LFM2-2.6B-GGUF`
- HF model API for params, license, gating and creation date: https://huggingface.co/api/models/{repo} for the corresponding `Qwen/`, `google/`, `meta-llama/`, `microsoft/`, `HuggingFaceTB/`, `mistralai/`, `ibm-granite/`, `LiquidAI/`, `openai/` repos
- `config.json` files, e.g. https://huggingface.co/Qwen/Qwen3.5-9B/raw/main/config.json and https://huggingface.co/google/gemma-4-31B-it/raw/main/config.json (same pattern for each model; Gemma 3 and Llama 3.2 configs read via Unsloth mirrors because the official repos are gated)
- Gemma 4 model card: https://ai.google.dev/gemma/docs/core/model_card_4
- Qwen org page: https://huggingface.co/Qwen
- GGUF pages: https://huggingface.co/unsloth/Qwen3.5-9B-GGUF, https://huggingface.co/unsloth/Qwen3.5-4B-GGUF, https://huggingface.co/unsloth/Qwen3.5-2B-GGUF, https://huggingface.co/unsloth/Qwen3.5-35B-A3B-GGUF, https://huggingface.co/bartowski/Qwen_Qwen3.5-27B-GGUF, https://huggingface.co/bartowski/Qwen_Qwen3.5-0.8B-GGUF, https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF, https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF
- llama.cpp memory discussion: https://github.com/ggml-org/llama.cpp/discussions/9784
- llama.cpp Apple Silicon benchmark table: https://github.com/ggml-org/llama.cpp/discussions/4167
- llama.cpp KV-quantization / TurboQuant discussion: https://github.com/ggml-org/llama.cpp/discussions/20969

Secondary (blogs and aggregators; every number taken only from these is **[unverified]**):

- https://codersera.com/blog/qwen-3-5-complete-guide-2026/ (Qwen 3.5-3.8 lineup and open-weight status)
- https://knightli.com/en/2026/05/01/qwen3-6-local-vram-quantization-table/ (Qwen3.6 VRAM guidance)
- https://computingforgeeks.com/run-qwen3-8-27b-locally/ (Qwen3.8-27B VRAM and speed)
- https://blog.salad.com/qwen-3-5-small-models-on-saladcloud-benchmarks-cost-and-why-you-dont-need-a-mac-mini/ (Qwen3.5 4B/9B speed)
- https://dev.to/gde/a-4-gb-laptop-gpu-beats-a-12-core-cpu-by-43x-on-gemma-4-4150 (Gemma 4 E2B on a 4 GB GPU)
- https://dev.to/hrodrig/21-toks-gemma-4-on-a-ryzen-mini-pc-llamacpp-vulkan-and-the-messy-truth-about-local-chat-m82 (Gemma 4 26B on Radeon 760M)
- https://www.kunalganglani.com/blog/gemma-4-cpu-inference-benchmark (Gemma 4 26B on CPU)
- https://www.promptquorum.com/local-llms/best-cpu-only-llm (CPU-only speeds)
- https://docs.bswen.com/blog/2026-03-27-rtx-4060-token-speed-benchmark-coding/ (RTX 4060 8 GB; the page returned 403, figures come from a search-result summary)
- https://tinyweights.dev/posts/run-phi-4-mini-locally/ and https://atomic.chat/models/phi-4-mini-instruct (Phi-4-mini KV table); https://localai.computer/can/nvidia-a4000/run/microsoft-phi-4-mini-instruct (A4000 estimate)
- https://tinyweights.dev/posts/run-llms-raspberry-pi-5/ and https://www.stratosphereips.org/blog/2025/6/5/how-well-do-llms-perform-on-a-raspberry-pi-5 (Raspberry Pi 5), seen only in search-result summaries
- Search-result summaries on the Qwen3.5 small-model launch, Gemma 4 launch, SmolLM3 and "best small LLM 2026" lists (Unsloth X post, artificialanalysis.ai, deepinfra.com, blog.google, turingpost.com and others), used only for orientation and release dates.
