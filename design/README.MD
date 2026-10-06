*Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.*

# Design

Developer-ready designs for the project. Not code: nothing here belongs to the prototype or prod code zones (`src/prototypes/`, `src/prod/`).

## Lifecycle

1. **Prototype on the canvas.** Design exploration and iteration happen on a claude.ai Design canvas, which owns the work in progress. Drafts, alternatives and half-decided ideas stay there.
2. **Commit when developer-ready.** When Steven calls an iteration ready for developers, a snapshot of the canvas is committed here, under `mockups/<area>/`, with a README naming the iteration, the canvas link, and its caveats.
3. **Build from the repo copy.** Developers (and the prototype UI) work from the committed snapshot, not the live canvas, so a design only changes for them when a new iteration is committed.

A new iteration replaces the previous snapshot in place; git history keeps the earlier ones.

## Contents

- [`mockups/ui/`](mockups/ui/README.MD): interviewer cues, iteration 1 (2026-10-06).
