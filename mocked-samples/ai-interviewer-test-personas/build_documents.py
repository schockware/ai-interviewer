#!/usr/bin/env python3
"""Build PDF and DOCX copies of every resume and job description, then verify them.

Run after generate.py:  python3 build_documents.py
- DOCX: tools/make_docx.js (docx-js), real Title/Heading styles and bullet lists.
- PDF:  reportlab Platypus, text-based (no images of text), single column.
- Verify: extract text back out of every PDF (pdftotext) and DOCX (pandoc) and check
  that every line of the Markdown source is present, ignoring whitespace.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import generate as G  # noqa: E402

OUT = G.OUT

F, FB = "Helvetica", "Helvetica-Bold"
ST = {
    "title": ParagraphStyle("title", fontName=FB, fontSize=20, leading=24, spaceAfter=3, alignment=TA_LEFT),
    "contact": ParagraphStyle("contact", fontName=F, fontSize=10, leading=13, spaceAfter=2),
    "h1": ParagraphStyle("h1", fontName=FB, fontSize=11.5, leading=14, spaceBefore=11, spaceAfter=2, textColor=colors.black),
    "h2": ParagraphStyle("h2", fontName=FB, fontSize=10.5, leading=13, spaceBefore=7, spaceAfter=0),
    "body": ParagraphStyle("body", fontName=F, fontSize=10, leading=13.5, spaceAfter=3),
    "bullet": ParagraphStyle("bullet", fontName=F, fontSize=10, leading=13.5),
}


def P(text, style):
    return Paragraph(escape(text), ST[style])


def bullets(items):
    return ListFlowable(
        [ListItem(P(t, "bullet"), leftIndent=16, bulletColor=colors.black) for t in items],
        bulletType="bullet", start="•", leftIndent=16, bulletFontSize=9, bulletOffsetY=0,
    )


def section(title):
    return [P(title.upper(), "h1"), HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#777777"), spaceAfter=3)]


def resume_story(r):
    s = [P(r["name"], "title"), P(r["contact_line"], "contact")]
    s += section("Summary") + [P(r["summary"], "body")] + section("Experience")
    for j in r["jobs"]:
        s.append(KeepTogether([P(f"{j['title']}, {j['employer']}", "h2"), P(f"{j['location']} | {j['dates']}", "body"), bullets(j["bullets"])]))
    s += section("Education") + [bullets(r["education"])] + section("Skills") + [P(", ".join(r["skills"]), "body")]
    if r["certifications"]:
        s += section("Certifications") + [bullets(r["certifications"])]
    return s


def jd_story(j):
    s = [P(j["role"], "title"), P(f"{j['company']} | {j['location']}", "contact")]
    s += section("About us") + [P(j["about"], "body")]
    s += section("What you'll do") + [bullets(j["duties"])]
    s += section("What we're looking for") + [bullets(j["requirements"])]
    s += [Spacer(1, 10), P(f"{j['company']} is an equal opportunity employer.", "body")]
    return s


def write_pdf(path, story, title):
    doc = SimpleDocTemplate(
        path, pagesize=letter, leftMargin=0.9 * inch, rightMargin=0.9 * inch, topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title=title, author="Synthetic test persona", subject="Fictional document for software testing",
    )
    doc.build(story)


def md_lines(path):
    """Source lines of a generated Markdown file, markers stripped, as collapsed strings."""
    out = []
    for line in open(path, encoding="utf-8").read().splitlines():
        line = re.sub(r"^(#{1,3}\s+|-\s+)", "", line).strip()
        if line:
            out.append(re.sub(r"\s+", "", line).lower())
    return out


def norm(text):
    return re.sub(r"\s+", "", text).lower()


def extract(path):
    if path.endswith(".pdf"):
        return subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True, check=True).stdout
    # -s keeps the Title-style paragraph (pandoc otherwise moves it into metadata)
    return subprocess.run(["pandoc", "-s", "-t", "plain", "--wrap=none", path], capture_output=True, text=True, check=True).stdout


def main():
    personas = {p["id"]: p for p in G.load_personas()}
    profiles = json.load(open(os.path.join(OUT, "profiles.json"), encoding="utf-8"))
    items, jobs = [], []
    for prof in profiles:
        p = personas[prof["id"]]
        c = prof["contact"]
        r = {k: p[k] for k in ("name", "summary", "jobs", "education", "skills", "certifications")}
        r["contact_line"] = f"{c['location']} | {c['phone']} | {c['email']}"
        jd = dict(p["jd"], role=p["role"])
        rf, jf = prof["setup"]["resume_files"], prof["setup"]["job_description_files"]
        items.append({"resume_out": os.path.join(OUT, rf["docx"]), "jd_out": os.path.join(OUT, jf["docx"]), "resume": r, "jd": jd})
        jobs.append((os.path.join(OUT, rf["pdf"]), resume_story(r), f"{r['name']} - Resume"))
        jobs.append((os.path.join(OUT, jf["pdf"]), jd_story(jd), f"{jd['role']} - {jd['company']}"))

    scratch = tempfile.mkdtemp(prefix="docs_input_")
    inp = os.path.join(scratch, "docs_input.json")
    json.dump(items, open(inp, "w", encoding="utf-8"), ensure_ascii=False)
    subprocess.run(["node", os.path.join(HERE, "tools", "make_docx.js"), inp], check=True)
    for path, story, title in jobs:
        write_pdf(path, story, title)
    print(f"pdf: wrote {len(jobs)} files")

    # --- verify: every source line must survive extraction from both formats
    bad, pages = [], []
    for prof in profiles:
        for kind in ("resume_files", "job_description_files"):
            files = prof["setup"][kind]
            src = md_lines(os.path.join(OUT, files["md"]))
            for ext in ("pdf", "docx"):
                fp = os.path.join(OUT, files[ext])
                text = norm(extract(fp))
                missing = [s for s in src if s not in text]
                if missing:
                    bad.append((fp, missing[:3]))
            n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", os.path.join(OUT, files["pdf"])], capture_output=True, text=True).stdout).group(1))
            pages.append((n, files["pdf"]))
    print(f"verify: {len(profiles) * 4} documents checked, {len(bad)} with missing text")
    for fp, m in bad[:10]:
        print("  MISSING in", os.path.relpath(fp, OUT), m)
    longest = max(pages)
    print(f"pdf pages: resumes/JDs max {longest[0]} ({longest[1]}); {sum(1 for n, _ in pages if n > 1)} documents run past one page")
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
