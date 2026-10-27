# AI interviewer: synthetic test personas

36 fictional candidates for testing the practice interviewer's accessibility and accommodations. Nothing here is a real person or employer: emails use `example.test`, phone numbers use the reserved `555-01xx` range, and employers and schools are invented (not checked against trademark databases; any resemblance to a real organization is coincidental). Resumes deliberately say nothing about disability or accommodations, as real resumes usually don't; the accommodation lives in `profiles.json`.

## Files
- `profiles.json`: one object per persona. Feed this to your automation.
- `resumes/`: the resume to upload on the Setup page (Hot interviews), as `.md`, `.pdf` and `.docx` with identical content.
- `job_descriptions/`: the role text to paste or upload on the Setup page, in the same three formats.
- PDF and DOCX files come from `build_documents.py` (run after `generate.py`). They are plain, single-column, text-based files with real headings and lists, meant as the clean baseline for scraping tests.
- `COVERAGE.md`: industry x accommodation matrix, persona table, WCAG 2.2 criteria coverage.
- `questions/`: the interviewer question bank for each persona's role (always-asked core questions plus triggered follow-ups), ready for text-to-speech. Keyed by the same persona ids. See `questions/README.md`. Built by `build_questions.py`.

## profiles.json, per persona
| Key | Meaning |
|---|---|
| `setup` | `interview_type` (cold/hot), `resume_scenario` (`upload_new`, `select_saved`, `skip_fallback_cold` to exercise the hot-incomplete fallback, `n/a` for cold), file paths |
| `accommodation` | the profile key, a label, and a plain description of what is being simulated |
| `session_config` | settings using the key names from SPEC.md 3.4 and 4.2-4.5 (`interface`, `ux`, `turn_detector`, `simulator`, `accessibility_panel`). Values for `caption_size`, `pause_timing` and the turn-detector overrides are proposals, since the spec does not define them yet |
| `environment` | browser/OS/viewport, zoom, reduced motion, forced colors, `vision_deficiency` (Chromium emulation names), input method, assistive tech, `user_css` for text spacing, `pointer_jitter_px` |
| `tests` | WCAG 2.2 success criteria to check, repo spec rules to assert, control events the tester should use (`pause`, `resume`, `repeat`, `skip`, `hint`, `give_me_a_sec`, `push_to_talk`, `switch_voice_text`), tester notes, and how automatable it is |

## Using a persona manually
1. Apply the persona's `environment` and `session_config`.
2. On Setup, choose the interview type, upload the resume (per `resume_scenario`) and paste the job description.
3. Interview in character using `tester_notes`, and exercise the listed control events.
4. After the session, assert the spec rules, especially EVL-FAI-001: using an accommodation must not lower the score. Compare each score against the neurotypical baseline personas (`nt_voice`, `nt_text_first`, `nt_rough_day`).

## Caveats
- Emulation (zoom, vision-deficiency filters, forced colors, reduced motion) and scripted personas are a cheap first pass. They do not replace testing with people who use these technologies every day.
- The accommodation settings reflect the current drafts of the spec and the Design canvas, which are still changing.
- The Setup contract takes a file name and bytes and the repo does not yet say which formats are accepted, so all three are provided.
- The PDF and DOCX files are clean on purpose. Messy layouts (two columns, tables, headers and footers, scanned images) are a separate round of scraping tests.
