*Authored jointly by Steven Chock and Claude Sonnet 5.5 (Anthropic): Steven decides, Claude drafts and proposes.*

# Patterns registry

The conventions Steven wants standardized (or banned) across the code, found while doing [Development Manager Review](README.MD). A pattern is **proposed** until Steven marks it. Claude may add candidates, always as `proposed`. **Only Steven changes a status.**

Status: `proposed` (Claude saw it, Steven has not judged it), `adopted` (follow it), `rejected` (do not use it), `revise` (Steven wants it changed, see the note).

How to use it in a review: cite IDs in the stamp note. When Claude writes new code, it follows `adopted` patterns and does not follow `rejected` ones. `proposed` ones are not yet rules.

Entry format:

```
## P-{nnn} {name}
Status: {proposed | adopted | rejected | revise}
Rule: {one or two sentences}
Seen in: {files}
Why (Claude's guess, unless Steven says otherwise): {...}
Steven's call: {blank until he writes one}
```

Seeded 2026-10-07 from the UI prototype by Claude. All are proposals; none has been reviewed.

---

## P-001 Core, adapters, UI: layers that only look inward
Status: proposed
Rule: `core/` is plain TypeScript and imports nothing from `adapters/` or `ui/`. Adapters implement ports declared in `core/ports.ts`. `ui/` renders what it is given and decides nothing.
Seen in: `src/prototypes/ui/src/core/ports.ts`, the layout table in `src/prototypes/ui/README.MD`, decision 0003.
Why: keeps the interesting logic testable without a browser and swappable without a rewrite.
Steven's call:

## P-002 Pages hold state and talk to a port; components render
Status: proposed
Rule: A page component loads data, holds state and calls a port. Sections inside it take props and render. Business rules live in `core/`, not in the component.
Seen in: `SetupPage.tsx`, `HardwarePage.tsx` (both are large: about 470 and 290 lines, and mix layout with orchestration, so they may be breaking this).
Why: a guess. Claude could not tell where to draw the line; the pages are the weakest example.
Steven's call:

## P-003 Explicit unions, no null or boolean flags
Status: proposed
Rule: Model states as a discriminated union with a `type` (`{ type: 'loading' } | { type: 'ready', … }`). Avoid `null`, `undefined` and booleans as meaning. This is the motto at the top of `contracts/page-flow.md`.
Seen in: `core/contract/pageFlow.ts`, `core/setup/hardware.ts` (`CheckPhase`). **Not followed** in `setupState.ts`: `resumeId: ResumeId | null` and `resumeProcessing: string | null` are nullable fields.
Why: it is Steven's own rule, so Claude applied it unevenly.
Steven's call:

## P-004 Derive, never store twice
Status: proposed
Rule: Where the contract defines a validation state (`ResumeValidation`, `JobDescriptionValidation`), compute it from the page's state with a pure function. Do not keep a second copy.
Seen in: `core/setup/setupState.ts` (`interviewTypeOf`, `roleValidation`, `blockers`).
Steven's call:

## P-005 Pure reducer plus spec for domain rules
Status: proposed
Rule: Rules about behavior sit in a pure function or reducer in `core/`, with a `.spec.ts` that cites the contract or requirement ID. Components get `.test.tsx` only for UX and wiring (the `.spec.`/`.test.` convention in the prototype README).
Seen in: `setupState.ts` / `.spec.ts`, `hardware.ts` / `.spec.ts`, `core/cues/reducer.ts`.
Steven's call:

## P-006 `aria-disabled` plus a visible reason, not `disabled`
Status: proposed
Rule: A button that cannot act yet stays focusable with `aria-disabled="true"`, ignores the click, and a nearby list says why. Applies to Prepare interview, Start interview and Load resume.
Seen in: `SetupPage.tsx`, `HardwarePage.tsx`.
Why: the mockups do it; a `disabled` button hides the reason from keyboard and screen reader users. Claude has not tested this with a screen reader.
Steven's call:

## P-007 Words beside every icon; icons are `aria-hidden`
Status: proposed
Rule: Icons are decoration. The words carry the meaning. Never colour alone (CUE-RED-002).
Seen in: `icons.tsx`, `CuePanel.tsx`, `HardwarePage.tsx` (chip marks).
Steven's call:

## P-008 Harness cards for prototype-only controls
Status: proposed
Rule: Controls that exist only to drive the prototype (scenario, mock server failures, mock device results) live in a card titled "Prototype harness", never in the mockup's own UI, and never go to prod.
Seen in: `CallConditions.tsx`, `SetupPage.tsx` (`Harness`), `HardwarePage.tsx`.
Why: lets every state on the boards be reached by hand. A promotion must strip them.
Steven's call:

## P-009 Mock host behind a port, driven by an injected clock
Status: proposed
Rule: The scripted server implements the real port and takes a `Clock`, so tests advance time by hand instead of waiting.
Seen in: `adapters/mock/mockSetupHost.ts`, `adapters/simulatedClock.ts`.
Steven's call:

## P-010 Native `<dialog>` for modals
Status: proposed
Rule: Use the platform's `<dialog>` with `showModal()` for focus trapping and Escape handling, not a hand-built overlay.
Seen in: `AccessibilityDialog.tsx`, `ModalDialog.tsx`. Two implementations exist; `AccessibilityDialog` does not use `ModalDialog` (duplication).
Steven's call:

## P-011 Plain CSS in one file, tokens as custom properties
Status: proposed
Rule: One stylesheet, colour and tone as CSS custom properties, class names per component. No CSS framework.
Seen in: `src/index.css` (about 840 lines, growing).
Why: matches the mockups' values, quick to write. Probably needs splitting per component before prod.
Steven's call:

## P-012 Byline on every file; requirement IDs in comments
Status: proposed
Rule: Per `CLAUDE.md`, a byline at the top. Code comments cite requirement IDs where one applies (CUE-ANN-001).
Seen in: the setup and hardware files carry it. Many older ones (`CuePanel.tsx`, `InterviewPage.tsx`, `useCueEngine.ts`, much of `core/contract/` and `core/cues/`) do not.
Steven's call:

## P-013 One composition root picks mock or real, per port
Status: proposed
Rule: Only `src/composition/` knows which adapter backs a port. Mode is read once, a bad value is an error, and the page says what is real. Core and UI never import an adapter for their own use.
Seen in: `composition/integration.ts`, `composition/hosts.ts`, `ui/IntegrationBar.tsx`. Decision 0004 (proposed).
Steven's call:

## P-014 One contract suite per port, run against the mock and the real adapter
Status: proposed
Rule: Behavior every implementation must share is written once (`adapters/setupHostContract.ts`) and registered for each adapter. The real run lives in `*.integration.spec.ts` and skips loudly.
Seen in: `adapters/setupHostContract.ts`, `mock/mockSetupHost.contract.spec.ts`, `http/httpSetupHost.integration.spec.ts`.
Why: it caught the mock forgetting uploads, and a UI message keyed off the mock's id format.
Steven's call:

## P-015 Tests for real integrations are separate files and commands
Status: proposed
Rule: `*.integration.spec.ts` (vitest) and `*.real.spec.ts` (Playwright) run only through `test:integration` and `test:e2e:real`, never in the default run. An unreachable dependency skips loudly, or fails under `INTEGRATION_REQUIRED=1`.
Steven's call:

## P-016 Env files are public config; secrets never touch them
Status: proposed
Rule: `.env` files hold a mode and addresses only, every name `VITE_`-prefixed and not secret-sounding, enforced by a test. Credentials live in the server process, injected from a secret manager or the OS keychain.
Seen in: `.env.example`, `.env.real`, `composition/envFiles.spec.ts`, decision 0004.
Steven's call:

