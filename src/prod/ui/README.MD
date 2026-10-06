*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# prod/ui

The production user interface. React, Vite and TypeScript, the same toolchain as [`prototypes/ui`](../../prototypes/ui/README.MD).

Status: **empty scaffold.** It builds and renders a heading, and nothing else. No prototype code has been promoted into it.

## Rules

This is the prod zone. Read "Human QA and the two zones" in [`CLAUDE.md`](../../../CLAUDE.md) first.

- **No Claude-written tests** until Steven has written his own for the feature. The runners (`vitest`, `playwright`) are configured and have no tests on purpose.
- **Nothing arrives from `prototypes/ui` without the promotion gate.** Do not copy or rewrite prototype code here on Claude's own initiative.
- Steven's tests carry him as author in the byline. Claude does not edit them.
- Lower-level tests sit next to the code (`.spec.` for domain behavior, `.test.` for tightly coupled UX), journey tests in `e2e/`, following [`src/README.MD`](../../README.MD).

## Commands

```
npm install
npm run dev        # http://localhost:5173 (Vite default)
npm run build      # tsc -b, then vite build
npm run typecheck
npm run lint
npm test           # vitest; passes with no tests
npm run test:e2e   # playwright on port 5174; passes with no tests
```
