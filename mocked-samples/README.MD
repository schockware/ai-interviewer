*Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.*

# mocked-samples

Sample data the prototypes load so an interview can be set up without inventing a role, a resume or questions by hand. Nothing here is a real person or employer, and nothing here is verified.

| Folder | What it holds | Who loads it |
|---|---|---|
| `ai-interviewer-test-personas/` | 36 synthetic candidates, generated for Steven by another model (downloaded 2026-10-27). `output/` has each persona's resume and job description as `.md`, `.pdf` and `.docx`, `profiles.json` with the accommodation profile and test notes per persona, and `questions/` with the interviewer question bank: five core questions per role plus follow-ups and triggers. See `output/README.md` and `output/questions/README.md` | The API prototype at startup, when `Samples:Path` names `output/` (it does in Development): each persona becomes a role (title and job description), its core questions become the role's questions, and its resume a saved resume. The UI prototype's mock setup host reads the same job descriptions and question bank straight from this folder, so mock and real mode offer the same roles |

Notes:

- Only the core questions are loaded. The follow-ups, triggers, opening and closing in the bank belong to the follow-up decider and the interviewer, which are not built (`TASKS.MD`).
- The generator scripts in `ai-interviewer-test-personas/` (`generate.py`, `build_documents.py`, `build_questions.py`, `data/`, `tools/`) are kept so the set can be regenerated. They came with the download and were not run or reviewed here; the prototypes read the `output/` files as data only.
- Loading is keyed by persona id, so starting the API again adds nothing. Delete the API's `data/` folder to reload from scratch.
