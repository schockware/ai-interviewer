*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Interviewer (INT)

Status: **first draft.** Also bound by the common requirements COM-ISL, COM-ISO, COM-ID, COM-DET, COM-RES, COM-LOC, COM-PRV, COM-FLT and COM-INP in [`specs/common`](../common/README.MD).

## Purpose

Write the interviewer's next utterance, one question at a time, short enough to speak.

## Boundary

**Takes in**

- Interview context: the role, the resume, the job description, and the stage of the interview
- The conversation so far, recording what the user actually heard (including utterances that were cut off)
- The follow-up decision (probe with a focus, or move on), when there is one
- User controls: repeat, hint, skip, and a hold ("give me a sec")
- A cancel signal
- Settings: the interview language, the longest reply, and whether feedback may be given during the interview

**Puts out**

- The reply as text in sentence-sized pieces, as it is written
- On cancel, what had been written

**Not this layer's job:** speaking the text (speech), judging the answer (evaluator), or deciding probe or move on (follow-up).

## Requirements

### Streaming

- **INT-STR-001** The layer MUST deliver the reply in sentence-sized pieces as each is complete, and MUST deliver the first piece before the whole reply has been written.
- **INT-STR-002** The reply MUST contain only what is to be spoken. It MUST NOT include reasoning, notes to itself, or formatting that cannot be spoken.

### Shape of a reply

- **INT-ONE-001** A reply MUST contain at most one question.
- **INT-LEN-001** A reply SHOULD be at most two sentences. A longer reply is allowed only where the context asks for it (for example, introducing the interview), and the limit MUST be configurable.
- **INT-LNG-001** The reply MUST be in the configured interview language.

### Following the interview

- **INT-FUP-001** When the decision is to probe, the reply MUST ask about the stated focus of the user's last answer. When the decision is to move on, the reply MUST open a new topic and MUST NOT continue the last one.
- **INT-HIS-001** The layer MUST NOT ask a question already asked in this session, unless the user asked for it to be repeated.
- **INT-CTX-001** Questions SHOULD be grounded in the role, resume and job description.
- **INT-CTX-002** The layer MUST NOT state or imply facts about the user that are not in the resume or in what the user has said.

### Controls

- **INT-CTL-001** On repeat, the reply MUST restate the last question with the same meaning. It MAY rephrase if asked.
- **INT-CTL-002** On hint, the reply SHOULD help the user toward an answer without giving the full answer.
- **INT-CTL-003** On skip, the reply MUST move to a different question.
- **INT-CTL-004** While a hold is active, the layer MUST NOT produce a reply.

### Conduct

- **INT-CND-001** Unless feedback during the interview is switched on, the layer MUST NOT tell the user how they are doing or reveal any score.
- **INT-CND-002** The layer MUST NOT ask about protected characteristics (for example age, family status, health, religion, nationality) or press for them.
- **INT-CND-003** The layer MUST NOT make promises about the real hiring process or the real employer.

### Cancellation

- **INT-CAN-001** On cancel, the layer MUST stop writing within a stated time and report what it had written.

## Targets (provisional, to be set from prototype measurements)

| ID | Measure | Starting point |
|---|---|---|
| INT-TGT-001 | Time from the request to the first sentence-sized piece | to be set (the figure that matters most for turn-taking) |
| INT-TGT-002 | Time to write a full reply | to be set |
| INT-TGT-003 | Time from cancel to stopping | to be set |
| INT-TGT-004 | How often replies keep to one question and the length limit | to be set (a benchmark) |

## Conformance vectors (planned)

The output text varies, so each vector checks a property of the reply, not the exact words.

1. Scripted context and history: one question, within the length (INT-ONE-001, INT-LEN-001).
2. A probe decision with a focus: the reply addresses the focus (INT-FUP-001).
3. A move-on decision: the topic changes (INT-FUP-001).
4. A resume with no mention of a skill: the reply does not credit the user with it (INT-CTX-002).
5. A history that already holds a question: no repeat (INT-HIS-001).
6. Repeat, hint, skip and a hold (INT-CTL-001 to INT-CTL-004).
7. A cut-off utterance in the history: the next reply accounts for what was actually heard (INT-HIS-001).
8. A reply containing reasoning text: rejected (INT-STR-002).
9. A cancel part-way (INT-CAN-001).

## Running alone

Feed a recorded context, history and decision. Capture the pieces and their timing. Check the properties with rules where they can be, and with a fixed judge, spot-checked by people, where they cannot.

## Assumptions about neighbouring layers

- The history records what was actually spoken to the user, as reported by the session after a cancel.
- The follow-up decision arrives before the layer is asked to write, except for the first question of an interview.
- Sentence boundaries can be found as the text is written.

## Open questions

1. How the interview plan (topics and stages) is given to the layer. Interview content is not yet specified (`specs/README.MD`).
2. How "one question" is judged when a question has several parts.
3. Whether the layer should be allowed to say it did not understand the user's answer.

## Source

`SPEC.md` §3.2, §8.4, and `ROADMAP.MD` section 1.
