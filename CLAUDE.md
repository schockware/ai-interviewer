*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# ai-interviewer: project rules

See `SPEC.MD` for the vision and initial specifications.

## Authorship

Put a byline at the top of files. If Claude created the file fresh, Claude is the author and Steven Chock is co-author. If Steven created it first, Steven is the author and Claude is co-author. If ownership of the sections has become muddied, call it joint authorship. Use the current Claude model name.

## Implementer actors and the prompt history

A chat acts as an **implementer actor** when it takes specifications and performs code (designs, implementations, conformance runs) rather than authoring specs. Every implementer actor MUST log each prompt it handles. Definitions, disclaimers, and rationale live in `PROMPT_HISTORY/README.MD`; read it before the first entry.

Everything lives in `PROMPT_HISTORY/`, split by month. `{YYYY-MM}` is the month of the entry's own heading time (local time):

- `PROMPT_HISTORY/{YYYY-MM}.LOG` is committed. It holds the **summary prompt**, never the original text.
- `PROMPT_HISTORY/{YYYY-MM}.REDACTED` is gitignored. It holds the **original prompt, redacted**, under the same entry heading.
- `PROMPT_HISTORY/{YYYY-MM}.AUDIT` is gitignored. It holds one line per entry whose redaction needs supplemental review. It never contains the redacted content, only categories.
- `PROMPT_HISTORY/AUDIT.EXAMPLE` is committed and holds a sample audit line for reference. Never write real audit lines to it.

Rules:

- **Order:** newest entry first in every file. Prepend directly under the header line; never append and never rewrite older entries.
- **New month:** if the month's file does not exist, create it with a one-line header (`PROMPT HISTORY {YYYY-MM} (newest first; see PROMPT_HISTORY/README.MD)`, and the `REDACTED` or `AUDIT` equivalent), then a line of `---`. Never touch earlier months' files.
- **Every prompt:** log each prompt, including questions and discussion. When no files changed, the action is `no code changes`. Skip only prompts whose purpose is to change the logging process itself (the `PROMPT_HISTORY/` files, their rules, or this section). Record such a change under "Process changes" in `PROMPT_HISTORY/README.MD`.
- **Transcription exception:** when the chat is only transcribing for the user (no contribution from Claude), prompts are not logged. If Claude offers a suggestion and the user takes it, that prompt is logged like any other. Record this change under "Process changes" in `PROMPT_HISTORY/README.MD`.
- **When:** write the entry at the end of handling a prompt, before the final reply. If several prompts arrive in one turn, write one entry per prompt. Include the log in the same commit as the work when a commit is made.
- **Time:** get the local time from the shell: `date "+%Y-%m-%d %H:%M:%S"` for the heading and `date "+%Y-%m"` for the file name. Do not guess it.
- **Gitignore check:** before writing to a `.REDACTED` or `.AUDIT` file, confirm `git check-ignore` reports it. If it does not, fix `.gitignore` first.
- **Redaction:** replace secrets, credentials, tokens, keys, identifiers (UUIDs, account IDs), personal data, and pasted third-party content with `[REDACTED:{category}]` in the `.REDACTED` file. Redaction is best effort, and the gitignore is the backstop.
- **Entry format** for the `.LOG` file (entries separated by a line of `---`):

```
## {YYYY-MM-DD HH:MM:SS} | {model name and ID}
Summary prompt: {one to three sentences of what was asked, in the third person ("asked to..."); no verbatim quotes}
Redaction check: {passed | what was removed, by category}; original in the matching .REDACTED entry
Actions: {files created or changed, requirement IDs answered, commands run, anything skipped or failing; or "no code changes"}
Tokens: ~{N} (derived: counter {start} -> ~{end} | estimated)
---
```

- **Audit line:** if anything was redacted, or you are unsure whether something should have been, prepend one line to the month's `.AUDIT` file: `{YYYY-MM-DD HH:MM:SS} | {model} | {categories} | {why review is needed} | OPEN`. Entries with nothing redacted get no line. When a human reviews one, prepend a new line `{date time} | REVIEWED {heading time of original} | {outcome}`; never edit older lines.
- **Entry format** for the `.REDACTED` file: the same heading line, then `Prompt: {original prompt, redacted}`, then `---`.
- **Token tally:** use `~` on every figure and round to the nearest 100. Prefer a derived figure, the drop in the visible "tokens left" counter across the prompt; otherwise label it `estimated`. The counter restarts for each prompt, so do not record a "remaining" figure. The tally excludes the cost of writing the entry itself, and the counter can move unpredictably, so treat it as approximate.
- **Model:** use the current model name and ID, as in the Authorship rule.
- No file in `PROMPT_HISTORY/` except `README.MD` has a byline, because the newest entry must stay at the top and each entry names its model.

## Human QA and the two zones

Generated code outpaces what Steven can verify with domain knowledge, and a green suite Claude wrote for its own code is not independent evidence. So trust is split by zone.

**Prototype zone** (`src/prototypes/`): Claude has free rein, as a junior developer would. Claude writes the code and the tests, and nothing here counts as verified. Everything in it is throwaway until promoted.

**Prod zone** (`src/prod/`; so far only the empty `src/prod/ui` scaffold, nothing promoted): no line is accepted until Steven has tested it sufficiently.

Rules:

- **Moratorium on Claude-written tests in prod.** Until Steven has written his own tests for a feature, Claude writes no tests in the prod zone. Steven writes them from the spec and his expected behavior, before reading Claude's implementation or prototype tests. Prod test files Steven wrote carry him as author in the byline. Claude never edits them; if one fails, Claude reports it and fixes the code.
- **Claude's own battery, by agreement.** Once Steven and Claude agree a minimum human test set for a feature (recorded in the feature's QA contract), Claude may add its own tests on top. They are labeled as Claude-written and never count toward the minimum.
- **Pulling prod into a prototype is free.** Claude may copy or adapt prod code into the prototype zone with no gate. The copy is prototype code and is not verified.
- **Promotion from prototype to prod is gated.** Claude never moves, copies or rewrites prototype code into the prod zone on its own. Promotion needs Steven's go-ahead for that feature, the agreed minimum human tests written and passing, and an entry in the QA ledger naming the feature, the commit, and what Steven verified. Claude may propose a promotion and list what would need testing, written as steps to run and not as expected results, so it does not lead Steven.
- **Mark guesses.** Values that come from unverified research (for example the pause presets) are labeled as proposals wherever they appear, so Steven knows which ones need his judgment first.
- **Scope.** Applies to observable behavior and to anything that touches a requirement ID. Pure refactors and plumbing in prod must still not change behavior covered by Steven's tests.

The QA ledger and the per-feature QA contract are created with the first promotion; until then, no code has been promoted. Open: whether "sufficiently tested" is judged per behavior (current assumption) or per line.

## Development Manager Review

A second gate beside the QA zones, because generated code outpaces Steven's reading and a green test run is not comprehension. Draft protocol, proposed 2026-10-07 and awaiting Steven's adoption. The full text is in `DEV_MANAGER_REVIEW/README.MD`; the rules for Claude are:

- **A prod file is accepted only when `DEV_MANAGER_REVIEW/LEDGER.LOG` holds an approved review of its exact current content.** `node tools/review.mjs check` is the gate. Passing tests never satisfy it.
- **Claude never records a review.** Claude does not run `tools/review.mjs stamp`, does not edit `LEDGER.LOG`, and does not edit another person's stamp note. Only Steven reviews, by running the command himself.
- **Claude never changes a status in `DEV_MANAGER_REVIEW/PATTERNS.MD`.** It may add candidates, always `proposed`. It follows `adopted` patterns, does not follow `rejected` ones, and treats `proposed` ones as suggestions, not rules.
- **Promotion also needs the review gate.** Before proposing a promotion, Claude runs `node tools/review.mjs status` on the files involved and says which are unreviewed. A promoted file must be byte-identical to a reviewed one, or be listed as a diff to review. Do not rewrite code while moving it.
- **On request, write a review brief in chat** (what the file is for and its requirement IDs, imports, what Claude guessed or left unwired, patterns used). State no conclusion and no expected results.
- **Flag a likely pattern violation when it is noticed**, instead of waiting to be asked, and do not silently fix an `adopted` pattern's exception.

## Secrets and real integrations

See `docs/decisions/0004-integration-modes-and-secrets.md` (proposed). Until Steven rules otherwise:

- Mocks are the default in prototypes. A real integration is opt-in by mode, and the page says which parts are real.
- **Never put a secret in any file in the repo**, an env file included. A `VITE_` variable is public. Do not read, print, summarize or paste the contents of secret files or secret stores (`.env.local`, key files, a keychain or manager). If a task needs a secret, say so and let Steven inject it for the command.
- Run real-integration tests only through `test:integration` and `test:e2e:real`, and report a skip as a skip.

## Files

- Design prototyping happens on a claude.ai Design canvas; only developer-ready iterations are committed, under `design/` at the root. See `design/README.MD`.
- Follow the existing `README.MD` naming for READMEs. This file is `CLAUDE.md`, lowercase extension, because Claude Code looks for that exact name on case-sensitive filesystems.
