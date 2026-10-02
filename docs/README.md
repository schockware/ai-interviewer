*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# docs

Research, discussion, and decisions that flow from [`SPEC.md`](../SPEC.md). The spec says what the interviewer should be; these notes record how we got to each choice and what we still don't know.

## Layout

| Folder | What goes here |
|---|---|
| `research/` | Findings on a topic (models, benchmarks, accessibility guidance). Cite sources and mark anything unconfirmed as **[unverified]**, matching the spec. |
| `discussions/` | Working conversations: options weighed, tradeoffs, open threads. Date-prefixed, e.g. `2026-10-02-turn-detection.md`. |
| `decisions/` | Short records of choices made, one per file, numbered, e.g. `0001-default-stt.md`. State the decision, the reason, and the spec section it answers. |

## Conventions

- Reference spec sections by number (e.g. "SPEC §3.2") so notes survive edits to the spec.
- Resolving an item from SPEC §12 (Open Questions) should produce a decision record and a matching update to the spec.
- Keep a byline at the top of each file, per `CLAUDE.md`.
