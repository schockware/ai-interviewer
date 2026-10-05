*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Interviewer (INT)

Status: **stub.** Boundary drafted from `SPEC.md`; no requirements written yet.

## Purpose

Write the interviewer's next utterance, one question at a time, short enough to speak.

## Boundary

**Takes in**

- Interview context (role, resume, job description, stage)
- Conversation so far
- Follow-up decision
- User controls: repeat, hint, skip

**Puts out**

- A stream of text in sentence-sized pieces

**Not this layer's job:** Speaking the text (speech) or judging the answer (evaluator).

## Requirements

None yet. IDs will be `INT-{TOPIC}-{NNN}`, for example `INT-XXXX-001`.

## Assumptions about neighbouring layers

- Sentence boundaries are available early so speech can begin before the whole reply exists.

## Open questions

- Constraint adherence measure: one question, one or two sentences.

## Source

`SPEC.md` §3.2, §8.4, ROADMAP.MD section 1.
