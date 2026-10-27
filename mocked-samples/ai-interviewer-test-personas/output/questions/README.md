# Interviewer question bank

36 roles, 180 core questions, 360 role follow-ups, plus shared opening, closing and one generic follow-up per trigger. Everything is written to be spoken by the text-to-speech layer. Status: **draft for Steven's review**. Wording, trigger criteria and the selection rules are proposals, not verified.

## Files
- `question_bank.json`: everything, structured. Feed this to the interviewer and follow-up decider.
- `tts_manifest.jsonl`: one line per spoken item (`id`, `text`, `spoken`, `est_seconds`, `type`, `role_id`). Use it to batch-render audio and to run round-trip transcription checks (TTS-FAI-003).
- `QUESTION_BANK.md`: the same content for people to read and review.

## How it works
1. **Core questions are always asked**, in order, after the shared opening and before the shared closing: motivation, experience, behavioral, scenario, growth.
2. **After each answer** the follow-up decider chooses probe or move on (FUP-DEC-001). If it probes, a follow-up whose `trigger` fired on the answer is asked. Each core question has two role follow-ups: one *depth* trigger (the answer lacks something) and one *content* trigger (the answer mentions something worth asking about, or is strong).
3. **Generic follow-ups** in `shared.generic_followups` are fallbacks when no role follow-up fits.
4. `focus` is the short phrase the decider returns with a probe (FUP-DEC-002). `criteria` is the plain-language test for the trigger, written so a model or a person can judge it from the answer text.
5. `selection_rules` holds the proposed caps and ordering. They are proposals.

## Triggers
| Trigger | Kind | Fires when |
|---|---|---|
| `no_specific_example` | depth | The question asked about a real past situation, but the answer stays general or hypothetical and names no concrete occasion. |
| `no_outcome` | depth | The answer describes what the candidate did but never says how it ended or what changed. |
| `no_personal_role` | depth | The answer describes what a team or group did, and the candidate's own part is unclear. |
| `no_measure` | depth | The answer describes a result or scale but gives no size, amount, frequency or other measure, where a measure would naturally exist. Use sparingly. |
| `unclear_answer` | depth | The CONTENT of the answer is ambiguous or seems to contradict itself. Never because of audio, transcript quality, fluency or wording style (FUP-DEC-006). |
| `mentions_conflict` | content | The answer mentions a disagreement, a difficult person, or a clash of priorities. |
| `mentions_mistake` | content | The answer mentions an error, failure, miss or problem, theirs or someone else's. |
| `mentions_tool_or_method` | content | The answer names a specific tool, system, technique, process or credential. |
| `mentions_leadership` | content | The answer mentions guiding, training, coaching, delegating to or influencing others. |
| `mentions_time_pressure` | content | The answer mentions a tight deadline, heavy workload, or competing demands. |
| `mentions_improvement` | content | The answer mentions changing, fixing or improving a process, product or situation. |
| `mentions_customer` | content | The answer mentions a customer, client, patient, guest, vendor, or other person being served. |
| `skips_safety_or_compliance_step` | content | The answer describes a shortcut, or leaves out a safety, accuracy, privacy, quality or compliance check that this role would normally require. |
| `strong_answer_stretch` | content | The answer is complete, specific and shows clear results. Ask one harder variation to test depth. |

## Fairness rules (built into the lint)
Triggers use the **answer's content only** (FUP-CON-002). The lint rejects any criteria that mention delivery. A follow-up must never depend on:
- How fast or slow the person speaks, pauses, long silences, or hesitation
- Stuttering, repeated words, or false starts
- Accent, pronunciation, or dialect
- Grammar, spelling, vocabulary level, or writing style
- Audio quality, clipped audio, or a low-confidence transcript (FUP-DEC-006)
- Whether the answer was spoken or typed, or whether captions, hints, repeats, push-to-talk or 'give me a sec' were used (EVL-FAI-001)
- Answer length on its own
- Anything about age, family, health, disability, religion, nationality or other protected characteristics (INT-CND-002)

This keeps accommodations safe: someone who stutters, types, uses captions, asks for repeats or takes extra time gets the same follow-ups for the same content (EVL-FAI-001).

## Speech rules (built into the lint)
- One ask per utterance: a single question, or a single spoken request such as 'tell me about a time...'. At most two sentences (INT-ONE-001, INT-LEN-001).
- Plain letters only: no digits, symbols, slashes, parentheses, quotes, colons or markdown (INT-STR-002).
- Numbers are written as words. Capitalised acronyms must be in the pronunciation map.
- Core questions up to 28 words, follow-ups up to 24 words, so a turn is about 10 seconds or less when spoken.
- Nothing depends on sight or sound (no 'as you can see', 'click', 'on screen').
- Nothing asks about protected characteristics or health (INT-CND-002).

`spoken` differs from `text` only where an acronym is respelled for the voice, using `pronunciations`. Whether the chosen voice says each one correctly still needs to be heard.

## Cold and Hot interviews
Nothing in the bank refers to a resume, a candidate or an employer, so it works for Cold interviews, which ignore the resume. In Hot interviews the interviewer model can add resume-grounded questions on top, without claiming anything the resume or the candidate has not said (INT-CTX-002).

Each role's questions were written from that persona's sample job description, so some reflect that job's setting (for example a progressive care unit, or a payments partner review). Check that a question fits before using it against a different job description for the same title.

## Review so far
Every item passes the lint (structure, speakable wording, protected topics, delivery-free triggers). After the first draft a second pass fixed things the lint cannot see: questions that asked two things at once, follow-ups that assumed more than their trigger guarantees, entry-level questions that assumed prior experience, and statements about the candidate or the job. The wording was drafted by a model and has had no human review, and none of it has been run through the real interviewer or follow-up decider.

## Not covered yet
- Hearing the questions: `spoken` respells acronyms for the voice, but no voice has been listened to.
- Questions for whiteboard or technical exercises (the repo has separate banks for those).
- Languages other than English (INT-LNG-001).
- Difficulty levels. Seniority shapes the wording only.
- No question has been run through the real interviewer or decider; the conformance checks in the specs still need to be run.
