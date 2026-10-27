#!/usr/bin/env python3
"""Lint and build the interviewer question banks.

  python3 -I build_questions.py --lint data/questions_a.py [more files]   # check only
  python3 -I build_questions.py                                           # lint all data/questions_*.py, then build

Data file format (one or more roles keyed by persona id; ids are generated, never written):
  QUESTIONS = {
    "RET-01": {"core": [
      {"category": "motivation", "text": "...?",
       "followups": [
         {"trigger": "no_specific_example", "criteria": "...", "focus": "...", "text": "...?", "priority": 1},
         {"trigger": "mentions_customer",   "criteria": "...", "focus": "...", "text": "...?", "priority": 2}]},
      ... five core questions in the order of question_vocab.CORE_CATEGORIES ...]}}
"""
import glob
import importlib.util
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "data"))
import generate as G  # noqa: E402  (persona loader)
import question_vocab as V  # noqa: E402

OUT = os.path.join(G.OUT, "questions")


# ----------------------------------------------------------------------------- lint
def words(t):
    return re.findall(r"[A-Za-z][A-Za-z'\-]*", t)


def lint_text(t, kind, where, errs, warns):
    if not isinstance(t, str) or not t.strip():
        errs.append(f"{where}: empty text")
        return
    if t != t.strip() or "  " in t:
        errs.append(f"{where}: stray whitespace")
    if not re.match(V.TEXT_ALLOWED, t):
        bad = sorted(set(re.findall(r"[^A-Za-z ,.'?\-]", t)))
        errs.append(f"{where}: characters not allowed for speech {bad} (digits, symbols and quotes are out)")
    # One ask per utterance (INT-ONE-001): a single question ending in "?", or one clear spoken request.
    request = re.search(r"\b(tell me|walk me through|talk me through|take me through|describe|share|please)\b", t, re.I)
    if t.count("?") > 1:
        errs.append(f"{where}: more than one question")
    elif t.count("?") == 1 and not t.endswith("?"):
        errs.append(f"{where}: the question must be the last sentence")
    elif t.count("?") == 0 and not (t.endswith(".") and request):
        errs.append(f"{where}: must be one question ending in '?', or a request such as 'tell me about...' ending in '.'")
    n = len(words(t))
    if n > V.MAX_WORDS[kind]:
        errs.append(f"{where}: {n} words, limit {V.MAX_WORDS[kind]}")
    if n < V.MIN_WORDS:
        errs.append(f"{where}: only {n} words")
    sentences = [s for s in re.split(r"(?<=[.?])\s+", t.strip()) if s]
    if len(sentences) > V.MAX_SENTENCES:
        errs.append(f"{where}: {len(sentences)} sentences, limit {V.MAX_SENTENCES}")
    if t[0].islower():
        errs.append(f"{where}: starts lowercase")
    for ac in re.findall(r"\b[A-Z]{2,}\b", t):
        if ac not in V.ACRONYMS:
            errs.append(f"{where}: acronym '{ac}' not in the pronunciation map; rephrase it")
    if re.search(V.PROTECTED_AND_UNSAFE, t, re.I):
        errs.append(f"{where}: touches a protected or unsafe topic: {re.search(V.PROTECTED_AND_UNSAFE, t, re.I).group(0)!r}")
    if re.search(V.SENSORY_DEPENDENT, t, re.I):
        errs.append(f"{where}: depends on seeing or hearing something: {re.search(V.SENSORY_DEPENDENT, t, re.I).group(0)!r}")


def lint_role(pid, role, personas, errs, warns):
    w = pid
    if pid not in personas:
        errs.append(f"{w}: not a known persona id")
        return
    if not isinstance(role, dict) or "core" not in role:
        errs.append(f"{w}: needs a 'core' list")
        return
    core = role["core"]
    cats = [c.get("category") for c in core]
    if cats != V.CORE_CATEGORIES:
        errs.append(f"{w}: core categories must be exactly {V.CORE_CATEGORIES}, got {cats}")
    seen_text = set()
    content_triggers = []
    for i, c in enumerate(core, 1):
        cw = f"{pid}-C{i}"
        lint_text(c.get("text"), "core", cw, errs, warns)
        if c.get("text", "").lower() in seen_text:
            errs.append(f"{cw}: duplicate text in this role")
        seen_text.add(c.get("text", "").lower())
        fus = c.get("followups", [])
        if len(fus) != 2:
            errs.append(f"{cw}: needs exactly 2 followups, has {len(fus)}")
            continue
        kinds = [V.TRIGGERS[f["trigger"]][0] if f.get("trigger") in V.TRIGGERS else None for f in fus]
        if kinds != ["depth", "content"]:
            errs.append(f"{cw}: followups must be [depth trigger, content trigger], got {kinds}")
        if len({f.get("trigger") for f in fus}) != 2:
            errs.append(f"{cw}: the two followups need different triggers")
        for j, f in enumerate(fus, 1):
            fw = f"{cw}-F{j}"
            if f.get("trigger") not in V.TRIGGERS:
                errs.append(f"{fw}: unknown trigger {f.get('trigger')!r}")
                continue
            if V.TRIGGERS[f["trigger"]][0] == "content":
                content_triggers.append(f["trigger"])
            lint_text(f.get("text"), "followup", fw, errs, warns)
            if f.get("text", "").lower() in seen_text:
                errs.append(f"{fw}: duplicate text in this role")
            seen_text.add(f.get("text", "").lower())
            cr, fo = f.get("criteria", ""), f.get("focus", "")
            if not (20 <= len(cr) <= 220):
                errs.append(f"{fw}: criteria must be 20 to 220 characters (got {len(cr)})")
            if not (2 <= len(fo.split()) <= 12) or fo != fo.lower() or fo.endswith("."):
                errs.append(f"{fw}: focus must be 2 to 12 words, lower case, no final period: {fo!r}")
            for label, val in (("criteria", cr), ("focus", fo)):
                m = re.search(V.DELIVERY_WORDS, val, re.I)
                if m:
                    errs.append(f"{fw}: {label} depends on delivery ({m.group(0)!r}); triggers must use answer content only")
                m = re.search(V.PROTECTED_AND_UNSAFE, val, re.I)
                if m:
                    errs.append(f"{fw}: {label} touches a protected topic ({m.group(0)!r})")
            if f.get("priority") not in (1, 2, 3):
                errs.append(f"{fw}: priority must be 1, 2 or 3")
            if f.get("text") and c.get("text") and " ".join(words(f["text"])[:5]).lower() == " ".join(words(c["text"])[:5]).lower():
                warns.append(f"{fw}: starts like its parent question")
    if len(set(content_triggers)) < 4:
        warns.append(f"{w}: only {len(set(content_triggers))} different content triggers across the role; aim for 4 or more")
    if content_triggers.count("strong_answer_stretch") > 2:
        warns.append(f"{w}: more than two strong_answer_stretch follow-ups")


def lint_shared(errs, warns):
    lint_text(V.SHARED_OPENING, "shared", "shared opening", errs, warns)
    lint_text(V.SHARED_CLOSING, "shared", "shared closing", errs, warns)
    for t, (focus, text) in V.GENERIC_FOLLOWUPS.items():
        lint_text(text, "followup", f"generic {t}", errs, warns)
    missing = set(V.TRIGGERS) - set(V.GENERIC_FOLLOWUPS)
    if missing:
        errs.append(f"generic follow-ups missing for {sorted(missing)}")


def load_questions(path):
    spec = importlib.util.spec_from_file_location("q_" + os.path.basename(path)[:-3], path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.QUESTIONS


# ----------------------------------------------------------------------------- build
def spoken(text):
    out = text
    for ac, sp in V.ACRONYMS.items():
        out = re.sub(rf"\b{ac}\b", sp, out)
    return out


def secs(text):
    return round(len(words(text)) / V.WORDS_PER_SECOND, 1)


def item(id_, text, **kw):
    d = {"id": id_, "text": text, "spoken": spoken(text), "est_seconds": secs(text)}
    d.update(kw)
    return d


def build(personas, all_q):
    roles = []
    manifest = []
    opening = item("SHARED-OPEN", V.SHARED_OPENING, kind="opening")
    closing = item("SHARED-CLOSE", V.SHARED_CLOSING, kind="closing")
    generic = {t: item(f"GEN-{t}", text, trigger=t, kind=V.TRIGGERS[t][0], focus=focus) for t, (focus, text) in V.GENERIC_FOLLOWUPS.items()}
    manifest += [dict(opening, role_id=None, type="opening"), dict(closing, role_id=None, type="closing")]
    manifest += [dict(g, role_id=None, type="generic_followup") for g in generic.values()]
    for p in personas:
        pid = p["id"]
        r = all_q[pid]
        core_out = []
        for i, c in enumerate(r["core"], 1):
            cid = f"{pid}-C{i}"
            fus = []
            for j, f in enumerate(c["followups"], 1):
                fus.append(item(f"{cid}-F{j}", f["text"], trigger=f["trigger"], kind=V.TRIGGERS[f["trigger"]][0],
                                criteria=f["criteria"], focus=f["focus"], priority=f["priority"]))
            core_out.append(dict(item(cid, c["text"], order=i, category=c["category"]), followups=fus))
            manifest.append(dict(core_out[-1], role_id=pid, type="core", followups=None))
            manifest += [dict(f, role_id=pid, type="followup") for f in fus]
        roles.append({
            "persona_id": pid, "role": p["role"], "industry": p["industry"], "seniority": p["seniority"],
            "interview_plan": ["SHARED-OPEN"] + [c["id"] for c in core_out] + ["SHARED-CLOSE"],
            "core": core_out,
        })
    bank = {
        "meta": {
            "synthetic": True,
            "status": "Draft for Steven's review. Question wording, trigger criteria and the selection rules are proposals, not verified.",
            "roles": len(roles),
            "core_questions": sum(len(r["core"]) for r in roles),
            "role_followups": sum(len(c["followups"]) for r in roles for c in r["core"]),
        },
        "selection_rules": V.SELECTION_RULES,
        "tts_rules": V.TTS_RULES,
        "never_trigger_on": V.NEVER_TRIGGER_ON,
        "triggers": {t: {"kind": k, "definition": d} for t, (k, d) in V.TRIGGERS.items()},
        "core_categories": V.CATEGORY_HELP,
        "pronunciations": V.ACRONYMS,
        "shared": {"opening": opening, "closing": closing, "generic_followups": generic},
        "roles": roles,
    }
    return bank, manifest


def bank_md(bank):
    L = ["# Interviewer question bank", "",
         f"{bank['meta']['roles']} roles. {bank['meta']['core_questions']} core questions (always asked) and {bank['meta']['role_followups']} role follow-ups (asked only when a trigger fires). "
         "Draft for review; see README.md for how to use it.", "",
         "Interview order: shared opening, five core questions, shared closing.", "",
         f"- Opening: {bank['shared']['opening']['text']}", f"- Closing: {bank['shared']['closing']['text']}", ""]
    ind = None
    for r in bank["roles"]:
        if r["industry"] != ind:
            ind = r["industry"]
            L += [f"## {G.INDUSTRY_LABEL[ind]}", ""]
        L += [f"### {r['persona_id']}: {r['role']} ({r['seniority']})", ""]
        for c in r["core"]:
            L += [f"**{c['order']}. {c['category'].capitalize()}.** {c['text']}", ""]
            for f in c["followups"]:
                L += [f"- *{f['trigger']}* (priority {f['priority']}). When: {f['criteria']}", f"  Ask: {f['text']}"]
            L.append("")
    return "\n".join(L)


def readme_md(bank):
    m = bank["meta"]
    trig = ["| Trigger | Kind | Fires when |", "|---|---|---|"] + [f"| `{t}` | {d['kind']} | {d['definition']} |" for t, d in bank["triggers"].items()]
    return f"""# Interviewer question bank

{m['roles']} roles, {m['core_questions']} core questions, {m['role_followups']} role follow-ups, plus shared opening, closing and one generic follow-up per trigger. Everything is written to be spoken by the text-to-speech layer. Status: **draft for Steven's review**. Wording, trigger criteria and the selection rules are proposals, not verified.

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
{chr(10).join(trig)}

## Fairness rules (built into the lint)
Triggers use the **answer's content only** (FUP-CON-002). The lint rejects any criteria that mention delivery. A follow-up must never depend on:
{chr(10).join('- ' + x for x in bank['never_trigger_on'])}

This keeps accommodations safe: someone who stutters, types, uses captions, asks for repeats or takes extra time gets the same follow-ups for the same content (EVL-FAI-001).

## Speech rules (built into the lint)
{chr(10).join('- ' + x for x in bank['tts_rules'])}

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
"""


# ----------------------------------------------------------------------------- main
def main():
    args = sys.argv[1:]
    lint_only = args[:1] == ["--lint"]
    files = args[1:] if lint_only else sorted(glob.glob(os.path.join(HERE, "data", "questions_*.py")))
    if not files:
        print("no question files found")
        sys.exit(1)
    personas = {p["id"]: p for p in G.load_personas()}
    errs, warns, all_q = [], [], {}
    for fp in files:
        try:
            qs = load_questions(fp)
        except Exception as e:  # noqa: BLE001
            errs.append(f"{fp}: cannot load: {e!r}")
            continue
        for pid, role in qs.items():
            if pid in all_q:
                errs.append(f"{pid}: defined in more than one file")
            all_q[pid] = role
            lint_role(pid, role, personas, errs, warns)
    if not lint_only:
        lint_shared(errs, warns)
        for pid in sorted(set(personas) - set(all_q)):
            errs.append(f"{pid}: no questions written")
        # duplicates across the whole bank
        c = Counter(x["text"].lower() for r in all_q.values() for x in r["core"] if isinstance(x, dict) and x.get("text"))
        for t, n in c.items():
            if n > 1:
                warns.append(f"core question used in {n} roles: {t[:70]}")
    for w in warns:
        print("WARN ", w)
    for e in errs:
        print("ERROR", e)
    print(f"{'lint' if lint_only else 'build'}: {len(all_q)} roles, {len(errs)} errors, {len(warns)} warnings")
    if errs:
        sys.exit(1)
    if lint_only:
        return
    ordered = [personas[k] for k in sorted(personas, key=lambda i: [p["id"] for p in G.load_personas()].index(i))]
    bank, manifest = build(ordered, all_q)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "question_bank.json"), "w", encoding="utf-8") as f:
        json.dump(bank, f, indent=2, ensure_ascii=False)
    with open(os.path.join(OUT, "tts_manifest.jsonl"), "w", encoding="utf-8") as f:
        for m in manifest:
            f.write(json.dumps({k: m[k] for k in ("id", "type", "role_id", "text", "spoken", "est_seconds")}, ensure_ascii=False) + "\n")
    with open(os.path.join(OUT, "QUESTION_BANK.md"), "w", encoding="utf-8") as f:
        f.write(bank_md(bank))
    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme_md(bank))
    print(f"wrote {len(manifest)} spoken items; {bank['meta']['core_questions']} core, {bank['meta']['role_followups']} role follow-ups")


if __name__ == "__main__":
    main()
