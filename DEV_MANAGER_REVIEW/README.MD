*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Development Manager Review

**Status: draft protocol, proposed by Claude on Steven's request (2026-10-07). Steven has not yet adopted it.** Every number and threshold below is a proposal.

## Why this exists

Claude writes code faster than Steven can read it, so comprehension lags behind output. Tests do not close the gap: a green suite Claude wrote is not independent evidence (see "Human QA and the two zones" in [`CLAUDE.md`](../CLAUDE.md)), and Steven's own tests only cover behavior he thought to test. The risk named here is Steven porting prototype code to prod because the tests pass, without having read it.

This protocol adds a second, separate gate: **a person has read every file, and said what it does in their own words.** It sits beside the promotion gate. It does not replace Steven's tests, and a passing test run never satisfies it.

## The rule

A file in `src/prod/` is accepted only when the ledger holds an **approved** review of its **exact current content**. Edit one character and it needs a new review. The check is `node tools/review.mjs check`, and it is the same on Steven's machine, in the pre-commit hook and in CI.

Two properties follow from hashing the content, not the path:

- A prototype file Steven reviewed and Claude then copies into prod **unchanged** passes. Any edit at all (an import path included) needs a new review, so a promotion shows up as small diffs to read, not a rewrite to trust.
- A review never goes stale silently. Changing a reviewed file turns it back to `changed-since-review`.

## Who does what

| | Steven (the reviewer) | Claude |
|---|---|---|
| Reads each file | Yes. Every file, config and CSS included | No substitute |
| Records a review (`stamp`) | Yes, by running the command himself | **Never.** Not by command, not by editing `LEDGER.LOG`. The tool refuses when it detects a Claude Code session, which is best effort only |
| Calls out patterns | Yes, in [`PATTERNS.MD`](PATTERNS.MD) | Proposes candidates, marked as proposals |
| Prepares a review brief | Asks for one | Writes it on request (below) |
| Moves code to prod | Approves the move | Only after the promotion gate in `CLAUDE.md`, and the review gate must pass |

The ledger is protected twice: `.github/CODEOWNERS` requires Steven's approval to change `DEV_MANAGER_REVIEW/` or `src/prod/`, and the hooks and CI run the gate.

## Reviewing a file

1. **Ask for a brief** if you want one (below), or just open the file.
2. **Read it.** Read the file, not the summary.
3. **Say it back.** Write what the file does in your own words. This is the step that proves comprehension; it goes in the stamp's note.
4. **Call out patterns.** Anything you want standardized, or want banned, goes in [`PATTERNS.MD`](PATTERNS.MD). Cite pattern IDs in the note.
5. **Stamp it** from the repo root:

```
node tools/review.mjs stamp src/prototypes/ui/src/core/setup/setupState.ts approved "Holds the setup form's local state as a reducer; role/resume validation are derived from it, never stored twice. P-004, P-006."
node tools/review.mjs stamp src/prototypes/ui/src/ui/SetupPage.tsx changes "Does fetching and layout in one component; split. P-002."
```

`approved` means you read it and understand it. `changes` means it must not go to prod as it stands. The note is required.

A `changes` verdict is a to-do for Claude: fix, then Steven re-reads. The old verdict stays in the ledger and the new content is `changed-since-review` until re-stamped.

## The ledger

[`LEDGER.LOG`](LEDGER.LOG), newest first like the prompt history. One line per review, never edited:

```
{YYYY-MM-DD HH:MM:SS} | {content hash, 16 hex} | {approved|changes} | {path} | {reviewer} | {note}
```

Line endings are normalized before hashing, so Windows and Linux agree. Lockfiles (`package-lock.json`) and `.gitkeep` are not reviewed; everything else is.

## Seeing where you are

```
node tools/review.mjs status                          # src/prototypes
node tools/review.mjs status src/prototypes/ui/src/core
node tools/review.mjs check                           # the gate, for src/prod
```

`status` lists each file as `unreviewed`, `reviewed`, `changed-since-review` or `changes-requested`, with line counts, so the size of the comprehension backlog is visible.

**Suggested order (proposal): leaves first.** Contract types, then pure logic, then adapters, then components, then tests, then config. A file that imports nothing unreviewed is easiest to judge. For the UI prototype that is `core/contract/` → `core/setup/` and `core/cues/` → `core/ports.ts` → `adapters/` → `ui/` → tests and e2e → config and CSS.

## The review brief (on request)

When Steven asks for a brief on a file, Claude writes one in chat, not to a file, with:

- What the file is for and which contract, spec or requirement IDs it answers.
- What it imports and what imports it.
- **What Claude guessed, simplified or left unwired**, and anything it is unsure of. This list is the most valuable part.
- Patterns from `PATTERNS.MD` it uses, and candidate new ones.

The brief states no conclusion ("this is correct") and no expected results, so it does not lead the review. It may point to places to look.

## Guards

| Guard | What it stops | Strength |
|---|---|---|
| `tools/review.mjs check` | Any `src/prod/` file without an approved review of its current content | Mechanical |
| Pre-commit hook, `.githooks/pre-commit` | Committing such a file locally | Mechanical, opt-in: run `git config core.hooksPath .githooks` once |
| CI, `.github/workflows/review-gate.yml` | Merging such a file | Mechanical once the workflow is enabled and the check is marked required in the repo settings |
| `.github/CODEOWNERS` | Changing the ledger or prod without Steven | Mechanical once branch protection requires code owner review |
| `stamp` refuses under Claude Code | Claude recording a review by accident | **Best effort.** Claude could edit the file; the rule, the CODEOWNERS entry and the diff in review are the real backstop |
| `CLAUDE.md` rules | Claude copying code to prod or touching the ledger | Instruction only |

The two repo-setting guards (required check, required code owner review) are GitHub settings Steven turns on. Neither is configured by files in the repo.

## Open

- **First run.** `src/prod/ui` already holds 13 scaffold files, none reviewed, so the gate fails today. That is the point; it also makes them a good dry run of the protocol (about 210 lines in all, mostly config).
- **Per file or per behavior?** This gate is per file. `CLAUDE.md` leaves open whether "sufficiently tested" is per behavior or per line; the two are independent.
- **Prototype files.** Reviewing prototype files is optional until they are promoted, but a review done early is reusable (same content hash). Steven may want to review them as they appear, to keep the backlog from growing.
- **Whether `changes` should block** reviewing dependents. Currently it does not.
