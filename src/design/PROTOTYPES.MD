*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Prototype briefs: shared rules

Each prototype brief (`src/design/{layer}/PROTOTYPE.MD`) asks an implementer to build one layer alone, measure it, and report what was learned. Read this file first, then the brief.

The aim is **fast learning, not finished code.** The unknowns in this project live inside the models, so each prototype exists to replace a `to be set` in the layer's targets table with a measured number, and to find out where the spec is wrong.

## What a prototype is

- **One layer in isolation** (COM-ISL-001): recorded input in, captured output out, no other layer present.
- **Throwaway by default.** Keep what is reusable, but do not polish. If a prototype teaches that the design should change, that is a success.
- **Measured.** A prototype that runs but produces no numbers has not done its job.

## Before starting

1. Read `CLAUDE.md`. **An implementer chat is an implementer actor and MUST log every prompt** to `PROMPT_HISTORY/` as that file describes. Read `PROMPT_HISTORY/README.MD` first.
2. Read the layer's spec in `specs/{layer}/README.MD`, and `specs/common/README.MD`.
3. Read decisions [0001](../../docs/decisions/0001-minimum-spec-model-defaults.md) to [0003](../../docs/decisions/0003-transport-ui-and-service-architecture.md).
4. Read the research for your layer in `docs/research/` and the relevant parts of `SPEC.md` (§3.2.1, §3.2.2, §8).

## Where things go

| What | Where | Committed? |
|---|---|---|
| Prototype code | `src/prototypes/{layer}/` (one folder per layer, a subfolder per language if more than one) | Yes |
| Raw measurements | `benchmarking/results/prototypes/{layer}/` | No. Gitignored, generated, never edited by hand |
| Summary of findings | `docs/research/prototype-{layer}.md`, with a byline | Yes |
| Proposed spec changes | A "Findings for the spec" section in the summary | Yes. **Do not edit `specs/` yourself** |
| New model facts | A draft manifest in `ai-models/manifests/`, with sources | Yes |

`src/prototypes/` is deliberately separate from the future `src/` layout, which is not decided (`src/README.MD`).

## Rules

- **Answer the spec, and cite IDs** in code comments and in the report (for example `LST-TURN-003`).
- **Reference models by `ai-models/` id.** If one has no manifest, write a draft with its sources and `unverified` marks.
- **Respect the license filter** (`SPEC.md` §3.2). Do not add a model with a license question without saying so and asking.
- **Do not bundle weights.** Download at setup and record sizes and hashes.
- **Report cost with every result:** peak memory, CPU time, load time (COM-RES-001).
- **Report spread, not only the mean:** at least five repeats, with p50, p95 and the worst case, and a stated seed where randomness exists.
- **Record the environment** with every run: CPU, cores used, RAM, GPU and driver, OS, runtime and library versions, model file hashes, and free memory at the start.
- **Measure on two machines' worth of conditions.** Once on the dev machine as it is, and once imitating the minimum spec: 4 cores and the Tier 1 free-memory figure (`SPEC.md` §8.6, `SPEC.md` §8.2). On Windows, a processor affinity mask and a job object memory limit do this. Say how you did it.
- **Say what you could not do.** A skipped vector is listed by ID with the reason.
- **Raise questions** instead of guessing, especially about licensing and about anything that would change a spec.

## Fixtures

Real recordings do not exist yet. Steven plays both interviewer and interviewee and will record them (`benchmarking/README.md`, Datasets). Until then:

- Use **synthetic clips** (text read by a speech model) to exercise the mechanics and write down that they are synthetic.
- Use **public clips** only if their licenses allow and the source is recorded.
- Expect real recordings to change results, especially for listening and transcription. Mark all numbers from synthetic audio as such.

**Proposed fixture format** (to be confirmed in `testing/README.md`):

```
{name}.wav            16 kHz, mono, 16-bit
{name}.labels.json    speech spans, turn ends, and (where known) the reference transcript
```

Labels give times in seconds from the start of the file. Each fixture also records who made it, when, and how.

**Recordings that would help the first prototypes** (short, in Steven's own voice, a headset microphone and a laptop microphone if possible):

1. Ten seconds of silence, and ten seconds of room noise, with no speech.
2. A 20-second answer with a clean ending.
3. A 30-second answer with two or three mid-thought pauses (um, a breath, a stop to think).
4. An answer ending in a trailing "so..." followed, after a pause, by more speech.
5. A pause of about four seconds mid-answer, then the answer resumes.
6. A two- to three-minute monologue (for transcription length limits).
7. A list of technical terms read aloud (for example C#, Kubernetes, SQL, OAuth, async/await, a few names).
8. A short clip in another language (for the unsupported-language check).

## Reporting

The summary in `docs/research/prototype-{layer}.md` has:

1. What was built, and what was left out.
2. A table of the layer's targets with the measured values, spread, and the machine each came from.
3. The spec requirements checked, with pass or fail and the vector or evidence.
4. Surprises, in plain words.
5. **Findings for the spec:** changes the implementer proposes, each with the reason.
6. What the next layer should know.
7. What the prototype got wrong or cannot show.

## Definition of done (every prototype)

- The layer runs alone on recorded input and produces captured output.
- Every planned conformance vector in the layer's spec has been tried, or is listed as skipped with a reason.
- Every target in the layer's table has a measured value, or a stated reason it could not be measured.
- The summary is written, and the raw data is in the gitignored results folder.
- Every prompt handled by the implementer is in `PROMPT_HISTORY/`.
