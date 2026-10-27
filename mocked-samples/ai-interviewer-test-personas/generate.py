#!/usr/bin/env python3
"""Build test-persona outputs for the AI interviewer accessibility tests.

Reads data/personas_*.py (work histories) and data/accommodations.py
(accommodation profiles) and writes, under ./output:
  profiles.json            machine-readable personas + resolved test configs
  resumes/<id>-<name>.md   fictional resume to upload on the Setup page
  job_descriptions/...md   job description to paste/upload on the Setup page
  COVERAGE.md              coverage matrices (industry x category, WCAG SC, automation)
  README.md                how to use it
Run:  python3 generate.py
"""
import glob
import importlib.util
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "output")
sys.path.insert(0, DATA)
import accommodations as A  # noqa: E402

INDUSTRY_ORDER = ["retail", "hospitality", "healthcare", "logistics", "manufacturing", "finance", "tech", "media"]
INDUSTRY_LABEL = {
    "retail": "Retail", "hospitality": "Hospitality & travel", "healthcare": "Healthcare",
    "logistics": "Logistics & transportation", "manufacturing": "Manufacturing",
    "finance": "Banking, finance & insurance", "tech": "Tech / IT", "media": "Media & entertainment",
}
REQUIRED = ["id", "name", "location", "industry", "role", "seniority", "interview_type", "resume_scenario",
            "summary", "jobs", "education", "skills", "certifications", "jd", "interview_focus"]
LEAK_WORDS = re.compile(
    r"\b(blind|deaf|hearing[- ]impair|dyslex|adhd|autis|disab|wheelchair|screen reader|braille|stutter|"
    r"neurodiver|colou?r[- ]?blind|assistive|tremor|accommodat)\w*", re.I)


def load_personas():
    personas = []
    for path in sorted(glob.glob(os.path.join(DATA, "personas_*.py"))):
        spec = importlib.util.spec_from_file_location(os.path.basename(path)[:-3], path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        personas.extend(mod.PERSONAS)
    order = {"RET": 0, "HOS": 1, "HLT": 2, "LOG": 3, "MFG": 4, "FIN": 5, "TEC": 6, "MED": 7}
    personas.sort(key=lambda p: (order[p["id"][:3]], p["id"]))
    return personas


def slug(text):
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def contact(p, n):
    parts = slug(p["name"]).split("-")
    return {
        "email": f"{parts[0]}.{parts[-1]}@example.test",
        "phone": f"555-01{n:02d}",
        "location": p["location"],
    }


def resume_md(p, c):
    L = [f"# {p['name']}", f"{c['location']} | {c['phone']} | {c['email']}", "", "## Summary", p["summary"], "", "## Experience"]
    for j in p["jobs"]:
        L += [f"### {j['title']}, {j['employer']}", f"{j['location']} | {j['dates']}"]
        L += [f"- {b}" for b in j["bullets"]]
        L.append("")
    L += ["## Education"] + [f"- {e}" for e in p["education"]] + ["", "## Skills", ", ".join(p["skills"])]
    if p["certifications"]:
        L += ["", "## Certifications"] + [f"- {x}" for x in p["certifications"]]
    return "\n".join(L) + "\n"


def jd_md(p):
    jd = p["jd"]
    L = [f"# {p['role']}", f"{jd['company']} | {jd['location']}", "", "## About us", jd["about"], "", "## What you'll do"]
    L += [f"- {d}" for d in jd["duties"]] + ["", "## What we're looking for"] + [f"- {r}" for r in jd["requirements"]]
    L += ["", f"{jd['company']} is an equal opportunity employer."]
    return "\n".join(L) + "\n"


def validate(personas):
    problems, warnings = [], []
    ids = [p["id"] for p in personas]
    if len(set(ids)) != len(ids):
        problems.append("duplicate ids")
    for missing in sorted(set(A.ASSIGNMENT) - set(ids)):
        problems.append(f"{missing}: assigned an accommodation but no persona data")
    for p in personas:
        for k in REQUIRED:
            if k not in p or p[k] in (None, "", []) and k not in ("certifications",):
                problems.append(f"{p.get('id')}: missing/empty '{k}'")
        if p["id"] not in A.ASSIGNMENT:
            problems.append(f"{p['id']}: no accommodation assignment")
        if p["interview_type"] not in ("cold", "hot"):
            problems.append(f"{p['id']}: bad interview_type")
        if p["resume_scenario"] not in ("n/a", "upload_new", "select_saved", "skip_fallback_cold"):
            problems.append(f"{p['id']}: bad resume_scenario {p['resume_scenario']}")
        if (p["interview_type"] == "cold") != (p["resume_scenario"] == "n/a"):
            warnings.append(f"{p['id']}: interview_type {p['interview_type']} vs resume_scenario {p['resume_scenario']}")
        text = resume_md(p, contact(p, 0)) + jd_md(p)
        if re.search(r"[^\x00-\x7f–]", text):
            warnings.append(f"{p['id']}: non-ASCII characters (other than en dash)")
        for m in LEAK_WORDS.finditer(text):
            warnings.append(f"{p['id']}: possible accommodation/health wording in resume/JD: '{m.group(0)}'")
    return problems, warnings


def build_profile(p, n):
    ap_key = A.ASSIGNMENT[p["id"]]
    ap = A.APS[ap_key]
    cfg = A.resolve(ap_key)
    base = f"{p['id']}-{slug(p['name'])}"
    return {
        "id": p["id"],
        "synthetic": True,
        "name": p["name"],
        "industry": p["industry"],
        "role": p["role"],
        "seniority": p["seniority"],
        "contact": contact(p, n),
        "setup": {
            "interview_type": p["interview_type"],
            "resume_scenario": p["resume_scenario"],
            "resume_file": f"resumes/{base}.md",  # always present; in a Cold interview it should be ignored
            "job_description_file": f"job_descriptions/{base}.md",
            # PDF and DOCX copies are produced by build_documents.py (run after this script)
            "resume_files": {ext: f"resumes/{base}.{ext}" for ext in ("md", "pdf", "docx")},
            "job_description_files": {ext: f"job_descriptions/{base}.{ext}" for ext in ("md", "pdf", "docx")},
            "role_display_name": p["role"],
        },
        "interview_focus": p["interview_focus"],
        "accommodation": {
            "key": ap_key, "label": ap["label"], "category": ap["category"], "simulates": ap["simulates"],
        },
        "session_config": {
            "interface": cfg["interface"], "ux": cfg["ux"], "turn_detector": cfg["turn_detector"],
            "simulator": cfg["simulator"], "accessibility_panel": cfg["accessibility_panel"],
        },
        "environment": cfg["environment"],
        "tests": {
            "automation": ap["automation"],
            "manual_note": ap["manual_note"],
            "wcag_2_2": [{"sc": s, "name": A.WCAG[s][0], "level": A.WCAG[s][1]} if s in A.WCAG else {"sc": s} for s in ap["wcag"]],
            "spec_checks": [{"id": s, "rule": A.SPEC[s]} for s in ap["spec_checks"]],
            "control_events_to_exercise": ap["control_events_to_exercise"],
            "tester_notes": ap["tester_notes"],
        },
    }


def coverage_md(profiles):
    inds = [i for i in INDUSTRY_ORDER if any(p["industry"] == i for p in profiles)]
    cats = sorted({p["accommodation"]["category"] for p in profiles})
    mat = defaultdict(Counter)
    for p in profiles:
        mat[p["industry"]][p["accommodation"]["category"]] += 1
    L = ["# Coverage", "", f"{len(profiles)} synthetic personas, {len({p['accommodation']['key'] for p in profiles})} accommodation profiles, {len(inds)} industries.", "",
         "## Industry by accommodation category", "", "| Industry | " + " | ".join(cats) + " | Total |", "|---|" + "---|" * (len(cats) + 1)]
    for i in inds:
        L.append(f"| {INDUSTRY_LABEL[i]} | " + " | ".join(str(mat[i][c] or "") for c in cats) + f" | {sum(mat[i].values())} |")
    L += ["", "## Personas", "", "| ID | Name | Role | Interview | Accommodation profile | Interface | AT / input | Verification |", "|---|---|---|---|---|---|---|---|"]
    for p in profiles:
        env = p["environment"]
        at = env["assistive_tech"] or env["input"]
        L.append(f"| {p['id']} | {p['name']} | {p['role']} | {p['setup']['interview_type']} ({p['setup']['resume_scenario']}) | "
                 f"{p['accommodation']['label']} | {p['session_config']['interface']} | {at} | {p['tests']['automation']} |")
    sc = defaultdict(list)
    for p in profiles:
        for s in p["tests"]["wcag_2_2"]:
            sc[s["sc"]].append(p["id"])
    L += ["", "## WCAG 2.2 success criteria and the personas that exercise them", "", "| SC | Name | Level | Personas |", "|---|---|---|---|"]
    for k in sorted(sc, key=lambda s: [int(x) if x.isdigit() else 0 for x in re.split(r"[.-]", s)[:3]]):
        nm, lv = A.WCAG.get(k, (k, ""))
        L.append(f"| {k} | {nm} | {lv} | {len(sc[k])}: {', '.join(sc[k])} |")
    auto = Counter(p["tests"]["automation"] for p in profiles)
    L += ["", "## How much can be automated", "",
          f"- automated: {auto['automated']} personas (axe-core plus Playwright emulation: zoom, forced colors, reduced motion, vision-deficiency emulation, keyboard-only scripts)",
          f"- hybrid: {auto['hybrid']} personas (automation for the structural checks, a human for judgment: captions accuracy, sensory comfort, disfluent audio, magnifier or voice-control software)",
          f"- manual_required: {auto['manual_required']} personas (a real screen reader, switch device or braille display is part of the test)",
          "", "The repo's own research estimates axe-core finds only about 30-50% of issues, so every persona still needs a human pass for the things marked hybrid or manual.", "",
          "## ADA note", "",
          "The ADA does not name a technical web standard itself. WCAG 2.x Level AA is the benchmark commonly used in practice, and the 2024 US DOJ rule for state and local governments references WCAG 2.1 AA. The success criteria above are a recommended test set, not a conformance claim or legal advice. Verify levels and numbers against the WCAG 2.2 text before citing them in a report.", ""]
    return "\n".join(L)


README = """# AI interviewer: synthetic test personas

{n} fictional candidates for testing the practice interviewer's accessibility and accommodations. Nothing here is a real person or employer: emails use `example.test`, phone numbers use the reserved `555-01xx` range, and employers and schools are invented (not checked against trademark databases; any resemblance to a real organization is coincidental). Resumes deliberately say nothing about disability or accommodations, as real resumes usually don't; the accommodation lives in `profiles.json`.

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
"""


def main():
    personas = load_personas()
    problems, warnings = validate(personas)
    for w in warnings:
        print("WARN ", w)
    if problems:
        for m in problems:
            print("ERROR", m)
        sys.exit(1)
    os.makedirs(os.path.join(OUT, "resumes"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "job_descriptions"), exist_ok=True)
    profiles = []
    for n, p in enumerate(personas, 1):
        prof = build_profile(p, n)
        base = f"{p['id']}-{slug(p['name'])}"
        with open(os.path.join(OUT, "resumes", base + ".md"), "w") as f:
            f.write(resume_md(p, prof["contact"]))
        with open(os.path.join(OUT, "job_descriptions", base + ".md"), "w") as f:
            f.write(jd_md(p))
        profiles.append(prof)
    with open(os.path.join(OUT, "profiles.json"), "w") as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUT, "COVERAGE.md"), "w") as f:
        f.write(coverage_md(profiles))
    with open(os.path.join(OUT, "README.md"), "w") as f:
        f.write(README.format(n=len(profiles)))
    print(f"OK: {len(profiles)} personas, {len(warnings)} warnings")


if __name__ == "__main__":
    main()
