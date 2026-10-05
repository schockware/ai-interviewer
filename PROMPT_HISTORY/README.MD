*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# PROMPT_HISTORY

A record of the prompts that implementer actors (chats that take specifications and perform code) handle in this project. The rules for writing entries live in `CLAUDE.md`, under "Implementer actors and the prompt history". This file holds the definitions, disclaimers, and the log of changes to the process itself.

## Files

- `{YYYY-MM}.LOG`: committed. Summary prompts only, never original text.
- `{YYYY-MM}.REDACTED`: gitignored. Original prompts, redacted on a best-effort basis; the gitignore is the backstop.
- `{YYYY-MM}.AUDIT`: gitignored. One line per entry whose redaction needs supplemental review. Categories only, never redacted content.
- `AUDIT.EXAMPLE`: committed. A sample audit line for reference. (Not yet created.)

## Disclaimers

- Redaction is best effort and may miss things.
- Token figures are approximate.
- Summaries are written by the model that handled the prompt and may be imperfect.

## Process changes

- 2026-10-05: Added a transcription exception. When a chat is only transcribing for the user (no contribution from Claude), prompts are not logged. If Claude offers a suggestion and the user takes it, that prompt is logged. Also created this README and added the `.REDACTED` and `.AUDIT` patterns to `.gitignore`.
