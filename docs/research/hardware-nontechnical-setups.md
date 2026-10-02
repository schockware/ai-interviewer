*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Non-technical consumer hardware: what job seekers, students and general consumers own

Research date: 2026-10-02. Purpose: input to minimum-spec and tier decisions for the fit calculator (SPEC.md section 8; docs/discussions/2026-10-02-hardware-fit-and-model-sizing.md).

Method note: figures come from web search summaries and page fetches. Most items are from one secondary source or a search-engine summary, so they are tagged **[unverified]** where applicable. Items tagged **[estimate]** are the author's engineering judgement, not sourced data. No source gives a clean "typical job seeker" distribution, so profile shares below are rough and mostly **[estimate]**.

## Summary

- The non-technical population is dominated by Windows laptops, with Apple (Mac) as a growing second and Chromebooks mainly in schools. StatCounter desktop OS (Sep 2026): Windows 76.4%, macOS/OS X combined about 16.8%, Linux 4.5%, ChromeOS 2.3%. This is web-traffic share, not installed base.
- Steam Hardware Survey (a gaming proxy that over-represents gamers) shows 32 GB RAM at 42%, 16 GB at 38%, 8 GB at 6.5%. This is NOT the general population. The general population skews much lower: 8 GB laptops are common and, due to the 2026 memory shortage, are returning as a mainstream configuration.
- The 2026 DRAM/SSD shortage is the main new fact: IDC forecasts 2026 PC shipments down about 11%, ASPs up about 18%; Gartner says refresh/lifespans extend about 15%. Vendors are moving mid-range laptops back to 8 GB. The installed base will therefore stay older and smaller-memory for longer.
- Apple's MacBook Neo (A18 Pro, 8 GB, 256 GB, $599 at launch, $699 since late June) outsold every other Mac in its debut quarter (1.1M units). Newly bought consumer Macs are therefore plausibly 8 GB, not 16 GB. MacBook Air M4 base is 16 GB.
- Integrated graphics only is the norm for the general population. A discrete NVIDIA GPU is a minority (gamers, creators); only the Steam proxy gives a number, and it is not representative.
- Chromebooks (mostly 4-8 GB, ChromeOS leaves about 1-2 GB free on 4 GB models) should be treated as unsupported for local STT+LLM+TTS; they can only be a thin client to a remote or other-device backend.
- Realistic free RAM with a browser and a video-call app open on an 8 GB machine is about 2-3 GB **[estimate]**; on 16 GB, about 7-9 GB **[estimate]**. This, not installed RAM, is the binding constraint.

## Data tables

### Table 1. OS split

| Source | Scope | Windows | macOS (incl. "OS X") | Linux | ChromeOS | Notes |
|---|---|---|---|---|---|---|
| StatCounter, Sep 2026 | Desktop, worldwide, page views | 76.36% | 6.1% macOS + 10.68% OS X = 16.78% | 4.54% | 2.31% | Web-traffic share. StatCounter's older "OS X" label vs "macOS" split is a detection artifact. Summary pages for June 2026 showed Windows 56.6% with "Unknown" 21.5%, so month-to-month data is noisy **[unverified]** |
| Steam survey, Sep 2026 | Gamers | 95.03% | 1.92% | 3.05% | n/a | Gaming proxy, heavily biased |
| IDC Q2 2026 | PC shipments (vendor view) | n/a | Apple 9.9% of worldwide PC shipments, 6.7M Macs | n/a | n/a | Shipments, not installed base |

Conflict to note: one search summary reported Steam Windows 10 at 71.34% and Windows 11 at 23.61% (Sep 2026), while StatCounter reports Windows 11 at 71.44% and Windows 10 at 27.83% (desktop Windows versions, Sep 2026). The two are nearly mirror images and the Steam figure is implausible; likely a search-summary error. **[unverified]** Treat Windows 11 as the majority; Windows 10 (end of support Oct 2025) remains about a quarter or more of Windows machines.

### Table 2. Steam Hardware Survey, September 2026 (gaming proxy, NOT the general population)

| Metric | Value |
|---|---|
| RAM 32 GB / 16 GB / 8 GB | 42.22% / 37.82% / 6.47% |
| Most common GPU | RTX 5070, 5.86% (RTX 50 family 18.21%) |
| VRAM 16 GB / 8 GB / 12 GB / 4 GB or less | 27.21% / 26.71% / 13.06% / about 11% |
| CPU cores 8 / 6 / 4 / 10+ | 30.06% / 27.23% / 10.79% / about 18% |
| Intel integrated graphics | about 3-4% (WebFetch summary, **[unverified]**) |

Interpretation: Steam participants own hardware at least 2x the RAM of the typical consumer laptop. Do not use these numbers to set a minimum spec for the general audience. They are useful only to size the "gaming desktop" profile.

### Table 3. Market and price context (2026)

| Item | Value | Source / confidence |
|---|---|---|
| Q1 2026 shipments | Gartner 62.8M (+4%), IDC 65.6M (+2.5%); Gartner calls growth inflated by pre-buying | Two sources agree in direction (small unit difference is methodology) |
| 2026 full-year forecast | IDC about -11.3% (Q4 up to -20%); Gartner -10.4% | Two sources agree |
| ASP change 2026 | +18.3% forecast | IDC via Tom's Hardware, single secondary **[unverified]** |
| DRAM + SSD price | Gartner projects +130% by end of 2026; 32 GB DDR5 kit from $100-200 (Oct 2025) to about $350 | Secondary **[unverified]** for kit price |
| Laptop RAM trend | Analysts expect mid-range laptops to slide back to 8 GB; Dell XPS 13 at $699 with 8 GB; Surface Laptop for Business 13 at 8 GB | Multiple trade articles; consistent |
| Lifespan | Enterprise laptop 3.7 yr, desktop 4.6 yr (Gartner); consumer laptops commonly 4-8 yr; Gartner expects +15% extension in 2026 | Mix of sources; consumer figure is a vendor-blog range **[unverified]** |
| Copilot+ PC share | 2.3% of Windows machines sold in Q1 2025; under 10% of systems in Q3 2024. No 2026 figure found | Old data; gap |
| Copilot+ PC floor spec | NPU 40+ TOPS, 16 GB RAM, 256 GB SSD, Windows 11 24H2 | Microsoft requirement |

### Table 4. Device-class notes

| Class | Typical spec | Relevance |
|---|---|---|
| Budget Windows laptop (Walmart/Amazon best sellers) | 8 GB RAM, 256 GB SSD, 15.6" 1080p, Intel/AMD integrated graphics (e.g. HP 15 "Copilot" edition) | Largest single consumer shelf. Best-seller ranking from asinsight/Walmart pages, single secondary **[unverified]** |
| MacBook Neo | A18 Pro, 8 GB unified, 256 GB, $699 | Fast-growing; 8 GB shared with GPU/OS |
| MacBook Air M4 | 16 GB / 256 GB base ($1,149 list; $800-950 street deals) | Apple Silicon unified memory is efficient for local models; 16 GB base since 2025 |
| Older MacBook Air M1/M2 | 8 GB base was standard | Large installed base of 8 GB Macs **[estimate]** |
| Chromebook | 4-8 GB RAM; Chromebook Plus mandates 8 GB; 4 GB models still sold; 60.1% of global K-12 devices (2025, aboutchromebooks/commandlinux-style sites, **[unverified]**) | See Chromebook section |
| Gaming desktop/laptop | 16-32 GB RAM, NVIDIA 8-16 GB VRAM | Steam proxy only |

### Table 5. Free-resource estimates **[estimate]** (author judgement, not measured here)

| Machine RAM | OS + background | Browser (interview site + a few tabs) | Video-call app (Zoom/Teams/Meet) | Free for our app |
|---|---|---|---|---|
| 8 GB (Windows) | 2.5-3.5 GB | 1.5-2.5 GB | 0.5-1.0 GB | about 1.5-3 GB |
| 8 GB (macOS/Neo) | 2.5-3 GB | 1.5-2 GB | 0.5-1 GB | about 2-3 GB (unified, shared with GPU) |
| 16 GB | 3-4 GB | 2-3 GB | 0.5-1 GB | about 7-9 GB |
| 32 GB | 3-4 GB | 2-4 GB | 0.5-1 GB | about 22-26 GB |

Source basis: a search result states ChromeOS plus Chrome leave only 1-2 GB free on 4 GB Chromebooks; the other rows are extrapolations. Recommend measuring on real machines before finalising tiers.

Free disk **[estimate]**: a 256 GB system drive is the common base on budget laptops and Macs; after OS, apps and user data, 40-100 GB free is typical, and many full machines have under 20 GB. Multi-GB model downloads (STT + LLM + TTS roughly 5-10 GB total for a small stack) are feasible for most but not all. No survey of free disk was found; this is a gap.

### Chromebooks: can they run this?

- Native ChromeOS cannot run local model runtimes. Ollama needs the Linux (Beta/Crostini) container, which is restricted and often disabled on school-managed devices.
- Most Chromebooks have 4-8 GB; ChromeOS and Chrome leave about 1-2 GB free on 4 GB devices. Only high-spec (16 GB) models are practical, and those are rare.
- Conclusion: classify Chromebooks as "not supported for local mode"; at most a browser client for a remote/home backend. School-issued machines are managed and usually cannot install software at all.

## Proposed non-technical profiles

Shares are rough and sum to about 100% of the non-technical consumer laptop/desktop audience. They are mostly **[estimate]**, anchored on: Windows about 76% / Mac about 17% / ChromeOS about 2% (StatCounter, web traffic), the 2026 shift to 8 GB, and Steam only for the gaming slice. Chromebooks are excluded from the share totals because they are out of scope.

| Profile | CPU | RAM | GPU / VRAM | Free RAM (browser + call open) | Free disk | Est. audience share | Basis |
|---|---|---|---|---|---|---|---|
| A. Older/budget Windows laptop (3-6 yr, or new 8 GB budget) | 4 cores (Core i3/i5 8th-12th gen, Ryzen 3/5), 4-8 threads | 8 GB | Integrated (Intel UHD/Iris Xe or Radeon iGPU), shared | about 1.5-3 GB | 20-80 GB of 256 GB | about 40-50% [estimate] | 8 GB returning as the mainstream default; Windows 76% of desktop; long lifespans |
| B. Newer 16 GB Windows laptop (incl. Copilot+/NPU) | 6-10 cores (Core Ultra, Ryzen 5/7, Snapdragon X), optional 40+ TOPS NPU | 16 GB | Integrated (Xe/Radeon 780M-class) | about 7-9 GB | 50-200 GB of 512 GB | about 15-20% [estimate] | Copilot+ spec floor is 16 GB; shipment share small and unverified; price rises limit growth |
| C. Mac, 8 GB (MacBook Neo, older Air M1/M2 base) | 6-8 cores Apple Silicon | 8 GB unified | Integrated, unified | about 2-3 GB | 30-100 GB of 256 GB | about 8-10% [estimate] | Neo outsold other Macs in Q1 2026; large 8 GB installed base |
| D. Mac, 16 GB (MacBook Air M3/M4, Pro) | 8-10 cores Apple Silicon | 16 GB unified | Integrated, unified | about 7-9 GB | 50-200 GB | about 7-10% [estimate] | Air base 16 GB since 2025 |
| E. Gaming desktop/laptop with NVIDIA GPU | 6-8+ cores | 16-32 GB | NVIDIA 8-16 GB VRAM | about 7-25 GB | 100+ GB | about 5-10% [estimate] | Steam survey as proxy; likely over-stated for job seekers |

Sanity check on D/B/C/E: these would be the audience for a "good local experience" tier. Profile A is the audience that decides whether a "minimum spec" exists at all.

Not a profile, listed for completeness: Chromebook / school- or library-issued locked-down device (out of scope for local mode); Windows 10 machines unable to upgrade (fall mostly under profile A).

## How this population differs from developers (for choosing a minimum spec)

| Dimension | Developers / technical users | Non-technical job seekers |
|---|---|---|
| RAM | 16-32 GB common; frequently upgraded | 8 GB is the modal config and is returning in 2026; free RAM about 2-3 GB while multitasking |
| GPU | Discrete GPU or Apple Silicon more likely; understand VRAM | Integrated only for most; discrete NVIDIA is a minority (Steam is not representative) |
| Machine age | Newer, upgraded more often | Older, kept longer; the 2026 memory shortage lengthens lifespans |
| Apple | Mostly 16 GB+ Macs | Neo/Air 8 GB very likely |
| Storage | Large SSD, free space managed | 256 GB base with little free; model downloads may fail |
| Environment | Can install runtimes, change settings, read errors | May be on Chromebook, school/library/work-managed machines; cannot install software or tolerate setup failures |
| Failure tolerance | Will debug, pick a smaller model | Needs the calculator to say clearly "this will not work" and offer a fallback (cloud or smaller stack) |
| Concurrent load | Own the machine, close other apps | Browser plus live video call running at once |

Implication for minimum spec: set the minimum against free RAM and free disk, not installed values, and treat profile A (8 GB, integrated, about 2-3 GB free) as the floor that defines whether a fully local mode is offered by default. Offering a very small stack (small STT, 1-3B quantized LLM, light TTS) for profile A, a standard stack for B/D, and a full stack for E, with a clear "cloud or remote mode" fallback for Chromebooks and under-spec machines, matches the data. This tier mapping is the author's proposal, not a sourced finding.

## Gaps and caveats

- No authoritative installed-base distribution of RAM, disk free or machine age for the general consumer population (Steam is the only large public hardware survey and is biased; StatCounter has no hardware data).
- No 2026 Copilot+ share figure; Q1 2025 figure is stale.
- No measured free-RAM or free-disk figures; Table 5 and disk figures are estimates and should be benchmarked.
- The Steam Windows 10 vs 11 conflict is unresolved; StatCounter data is used instead.
- StatCounter June 2026 had a large "Unknown" share, so OS shares are not fully stable.
- Many Chromebook/education statistics came from low-authority aggregator sites.
- Search results were summaries; figures were not cross-checked against the original vendor reports (IDC, Gartner, Canalys, Counterpoint).

## Sources

All accessed 2026-10-02.

| Source | URL | Data year |
|---|---|---|
| Steam Hardware and Software Survey (Sep 2026) | https://store.steampowered.com/hwsurvey/ | Sep 2026 |
| VideoCardz, RTX 5070 top GPU, 32 GB at 42% | https://videocardz.com/newz/geforce-rtx-5070-becomes-the-most-popular-gpu-on-steam-32gb-ram-reaches-42 | 2026 |
| Hardware Busters, 32 GB overtakes 16 GB | https://hwbusters.com/news/steam-hardware-survey-32gb-of-ram-finally-overtakes-16gb-and-the-rtx-5070-takes-the-gpu-crown/ | 2026 |
| StatCounter desktop OS share | https://gs.statcounter.com/os-market-share/desktop/worldwide/ | Sep 2026 |
| StatCounter desktop Windows versions | https://gs.statcounter.com/windows-version-market-share/desktop/worldwide/ | Sep 2026 (figures via search summary) |
| IDC, PC market 2026 memory shortage | https://www.idc.com/resource-center/blog/pc-market-enters-volatile-territory-as-memory-shortage-persists-through-2027/ | 2026 |
| Tom's Hardware, IDC slashes 2026 forecast | https://www.tomshardware.com/desktops/gaming-pcs/idc-slashes-2026-pc-shipment-forecast-amid-memory-shortages-total-pc-market-value-to-nonetheless-increase-to-usd274-billion-due-to-ongoing-price-hikes | 2026 |
| Tom's Hardware, Gartner 2026 declines (-10.4%) | https://www.tomshardware.com/tech-industry/2026-will-bring-sharpest-pc-declines-in-over-a-decade | 2026 |
| Resource Recycling, Q1 2026 shipments | https://resource-recycling.com/e-scrap/2026/04/23/pc-shipments-grew-in-q1-but-questions-remain/ | 2026 |
| Tom's Hardware, 8 GB laptops return | https://www.tomshardware.com/laptops/8gb-of-ram-is-back-on-laptops-companies-are-lowering-memory-offerings-to-make-affordable-notebooks-during-component-crisis | 2026 |
| XDA, 8 GB as new normal | https://www.xda-developers.com/memory-shortage-laptops-with-only-8gb-of-ram-could-soon-be-new-normal/ | 2026 |
| MacRumors, MacBook Neo outsold every other Mac | https://www.macrumors.com/2026/06/02/macbook-neo-outsold-every-other-mac/ | 2026 |
| MacRumors, IDC on MacBook Neo | https://www.macrumors.com/2026/06/03/macbook-neo-disrupts-a-pc-market-in-decline/ | 2026 |
| MacDailyNews, Apple Q2 2026 (6.7M Macs, 9.9%) | https://macdailynews.com/2026/07/08/apple-defies-pc-market-slump-with-10-1-growth-in-q2-2026-powered-by-macbook-neo/ | 2026 |
| Counterpoint, MacBook Neo and sub-$700 market | https://counterpointresearch.com/en/reports/Apple-MacBook-Neo-Set-to-Drive-7x-Surge-in-Sub-%24700-Market | 2026 |
| Microsoft, Copilot+ PC requirements | https://www.microsoft.com/en-us/windows/business/devices/copilot-plus-pcs | 2026 |
| Starry Hope, 4 GB Chromebook in 2026 | https://www.starryhope.com/chromebooks/4gb-chromebook-trap-2026/ | 2026 |
| About Chromebooks, schools statistics | https://www.aboutchromebooks.com/chromebooks-in-schools-statistics/ | 2025-2026 (aggregator, low authority) |
| Walmart best sellers, 8 GB/256 GB laptops | https://www.walmart.com/c/best-sellers/laptop-8gb-ram-256gb | 2026 (not fetched in detail) |
| asinsight, best-selling 8 GB laptops | https://www.asinsight.com/report/US/8gb-ram-laptop | 2026 (single secondary) |
| Enterprise lifespan / refresh (Gartner figures via blogs) | https://sobrii.io/blog/computer-lifespan-real-numbers-2026 | 2026 (secondary) |
