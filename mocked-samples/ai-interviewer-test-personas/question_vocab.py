"""Shared vocabulary and rules for the interviewer question banks.

Everything here is a PROPOSAL for Steven's review. The repo's follow-up spec
(specs/follow-up/README.MD) and interviewer spec (specs/interviewer/README.MD)
are the source of the constraints; each rule names the requirement it serves.
"""

# --- follow-up trigger types ---------------------------------------------------
# kind "depth":   the answer lacks something a good answer to that question has.
# kind "content": the answer mentions something worth asking about, or is strong.
# Every trigger is judged from the FINAL TRANSCRIPT TEXT of the answer only
# (FUP-CON-002). None may depend on voice, speed, pauses, accent, audio quality,
# grammar, spelling, or whether the answer was spoken or typed.
TRIGGERS = {
    "no_specific_example": ("depth", "The question asked about a real past situation, but the answer stays general or hypothetical and names no concrete occasion."),
    "no_outcome": ("depth", "The answer describes what the candidate did but never says how it ended or what changed."),
    "no_personal_role": ("depth", "The answer describes what a team or group did, and the candidate's own part is unclear."),
    "no_measure": ("depth", "The answer describes a result or scale but gives no size, amount, frequency or other measure, where a measure would naturally exist. Use sparingly."),
    "unclear_answer": ("depth", "The CONTENT of the answer is ambiguous or seems to contradict itself. Never because of audio, transcript quality, fluency or wording style (FUP-DEC-006)."),
    "mentions_conflict": ("content", "The answer mentions a disagreement, a difficult person, or a clash of priorities."),
    "mentions_mistake": ("content", "The answer mentions an error, failure, miss or problem, theirs or someone else's."),
    "mentions_tool_or_method": ("content", "The answer names a specific tool, system, technique, process or credential."),
    "mentions_leadership": ("content", "The answer mentions guiding, training, coaching, delegating to or influencing others."),
    "mentions_time_pressure": ("content", "The answer mentions a tight deadline, heavy workload, or competing demands."),
    "mentions_improvement": ("content", "The answer mentions changing, fixing or improving a process, product or situation."),
    "mentions_customer": ("content", "The answer mentions a customer, client, patient, guest, vendor, or other person being served."),
    "skips_safety_or_compliance_step": ("content", "The answer describes a shortcut, or leaves out a safety, accuracy, privacy, quality or compliance check that this role would normally require."),
    "strong_answer_stretch": ("content", "The answer is complete, specific and shows clear results. Ask one harder variation to test depth."),
}

DEPTH_TRIGGERS = [t for t, (k, _) in TRIGGERS.items() if k == "depth"]
CONTENT_TRIGGERS = [t for t, (k, _) in TRIGGERS.items() if k == "content"]

NEVER_TRIGGER_ON = [
    "How fast or slow the person speaks, pauses, long silences, or hesitation",
    "Stuttering, repeated words, or false starts",
    "Accent, pronunciation, or dialect",
    "Grammar, spelling, vocabulary level, or writing style",
    "Audio quality, clipped audio, or a low-confidence transcript (FUP-DEC-006)",
    "Whether the answer was spoken or typed, or whether captions, hints, repeats, push-to-talk or 'give me a sec' were used (EVL-FAI-001)",
    "Answer length on its own",
    "Anything about age, family, health, disability, religion, nationality or other protected characteristics (INT-CND-002)",
]

# --- core question structure (always asked, in this order) -----------------------
CORE_CATEGORIES = ["motivation", "experience", "behavioral", "scenario", "growth"]
CATEGORY_HELP = {
    "motivation": "Why this kind of work or role; keeps the interviewer grounded in the role.",
    "experience": "A real past example of doing the core work of the role.",
    "behavioral": "A real past example of a people or pressure situation common in the role.",
    "scenario": "A realistic role-specific situation the candidate talks through (may be hypothetical).",
    "growth": "Learning, strengths or development, framed for the role.",
}

# --- TTS-safe wording rules ------------------------------------------------------
TEXT_ALLOWED = r"^[A-Za-z][A-Za-z ,.'?\-]*$"  # letters, space, comma, period, apostrophe, hyphen, question mark
MAX_WORDS = {"core": 28, "followup": 24, "shared": 28}
MIN_WORDS = 5
MAX_SENTENCES = 2  # INT-LEN-001
WORDS_PER_SECOND = 2.5  # about 150 words per minute, for est_seconds

# Acronyms that may appear in text, mapped to a spoken form for the TTS engine
# (TTS-FAI-003). Anything else in capitals is rejected: rephrase instead.
ACRONYMS = {
    "AI": "A I", "AML": "A M L", "API": "A P I", "CDL": "C D L", "CNC": "C N C", "CPR": "C P R",
    "CRM": "C R M", "EHR": "E H R", "ER": "E R", "ERP": "E R P", "GPS": "G P S", "HIPAA": "hippa",
    "HR": "H R", "ICU": "I C U", "IT": "I T", "KPI": "K P I", "KYC": "K Y C", "OSHA": "oh shuh",
    "QA": "Q A", "RN": "R N", "SOP": "S O P", "SQL": "sequel", "TMS": "T M S", "UI": "U I",
    "WMS": "W M S",
}

# Errors: never allowed in question text, criteria or focus.
PROTECTED_AND_UNSAFE = (
    r"\b(how old|your age|years old|are you (married|single|pregnant)|have (kids|children)|"
    r"your (children|family plans|marital|religion|citizenship|nationality|ethnicity|race|gender|"
    r"disabilit\w*|health|medical|accent|native language)|do you have a disability|work authorization|"
    r"visa|sponsorship|criminal|arrest\w*|convict\w*|salary history|current salary|"
    r"how much (do|did) you (make|earn)|physically (able|capable)|lift \w+ pounds|pounds)\b"
)
# Errors in question text: depends on seeing or hearing something the candidate may not perceive.
SENSORY_DEPENDENT = (
    r"\b(as you can (see|hear)|you can see|on (the )?screen|click|look at|"
    r"in the (document|chart|image|picture) (above|below)|the following|as shown)\b"
)
# Errors in criteria and focus: triggers must not depend on delivery (FUP-CON-002).
DELIVERY_WORDS = (
    r"\b(accent|pronunc\w*|stutter\w*|stammer\w*|hesitat\w*|pause\w*|fluen\w*|grammar\w*|spelling|"
    r"speaking pace|speak\w* (fast|slow\w*)|tone of voice|volume|filler|typed|typing|too (short|long)|"
    r"word count|brief answer|slow\w*|quiet\w*|loud\w*)\b"
)

SELECTION_RULES = {
    "_status": "Proposals. Values marked [unverified] in the repo (FUP-TGT-004) stay proposals until Steven rules.",
    "order_of_interview": "shared opening, then the five role core questions in order, then shared closing",
    "core_questions": "Always asked, in order, exactly as written unless the user asks for a repeat or hint (INT-CTL-001, INT-CTL-002).",
    "followups": "Asked only when the decider chooses probe (FUP-DEC-001) and a trigger fires on the answer text. Each follow-up's focus is the short phrase for FUP-DEC-002.",
    "max_probes_in_a_row": 2,
    "max_followups_per_core_question_default": 1,
    "max_stretch_followups_per_interview": 2,
    "choosing_between_triggers": "If several fire, ask the lowest priority number first. If tied, prefer a depth trigger over a content trigger. Stop at the cap.",
    "role_followup_vs_generic": "Use the role follow-up whose trigger fired. If none applies, use the shared generic follow-up for that trigger as a fallback.",
    "never_probe_when": [
        "The answer is empty or says the person does not know (FUP-DEC-005)",
        "The transcript confidence is too low to trust the content (FUP-DEC-006)",
        "The probe cap has been reached (FUP-DEC-004)",
    ],
    "grounding": "Bank text is role-level and works in Cold interviews. In Hot interviews the interviewer model may add resume-grounded questions on top, but must not claim facts that are not in the resume or the answers (INT-CTX-002).",
    "paraphrasing": "Follow-up text is the default, speakable version. The interviewer may paraphrase it to fit the answer (INT-FUP-001) while keeping one question, two sentences at most.",
}

TTS_RULES = [
    "One ask per utterance: a single question, or a single spoken request such as 'tell me about a time...'. At most two sentences (INT-ONE-001, INT-LEN-001).",
    "Plain letters only: no digits, symbols, slashes, parentheses, quotes, colons or markdown (INT-STR-002).",
    "Numbers are written as words. Capitalised acronyms must be in the pronunciation map.",
    "Core questions up to 28 words, follow-ups up to 24 words, so a turn is about 10 seconds or less when spoken.",
    "Nothing depends on sight or sound (no 'as you can see', 'click', 'on screen').",
    "Nothing asks about protected characteristics or health (INT-CND-002).",
]

# --- shared questions (any role) ---------------------------------------------------
SHARED_OPENING = "To start, please tell me a little about your background and what interests you in this kind of work."
SHARED_CLOSING = "Before we wrap up, is there anything about your experience you would like to add that we have not covered?"

GENERIC_FOLLOWUPS = {
    "no_specific_example": ("a specific occasion", "Could you walk me through one specific time that happened?"),
    "no_outcome": ("how it turned out", "And how did that turn out in the end?"),
    "no_personal_role": ("their own part in it", "What was your own part in that, specifically?"),
    "no_measure": ("the size or scale of it", "Roughly how big was that, in terms of time, amount, or people involved?"),
    "unclear_answer": ("what they meant", "I want to make sure I understood. Could you say a bit more about what you meant?"),
    "mentions_conflict": ("how the disagreement was handled", "How did you work through that disagreement?"),
    "mentions_mistake": ("what they changed afterward", "What did you change afterward because of that?"),
    "mentions_tool_or_method": ("how the tool or method was used", "How did you use that in your day-to-day work?"),
    "mentions_leadership": ("how they guided others", "How did you go about guiding the people you were working with?"),
    "mentions_time_pressure": ("how they set priorities", "How did you decide what to do first?"),
    "mentions_improvement": ("how they knew the change worked", "How did you know the change actually worked?"),
    "mentions_customer": ("how the other person responded", "How did the person you were helping respond?"),
    "skips_safety_or_compliance_step": ("the checks they would normally make", "What checks would you normally make at that point?"),
    "strong_answer_stretch": ("a harder version of the situation", "Suppose that situation were more difficult. What would you do differently?"),
}
