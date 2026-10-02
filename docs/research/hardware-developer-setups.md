*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Software developer hardware setups (research for the fit calculator)

Research date: 2026-10-02. Purpose: pick representative developer hardware profiles for the local STT + LLM + TTS fit calculator (see SPEC.md section 8 and `docs/discussions/2026-10-02-hardware-fit-and-model-sizing.md`).

## Summary

- **No public developer survey publishes RAM, CPU core count, or GPU/VRAM.** Stack Overflow and JetBrains report OS, tools, and languages only. Everything about hardware distribution below comes from the Steam Hardware Survey (a gaming/enthusiast proxy, NOT developers) or from vendor lineups. Hardware shares for developer profiles are therefore estimates, marked as such.
- **OS split (Stack Overflow 2025, professional use, multi-select):** Windows 49.5%, macOS 32.9%, Ubuntu 27.7%, WSL 16.8%. Respondents can pick several, so the numbers exceed 100%. A Big Tech/startup poll skews very differently (macOS about 62-66%, Windows about 12%) and is the main conflict between sources.
- **RAM:** Steam (Sept 2026): 32 GB is now the most common (42.2%), then 16 GB (37.8%), 8 GB (6.5%), 64 GB (3.7%). Developers likely skew at or above this for work machines, but there is no data to confirm it. **[unverified]**
- **Free RAM under a dev workload is about 40-60% of installed on 16 GB, and 60-75% on 32 GB** (rough estimate from anecdotal footprints; see the section below). Plan the AI stack against roughly 6-8 GB free on 16 GB machines.
- **GPU:** discrete NVIDIA is the only broadly CUDA-capable option and dominates the Steam sample (about 65%, **[unverified]**), but a large share of developer machines are laptops with integrated graphics or Apple Silicon. The calculator should treat "no discrete GPU, CPU or unified-memory inference" as the main case, not an edge case.
- **Apple Silicon** unified memory is the easiest way for a developer to reach 24-64 GB of GPU-addressable memory in a laptop; the 16 GB base is still common.

## Data tables

### Operating system

| Source | Population | Windows | macOS | Linux | Notes |
|---|---|---|---|---|---|
| Stack Overflow 2025 | Professional devs, multi-select | 49.5% | 32.9% | Ubuntu 27.7%, WSL 16.8% (other distros not captured here) | Personal use: Windows 56.7%, macOS 32.7%, Ubuntu 27.8%, WSL 15.9%. n about 49,000. Figures came through secondary summaries; the primary page's OS section could not be fetched. **[unverified]** against the primary page |
| Pragmatic Engineer poll (X/LinkedIn) | Big Tech/startup "bubble" | 12-12.8% | 61.6-66% | 20-24.2% | Self-selected, about 4,000 (X) and 6,000 (LinkedIn) votes. Not representative |
| Steam Hardware Survey, Sept 2026 | Gamers (proxy) | 95.03% | 1.92% | 3.05% | Not developers. Shows nothing about Mac/Linux developers |
| JetBrains State of Developer Ecosystem 2025 | 24,534 devs | not found | not found | not found | I did not find an OS breakdown in what I could access. One summary cites roughly 47/30/26 for Windows/macOS/Linux, attributed to "general developer statistics", not JetBrains. **[unverified]** |

**Conflict:** Windows is about half of professional developers globally (Stack Overflow) but a small minority in the startup/Big Tech poll. The right answer depends on the target audience: interview candidates are likely a mix, closer to Stack Overflow for the general market and closer to the poll for FAANG-style prep.

### System RAM (Steam Hardware Survey, Sept 2026; gaming proxy, not developers)

| RAM | Share |
|---|---|
| 8 GB | 6.47% |
| 12 GB | 2.12% |
| 16 GB | 37.82% |
| 24 GB | 2.56% |
| 32 GB | 42.22% |
| 64 GB | 3.71% |

Caveat: the survey summaries note that Simplified Chinese-language systems jumped to 31.39% (+7.42 pts) this month, which may have shifted results month to month. Also, I could not fetch the Steam page's raw tables separately; the figures above come from a fetch summary and match a secondary report (VideoCardz/Hardware Busters coverage of the same month). The 8 GB, 12 GB, 24 GB, and 64 GB rows are single-source. **[unverified]**

### CPU physical cores (Steam, Sept 2026; gaming proxy)

| Cores | Share |
|---|---|
| 6 | 27.23% |
| 8 | 30.06% |
| 10 | 8.19% |
| 14 | 5.23% |
| 16 | 5.78% |

Rows for 2 and 4 cores were not returned. **[unverified]** The sum of the rows shown is about 76%.

### GPU VRAM and vendor (Steam, Sept 2026; gaming proxy)

| VRAM | Share |
|---|---|
| 4 GB | 5.13% |
| 6 GB | 5.12% |
| 8 GB | 26.71% |
| 12 GB | 13.06% |
| 16 GB | 27.21% |

Vendors: NVIDIA about 65%, AMD about 12%, Intel about 3% **[unverified, rounded values from a fetch summary]**. RTX 50 series reached 18.21%, led by the RTX 5070 at 5.86%. Enthusiasts skew toward discrete GPUs far more than a general developer population, so these VRAM numbers overstate the developer case. Note that Steam's VRAM figures can include integrated-GPU users reported separately; the above does not show a "no discrete GPU" row.

### Apple Silicon unified memory (vendor specs)

| Chip / machine | CPU cores | GPU cores | Memory options | Bandwidth |
|---|---|---|---|---|
| M5 MacBook Air 13"/15" (2026) | 10 | 8-10 | 16 GB base, 24 GB (+$200), 32 GB (+$400) | not captured |
| M5 Pro MacBook Pro | 15 or 18 | 16 or 20 | 24 GB base, up to 64 GB | 307 GB/s |
| M5 Max MacBook Pro | 18 | 32 or 40 | 36 GB base, up to 128 GB | 460 / 614 GB/s |

Sources: Apple support pages and press coverage. Air memory options and prices come from retail/press coverage only. **[unverified]** against Apple's own spec page. Older M1-M4 Macs remain common in the installed base, and 8 GB and 16 GB base configs were the norm before M5-era Air pricing; I did not find installed-base data for Macs. **[unverified]**

### Integrated GPUs and NPUs (2026 laptop silicon)

| Platform | NPU (claimed) | Notes |
|---|---|---|
| Qualcomm Snapdragon X2 Elite/Plus | about 80 TOPS | ARM Windows |
| AMD Ryzen AI 400 | about 60 TOPS | Strongest iGPU of the x86 options per the cited review |
| Intel Core Ultra Series 3 (Panther Lake) | about 50 TOPS | Arc Xe3 iGPU, up to about 122 GPU TOPS in top SKUs |
| Apple M5 family | 16-core Neural Engine | Unified memory |

Copilot+ PC floor: 40+ TOPS NPU, 16 GB RAM, 256 GB SSD. All figures are vendor-claimed and from secondary roundups. **[unverified]** Practical caveat: PCWorld reports Windows left NPUs behind, and mainstream local LLM runtimes mostly use CPU or GPU, so NPU TOPS should not drive the fit calculator in v1.

### CUDA vs other accelerators for this audience

- NVIDIA/CUDA: the default for local-LLM tooling on Windows and Linux desktops, and the vendor with the largest Steam share. Needs a discrete GPU, so mostly desktops and gaming/workstation laptops.
- Apple Metal/MLX: the main route for the macOS developers. No VRAM limit as such; usable model size is bounded by unified memory minus OS and apps.
- AMD (ROCm/Vulkan) and Intel (SYCL/OpenVINO/Vulkan): usable, with less tooling; the iGPU is mostly a fallback via Vulkan. I found no developer-specific share data for any of these. **[unverified]**

## How much RAM is realistically free

No measurement study found; these are rough figures from anecdotal articles (dev.to, Medium, vendor blogs) and should be treated as **[unverified]**:

- OS and background: 3-4 GB
- IDE with extensions: 1-6 GB (JetBrains/VS-based often 2-4 GB)
- Browser with dev tabs: 2-8 GB
- Docker Desktop / WSL2 VM with a compose stack: 4-12 GB (WSL2 can claim up to half of RAM by default)
- Local DBs, dev servers, AI assistants and Slack/Teams: 2-6 GB

Estimated free RAM after a typical workday setup (and before the interview app launches):

| Installed | Likely free (est.) | Notes |
|---|---|---|
| 8 GB | 1-3 GB | Not viable for local LLM beyond tiny models |
| 16 GB | 4-8 GB (6 GB planning figure) | Heavy Docker users may have under 3 GB |
| 32 GB | 14-22 GB | Comfortable for a 7-8B Q4 model plus STT/TTS on CPU |
| 64 GB | 40-52 GB | Room for 14B-30B class models |

For the calculator, the user can close the browser and Docker before an interview. Consider offering a "free RAM now" live reading over an installed-RAM guess.

## Proposed developer profiles

Shares are rough guesses combining the OS split, Steam RAM data, and vendor lineups. No source gives joint distributions, so every share is **[unverified]** and the shares are not meant to sum cleanly. Treat them as ordering, not measurement.

| # | Profile | CPU cores | RAM | GPU / VRAM | Free RAM (est.) | Est. share of devs |
|---|---|---|---|---|---|---|
| A | **Budget / older laptop** (Windows or Linux, Intel/AMD, no discrete GPU) | 4-6 | 8-16 GB | iGPU only, shared memory | 2-6 GB | about 20-30% |
| B | **Mainstream work laptop** (Windows or Linux, Core Ultra/Ryzen, iGPU, optional NPU) | 8-12 | 16-32 GB | iGPU, no CUDA | 6-18 GB | about 25-35% |
| C | **MacBook Air / base MacBook Pro** (M-series, base or mid memory) | 8-10 | 16-24 GB unified | integrated, Metal/MLX | 8-15 GB | about 15-20% (macOS is about 33% pro; most on this tier is a guess) |
| D | **Gaming/workstation desktop or laptop with NVIDIA** (CUDA) | 6-16 | 32 GB | 8-16 GB VRAM (RTX 4060-5070 class) | 20+ GB system, 6-14 GB VRAM | about 10-20% |
| E | **High-end Mac or workstation** (M-Pro/Max, or RTX 24 GB+ desktop) | 12-18 | 48-128 GB unified, or 64 GB + 24 GB VRAM | Metal or large-VRAM CUDA | 35+ GB | about 5% |

Suggested calculator tiers: minimum supported is profile A at 16 GB with a small quantized model on CPU, and 8 GB machines should be told local mode is unsupported and cloud fallback is needed. The best-effort target is B and C (the largest audience). D and E unlock bigger models and lower latency.

## Gaps

- No direct developer data for RAM, cores, or GPU. Recommend running an opt-in, anonymous hardware telemetry (or a calculator input log) once the tool ships to replace these estimates.
- Stack Overflow's OS section was not read from the primary page; JetBrains OS data not found.
- Steam rows for low core counts, the integrated-GPU/no-discrete share, and exact vendor shares were not retrieved cleanly.
- No installed-base data for Mac memory or for Apple Silicon generations.
- Free-RAM figures are anecdotal.

## Sources

Access date for all: 2026-10-02.

- Stack Overflow Developer Survey 2025 (work section, sample size): https://survey.stackoverflow.co/2025/work (survey year 2025). OS percentages were taken from secondary summaries: https://commandlinux.com/statistics/developer-os-preference-stack-overflow-survey/ and https://fosspost.org/developer-os-preference-stack-overflow-survey/ (2025 survey).
- WSL share discussion: https://windowsforum.com/windows-news.4/wsl-16-8-survey-result-is-not-an-install-base.443653/ (2025 survey, commentary).
- Pragmatic Engineer OS poll, as reported by Windows Latest (2026-09-22): https://www.windowslatest.com/2026/09/22/microsoft-keeps-rebuilding-windows-for-developers-but-a-new-poll-puts-windows-at-just-12/
- JetBrains State of Developer Ecosystem 2025 (no OS breakdown found): https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/
- Steam Hardware & Software Survey, September 2026 (gaming proxy): https://store.steampowered.com/hwsurvey/ ; secondary coverage: https://videocardz.com/newz/geforce-rtx-5070-becomes-the-most-popular-gpu-on-steam-32gb-ram-reaches-42 and https://hwbusters.com/news/steam-hardware-survey-32gb-of-ram-finally-overtakes-16gb-and-the-rtx-5070-takes-the-gpu-crown/ (the VideoCardz page returned HTTP 402 to a direct fetch; search snippets only).
- Apple MacBook Pro M5 Pro/Max specs (2026): https://support.apple.com/en-us/126318 and https://support.apple.com/en-us/126319 ; press: https://www.apple.com/newsroom/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/
- M5 MacBook Air memory options and prices (retail/press): https://appleinsider.com/articles/26/05/26/apples-2026-m5-macbook-air-plunges-to-record-low-899
- NPU and iGPU roundups (2026, secondary): https://pcworld.com/article/3028591/copilot-laptops-arrived-in-force-at-ces-2026-just-as-windows-left-npus-behind.html , https://localaimaster.com/blog/npu-comparison-2026 , https://tech-insider.org/intel-panther-lake-vs-amd-ryzen-ai-400-2026/
- Developer RAM footprints (anecdotal, 2026): https://dev.to/mike_hasarms/16gb-or-32gb-ram-for-web-development-2475 , https://medium.com/@mumbamweni3/why-16gb-ram-laptops-are-failing-developers-in-2026-and-how-to-upgrade-without-breaking-the-bank , https://dev.to/snowfrogdev/wsl-is-a-memory-hog-deal-with-it-14ja
