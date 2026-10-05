*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Hardware fit and model selection (FIT)

Status: **first draft.** Also bound by COM-ISL, COM-FLT and COM-INP in [`specs/common`](../common/README.MD).

## Purpose

Measure the machine, choose for each slot the models that fit it, verify the choice on first load, and say plainly when a full local mode is not possible.

## Terms

| Term | Meaning |
|---|---|
| **Slot** | A role that needs a model: listening, transcription, interviewer, speech and so on |
| **Candidate** | One model, at one quality level, on one runtime, from the model registry |
| **Budget** | The memory left for a slot after the others have been reserved |
| **Rung** | One step down the size ladder of a family of models |
| **Placement** | Where a candidate runs: processor or graphics, and in which memory |

## Boundary

**Takes in**

- Facts about the machine: **free** memory (not installed), cores, accelerators and their backend, free disk
- The model registry (`ai-models/`): sizes, architecture, licenses, runtimes
- User preferences and overrides
- A declared machine description, used instead of measuring (for tests and for imitating a smaller machine)

**Puts out**

- A chosen candidate and placement for each slot, with the arithmetic behind it
- Or a verdict that local mode is not supported, with a fallback and the reason
- A plain-language explanation for non-technical users

**Not this layer's job:** running the models, or deciding which model is best at its job (benchmarking).

## Requirements

### Measuring

- **FIT-PRB-001** The layer MUST measure free memory, cores, accelerators with their backend, and free disk at the time of use, and MUST report the values it used.
- **FIT-PRB-002** The layer MUST accept a declared machine description in place of measuring, so tests and developers can imitate another machine.
- **FIT-PRB-003** The layer MUST re-measure on request.

### Selecting

- **FIT-SEL-001** For each slot the layer MUST choose the largest candidate that fits its budget, reserving the smaller slots first and the interviewer's model last.
- **FIT-SEL-002** For the same machine facts, registry and preferences, the selection MUST be the same every time.
- **FIT-SEL-003** The layer MUST support placing different slots in different memories (for example the interviewer on the graphics card and speech on the processor), and MUST treat shared memory as one pool.
- **FIT-SEL-004** The layer MUST NOT choose a candidate whose license has an open question as a default.
- **FIT-SEL-005** The layer MUST NOT choose candidates whose files do not fit in the free disk.
- **FIT-SEL-006** A user override MUST be honored, with a warning if the layer predicts it will not fit.

### Estimating

- **FIT-EST-001** Estimates MUST use the size of the exact file to be downloaded and the model's own architecture data, not a single general formula.
- **FIT-EST-002** The assumptions in an estimate (context length, runtime overhead, headroom) MUST be stated and MUST be adjustable.
- **FIT-EST-003** The layer MUST show the breakdown behind each estimate.

### Verifying

- **FIT-VER-001** On first load, the layer MUST compare the measured memory with the estimate. If the choice exceeds its budget, the layer MUST step down one rung and try again, and MUST record the difference.
- **FIT-VER-002** If no candidate fits some slot, the layer MUST report that local mode is not supported and offer a fallback (such as text-only or a remote backend). It MUST NOT fail with an error.

### Telling the user

- **FIT-USR-001** The layer MUST give a plain-language explanation of what was chosen and why, and of why it did not choose a larger model.
- **FIT-USR-002** The layer MUST show each model's license before it is downloaded.

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| FIT-TGT-001 | Time to measure and select | to be set |
| FIT-TGT-002 | How far estimates differ from measured memory | to be set |
| FIT-TGT-003 | Default headroom, context length and overhead | **[unverified]** about 2 GB, 8K tokens, about 0.5 GB (`SPEC.md` §8.3) |
| FIT-TGT-004 | The memory and cores that define each tier | **[unverified]** `SPEC.md` §8.2 |

## Conformance vectors (planned)

The vectors use declared machine descriptions, so they run anywhere.

1. A machine with 4 cores and 6 GB free: the minimum-spec choices (FIT-SEL-001).
2. 4 GB free: the constrained choices, or an unsupported verdict (FIT-VER-002).
3. 16 GB graphics memory and 64 GB RAM: the interviewer on the graphics card, speech on the processor (FIT-SEL-003).
4. Shared memory machine: treated as one pool (FIT-SEL-003).
5. A registry containing a model with a license question: never the default (FIT-SEL-004).
6. Not enough free disk (FIT-SEL-005).
7. The same inputs twice: the same output (FIT-SEL-002).
8. A load that uses more memory than estimated: one rung down (FIT-VER-001).
9. An override that will not fit (FIT-SEL-006).

## Running alone

Feed a declared machine description and a registry. Capture the selection and its explanation. Compare to the expected choices. No model needs to be loaded for selection. Verification uses a stand-in that reports a chosen memory figure.

## Assumptions about neighbouring layers

- The registry's facts are right for the files that will be downloaded.
- Each model-backed layer reports its measured memory and load time (COM-RES-001).

## Open questions

1. Measured free memory and disk on real machines (`SPEC.md` §12 item 10).
2. Whether memory and speed are enough, or the choice also needs the measured speed of the machine.
3. What the fallback is for machines with no local mode: text-only, a remote backend, or both.

## Source

`SPEC.md` §8 and `docs/research/`.
