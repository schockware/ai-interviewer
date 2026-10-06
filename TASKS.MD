*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Tasks

The working list. [`ROADMAP.MD`](ROADMAP.MD) holds direction; this holds what is open right now. Seeded 2026-10-06 from a scan of the docs. File and line pointers come from that scan and are approximate; the scan did not read every spec in full, so check an item at its source before acting on it.

Tags: **S** Steven decides. **C** Claude can do it unaided. **S/C** Claude proposes, Steven confirms. Done items move to the bottom with a date.

## 1. Human QA and the prod zone

- [ ] **S** Per behavior or per line: how is "sufficiently tested" judged? ([CLAUDE.md](CLAUDE.md), Human QA section)
- [ ] **S** Write the first human tests for `src/prod/ui`. Nothing can be promoted until some exist.
- [ ] **S/C** Create the QA ledger and the per-feature QA contract with the first promotion (agreed minimum test set per feature).
- [ ] **C** Draft run-steps (no expected results) for the cue and pause behavior, as a starting point for Steven's tests.
- [ ] **C** Name an owner for reviewing OPEN lines in the `.AUDIT` file (CLAUDE.md, audit rule).

## 2. Decisions for Steven (the product shape)

- [ ] **S** Where do whiteboard and code review fit: segments of the 45-60 minute interview, or separate modes? (ROADMAP.MD ~82)
- [ ] **S** Are the LeetCode and design-pattern modes part of the verbal interview or standalone? (ROADMAP.MD ~83)
- [ ] **S** Does the 10-15 minute screen have a defined output (score, notes, pacing) or is it pure practice? (ROADMAP.MD ~84)
- [ ] **S** Behavioral de-escalation interview: practice only, or is feedback feasible? (ROADMAP.MD ~38)
- [ ] **S** Place or drop the "Ideas to place" in ROADMAP.MD section 2.
- [ ] **S** The interview content and structure layer sits above the interviewer and session and is "not yet specified". (specs/README.MD ~62)
- [ ] **S** Fallback for machines with no local mode: text-only, a remote backend, or both. (specs/fit ~107)

## 3. Architecture

- [ ] **S** Folder layout for three languages in one repo: per language or per layer. (src/README.MD, src/design/README.MD)
- [ ] **S** What the data layer stores and where. (decision 0003)
- [ ] **S** ai-models manifest format (YAML assumed), schema, seeding, keeping it current. (ai-models/README.md)
- [ ] **S** Confirm the layer-to-language mapping, including the audio I/O language. (decision 0002)
- [ ] **S/C** Language-neutral test runner, or one runner per language reading shared vectors. (decision 0002; testing/README.md)
- [ ] **S/C** How layers are packaged so each runs and tests alone. (src/README.MD)
- [ ] **S/C** Browser echo cancellation settings and the fallback for a poor microphone. (decision 0003; specs/audio-io, cues, listening)
- [ ] **S/C** Fit calculator threads: where it lives, estimate versus measure, headroom rule, which resource sets the minimum spec, mixed CPU/GPU, free VRAM off CUDA. (docs/discussions/2026-10-02-hardware-fit-and-model-sizing.md)
- [ ] **C** How C# supervises Python workers: start-up, health checks, restart, shutdown. (decision 0003)
- [ ] **C** Where the gRPC contract files live so all three languages generate from one source. (decision 0003)
- [ ] **C** Audio frame format and size over the WebSocket, and backpressure. (decision 0003; src/design/events)
- [ ] **C** Check SPEC.MD ~119: the scan reports it still says transport is "not decided" though decision 0003 settled it. Fix if confirmed.
- [ ] **C** Decision 0001 risks: Kokoro on 4 cores, whisper.cpp base is not streaming, no combined-stack benchmark, native OS speech as a Tier 0 fallback never researched.

## 4. Contracts (the lesson learned)

The typed contracts were skipped. This is the largest gap and the thing that makes behavior testable.

- [ ] **S/C** Decide the "Findings for the spec" in docs/research/prototype-ui.md. Item 1 (milliseconds) is decided. Items 2-11 are not: session id, stream header, frame links, malformed-event handling, `replaces` on partials, control requests versus events, `reason` on state events, turn policy in session config, silence length on `turn_decision`, snapshot type.
- [ ] **C** Write the typed contracts once those are decided.
- [ ] **S/C** Events: late join (replay only, or also a snapshot), whether audio travels with the frame event, schema in the spec or a shared file, retention and personal data (S). (specs/events)

## 5. UI prototype (Claude-run, unverified)

- [ ] **C** Talking-cue hold (CUE-MOD-005, CUE-TGT-001) and the dropped-frame and clipped-ending scripts.
- [ ] **C** Captions (including size and contrast controls) and the sound beds (room tone, scribbling).
- [ ] **C** Reset-settings link, simulation badge and first-use explanation.
- [ ] **C** A perceived-delay simulator (a test helper adds 800 ms as a stand-in).
- [ ] **C** Unchecked WCAG items: radio and checkbox target size, 200 and 400 percent zoom, focus visibility, dark-theme contrast, reduced motion. (src/prototypes/ui/audit/main-page.md)
- [ ] **S** A screen-reader pass on the live region, and a real keyboard-only walk. These need a person.
- [ ] **S** Research screen reader timing for real-time UI changes; it sets the SPEC.md §4.3 defaults. (SPEC.md §12 item 14)
- [ ] **S/C** Carry SPEC.md §4.2 (Accessibility button, focus lands first) and §4.3 (screen reader mode gating) into `specs/cues` as requirement IDs.
- [ ] **C** Measure the cost of refolding the log at about 100 frame events a second.
- [ ] **C** Own Clock port versus Vitest fake timers (leaning own port); whether the audit log is hand-written or generated. (docs/research/ui-testing-tools.md)

## 6. Per-layer spec questions

Each lives in its own `specs/{layer}/README.MD` under Open questions. The big ones for Steven:

- [ ] **S** Double-talk policy: session or simulator (listed in both).
- [ ] **S** Whether the transcription layer is told the question (context-leak risk); whether speech is told the intended emotion; pronunciation control and who maintains it.
- [ ] **S** Follow-up: two decisions or a third "offer a hint"; own model or the interviewer's with another prompt.
- [ ] **S** Interviewer: how the plan reaches the layer; may it say it did not understand.
- [ ] **S** Evaluator: rubric authoring, versioning and location; a stronger model than the interview used; wording feedback without false certainty.
- [ ] **S** Common: should COM-DET-001 be a MUST for non-model layers.

## 7. Unverified values and research

Values marked `[unverified]` in the specs are proposals. They are the ones that most need Steven's judgment. Full list: SPEC.MD section 12.

- [ ] **S** Tune by ear: simulator presets (SIM-TGT-003), pause presets, the talking-cue hold of about 300 ms (CUE-TGT-001), the listening target of about 0.2 s (LST-TGT-001), the probe limit (FUP-TGT-004).
- [ ] **S** Fit defaults (FIT-TGT-003, FIT-TGT-004), checked against real 8 and 16 GB machines.
- [ ] **S** User testing of the perceived-to-true-state transfer hypothesis (SPEC.MD section 12, item 8).
- [ ] **C** Benchmarks: Smart Turn, Kokoro and a 3-4B LLM together on 4 cores; time to first token on 2-4K prompts; Gemma 4 KV-cache sizing.
- [ ] **C** Verify from a source: the ITU G.114 figure of about 150 ms (recalled from memory), Blackwell CUDA and PyTorch minimums, non-CUDA GPU backends, packet-loss and concealment rates, WCAG 2.2 mapping.
- [ ] **S** Piper licensing (only matters if Piper is re-added; sources conflict).

## 8. Testing and benchmarking

- [ ] **S** Who labels turn boundaries, probe versus move-on decisions and scores, and how a second pass checks them. (benchmarking/README.md)
- [ ] **S** How interviewer and evaluator quality is judged; a model judge adds bias and must be fixed, versioned and spot-checked.
- [ ] **S** Fixture format and naming for mock interviews; the recordings come from Steven.
- [ ] **C** Contract tests on GPU-less CI; the first benchmark targets; a speech naturalness metric.

## Done

- 2026-10-05: Human QA rules and the two zones (CLAUDE.md).
- 2026-10-05: `src/prod/ui` scaffold (empty, no tests).
