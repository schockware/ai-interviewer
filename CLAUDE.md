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

## Files

- Follow the existing `README.MD` naming for READMEs. This file is `CLAUDE.md`, lowercase extension, because Claude Code looks for that exact name on case-sensitive filesystems.
