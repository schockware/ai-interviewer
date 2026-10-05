*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Prototype brief: listening (LST)

Read [`../PROTOTYPES.MD`](../PROTOTYPES.MD) first. Turn-taking is the problem the project exists to fix, so this is the second prototype.

## Goal

Find out how well a speech-activity detector and an end-of-turn model decide when the user has finished, how fast, and at what cost on a 4-core machine. Compare them to the simplest possible baseline, a plain silence timer, so the value of the smarter model is visible.

## Spec to answer

[`specs/listening/README.MD`](../../../specs/listening/README.MD) and [`specs/common/README.MD`](../../../specs/common/README.MD).

| Priority | Requirements |
|---|---|
| High | LST-ACT-001, -003; LST-TURN-001 to -007 |
| High | LST-STR-001, -002; COM-RES-001; COM-INP-001 |
| Medium | LST-CTRL-001, -002; LST-CFG-001 |
| Low | LST-ACT-004 (needs interviewer audio marked as playing; fake it with a marker) |

## Scope

**In**

- A harness that feeds a recorded audio file as a **timestamped stream in real time and as fast as possible**, and captures speech start and stop events and end-of-turn decisions as a list.
- Three implementations behind the same boundary:
  1. **Baseline:** speech activity plus a fixed silence timer.
  2. **Default (Tier 1 and dev machine):** Silero VAD with the Smart Turn v3.2 end-of-turn model, int8, on CPU (`SPEC.md` §3.2.1).
  3. **Optional:** another end-of-turn approach if one fits the license filter, and only if you have time. Do not add one with a license question.
- Push-to-talk and "give me a sec" as control events in the harness.
- A scorer that compares captured decisions with the fixture labels and computes false cutoffs, missed ends and delay.

**Out**

- Transcription, any other layer, the browser, audio capture. Read files.
- Tuning for a particular speaker. Record what the settings do, and do not overfit.

## Questions this prototype must answer

1. How much does the end-of-turn model reduce false cutoffs compared with the silence timer, at the same delay?
2. What is the delay from the true end of speech to the decision (LST-TGT-001), for each implementation, and what does it consist of (the silence needed plus the model's own time)?
3. What does the model cost on 4 pinned cores: time per decision, CPU load, memory (LST-TGT-004)? The only published latency was measured on an Apple M5 Pro, so this is the first x86 4-core figure.
4. Which settings matter, and what are sensible defaults (LST-CFG-001)?
5. What does the layer do with a mid-answer pause of four seconds, a trailing "so...", and a long hesitation? Which of these defeat it?
6. How does it behave with the user's own laptop microphone versus a headset, and with room noise?
7. Is the confidence it reports useful? Does a low confidence line up with real false cutoffs?
8. Does anything in LST-TURN-005 (new speech after a decision) make the decision hard to retract in practice?

## Measurements to produce

| Target | Measure |
|---|---|
| LST-TGT-001 | Delay from true end of speech to decision, p50 / p95 / worst, per implementation |
| LST-TGT-002 | False cutoff rate on the fixtures |
| LST-TGT-003 | Missed-end rate on the fixtures |
| LST-TGT-004 | Time per decision and CPU load on 4 pinned cores, and on the dev machine unpinned |
| COM-RES-001 | Load time and resident memory |

State the number and kind of fixtures behind each rate. Rates on a handful of synthetic clips are indicative at best.

## Conformance vectors to run

The nine in the spec, each as data: a fixture plus an expected observation. The first six need the recordings listed in the shared rules. Use synthetic stand-ins and mark them.

## Candidate technology

- Python, with ONNX Runtime for the models (decision 0002).
- Models by manifest id: Silero VAD v6 and Smart Turn v3.2 int8. Draft manifests if missing.
- Pin cores and limit memory as described in the shared rules.

## Deliverables

- Code in `src/prototypes/listening/`.
- The scorer and the fixture format, as proposals.
- `docs/research/prototype-listening.md` as in the shared rules.

## Done when

The shared definition of done holds, all three implementations (or two plus an explained absence) run behind the same boundary, and the report says plainly whether the end-of-turn model is worth its cost on the minimum-spec machine.
