"""Accommodation profiles (APs) for the AI interviewer test personas.

Each AP describes ONE way of using the interviewer: the assistive technology,
the app settings (keys follow SPEC.md 3.4 and 4.2-4.5), browser/OS emulation for
automation, the WCAG 2.2 success criteria worth testing, the spec rules to
assert, and what the human tester should do while playing the persona.

Everything here is a proposal for test planning. Verify SC numbers and levels
against WCAG 2.2 before citing them in a report.
"""
import copy

# --- WCAG 2.2 success criteria used below: id -> (name, level) -----------------
WCAG = {
    "1.2.4": ("Captions (Live)", "AA"),
    "1.3.1": ("Info and Relationships", "A"),
    "1.3.2": ("Meaningful Sequence", "A"),
    "1.3.4": ("Orientation", "AA"),
    "1.4.1": ("Use of Color", "A"),
    "1.4.2": ("Audio Control", "A"),
    "1.4.3": ("Contrast (Minimum)", "AA"),
    "1.4.4": ("Resize Text", "AA"),
    "1.4.8": ("Visual Presentation", "AAA"),
    "1.4.10": ("Reflow", "AA"),
    "1.4.11": ("Non-text Contrast", "AA"),
    "1.4.12": ("Text Spacing", "AA"),
    "1.4.13": ("Content on Hover or Focus", "AA"),
    "2.1.1": ("Keyboard", "A"),
    "2.1.2": ("No Keyboard Trap", "A"),
    "2.1.4": ("Character Key Shortcuts", "A"),
    "2.2.1": ("Timing Adjustable", "A"),
    "2.2.2": ("Pause, Stop, Hide", "A"),
    "2.3.1": ("Three Flashes or Below Threshold", "A"),
    "2.3.3": ("Animation from Interactions", "AAA"),
    "2.4.3": ("Focus Order", "A"),
    "2.4.6": ("Headings and Labels", "AA"),
    "2.4.7": ("Focus Visible", "AA"),
    "2.4.11": ("Focus Not Obscured (Minimum)", "AA"),
    "2.5.1": ("Pointer Gestures", "A"),
    "2.5.2": ("Pointer Cancellation", "A"),
    "2.5.3": ("Label in Name", "A"),
    "2.5.7": ("Dragging Movements", "AA"),
    "2.5.8": ("Target Size (Minimum)", "AA"),
    "3.2.1": ("On Focus", "A"),
    "3.2.2": ("On Input", "A"),
    "3.2.6": ("Consistent Help", "A"),
    "3.3.2": ("Labels or Instructions", "A"),
    "3.3.7": ("Redundant Entry", "A"),
    "4.1.2": ("Name, Role, Value", "A"),
    "4.1.3": ("Status Messages", "AA"),
}

# --- Repo spec rules referenced (only IDs/sections seen in the repo) ----------
SPEC = {
    "EVL-FAI-001": "Evaluator must not lower a score because an accommodation was used (captions, push-to-talk, a hold, switch to text).",
    "CUE-CTL-001": "User can pause, resume, repeat, skip, ask for a hint, ask for a moment, and switch voice/text; push-to-talk available.",
    "CUE-MOD-002": "Switching mode takes effect at once, no restart, no replay.",
    "ORC-MOD-001": "Switch between voice and text mid-session without losing history.",
    "CUE-AMB-001": "Ambient sound has an independent volume and off switch.",
    "CUE-CAP-001/002": "Captions have accurate and as_heard modes; a captions user is not penalised by degraded audio.",
    "SPEC 4.2": "Accessibility button visible on every screen, first focus on load, every audio cue has a visual equivalent and vice versa.",
    "SPEC 4.3": "Screen reader mode: one speaker at a time, gate on played audio, coalesced announcements, navigable transcript (role=log).",
    "SPEC 4.5": "Advanced Accessibility: screen reader profiles (Generic, NVDA, JAWS, Narrator, VoiceOver macOS/iOS, TalkBack, Orca); untested profiles behave like Generic.",
    "SPEC 4.1": "End interview is a separate control with a confirmation whose safe choice takes focus; Uninterruptible states show a text banner and a hold.",
}

BASE = {
    "interface": "voice",  # voice | text | both
    "ux": {
        "cue_mode": "perceived",
        "captions": "off",  # off | accurate | as_heard
        "interviewer_voice": "on",
        "ambient_audio": True,
        "ambient_volume": 0.3,
        "reduced_motion": "auto",
    },
    "turn_detector": {"push_to_talk": False, "vad_stop_secs": 0.2, "max_silence_secs": 2.0},
    "simulator": {"preset": "clean", "seed": 42},
    "accessibility_panel": {
        "screen_reader_mode": False,
        "sr_profile": "Generic",
        "announcements": "quiet_while_speaking",  # quiet_while_speaking | always | off
        "announce_talking": False,
        "reader_rate_wpm": None,
        "live_captions_to_sr": False,
        "caption_size": "default",  # proposal: default | large | x-large
        "pause_timing": "default",  # proposal: default | extended
    },
    "environment": {
        "browser": "chromium",
        "os": "Windows 11",
        "viewport": {"w": 1280, "h": 800},
        "device_scale_factor": 1,
        "browser_zoom_pct": 100,
        "prefers_reduced_motion": False,
        "forced_colors": False,
        "color_scheme": "light",
        "vision_deficiency": "none",  # none | deuteranopia | protanopia | tritanopia | achromatopsia
        "input": "mouse+keyboard",
        "assistive_tech": None,
        "braille_display": False,
        "user_css": None,
        "pointer_jitter_px": 0,
    },
}

TEXT_SPACING_CSS = (
    "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; "
    "word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }"
)  # WCAG 1.4.12 test values


def _ap(label, category, simulates, overrides, wcag, spec, events, notes, automation, manual=None):
    return {
        "label": label,
        "category": category,
        "simulates": simulates,
        "overrides": overrides,
        "wcag": wcag,
        "spec_checks": spec,
        "control_events_to_exercise": events,
        "tester_notes": notes,
        "automation": automation,  # automated | hybrid | manual_required
        "manual_note": manual,
    }


ALL_SR = ["1.3.1", "1.3.2", "2.4.3", "2.4.6", "4.1.2", "4.1.3", "2.1.1", "2.1.2", "2.1.4", "1.4.2"]
SR_SPEC = ["SPEC 4.2", "SPEC 4.3", "SPEC 4.5", "SPEC 4.1", "CUE-AMB-001", "EVL-FAI-001"]
SR_NOTE = [
    "Wear headphones; speaker playback can leak into the mic (SPEC 4.1 echo trap).",
    "Listen for screen reader speech colliding with the interviewer's voice, and for any state announced twice.",
    "Confirm 'Your turn' is announced only after the interviewer's last audio has played.",
    "Confirm the transcript (role=log) can be navigated by reading commands.",
]
SR_MANUAL = "Real screen reader pass required; automated tools (axe-core etc.) catch only part of the issues (docs/research/ui-testing-tools.md)."

APS = {
    # ------------------------------------------------------------ neurotypical
    "nt_voice": _ap(
        "Neurotypical, voice, defaults", "neurotypical",
        "Candidate using voice with all defaults and no assistive technology.",
        {}, ["2.1.1", "4.1.2", "3.3.2", "1.4.3"],
        ["EVL-FAI-001", "CUE-CTL-001", "SPEC 4.2"],
        ["give_me_a_sec"],
        ["Control run: answer naturally in turns; no accommodations.", "Use this persona to establish baseline scores and latency to compare every other persona against."],
        "automated"),
    "nt_text_first": _ap(
        "Neurotypical, text-first, switches to voice", "neurotypical",
        "Candidate who prefers typing and tries voice partway through.",
        {"interface": "text"}, ["2.1.1", "3.3.2", "4.1.3"],
        ["ORC-MOD-001", "CUE-MOD-002", "EVL-FAI-001"],
        ["switch_voice_text"],
        ["Start in text, switch to voice after question 2, then back to text.", "History must stay intact; nothing replays."],
        "automated"),
    "nt_rough_day": _ap(
        "Neurotypical, bad connection simulator", "neurotypical",
        "Candidate on a poor network, using the Conditions Simulator's hardest preset.",
        {"simulator": {"preset": "rough_day", "seed": 7}}, ["4.1.3", "2.2.1"],
        ["EVL-FAI-001", "CUE-CTL-001"],
        ["repeat", "give_me_a_sec"],
        ["Ask for a repeat after any clipped question.", "Check recovery moments: long silence, false cutoff, first-time simulator notice."],
        "automated"),
    # ------------------------------------------------------------ blind
    "blind_nvda_chrome": _ap(
        "Blind, NVDA + Chrome (Windows)", "vision",
        "Totally blind candidate using NVDA with speech output, keyboard only.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "NVDA", "reader_rate_wpm": 250},
         "environment": {"input": "keyboard_only", "assistive_tech": "NVDA"}},
        ALL_SR, SR_SPEC, ["pause", "repeat", "give_me_a_sec"], SR_NOTE, "hybrid", SR_MANUAL),
    "blind_jaws_chrome": _ap(
        "Blind, JAWS + Chrome (Windows)", "vision",
        "Blind candidate using JAWS at a fast speech rate.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "JAWS", "reader_rate_wpm": 350},
         "environment": {"input": "keyboard_only", "assistive_tech": "JAWS"}},
        ALL_SR, SR_SPEC, ["pause", "repeat", "hint"],
        SR_NOTE + ["Spec notes JAWS+Chrome may speak polite regions at the first break; watch for late announcements."], "hybrid", SR_MANUAL),
    "blind_voiceover_macos_safari": _ap(
        "Blind, VoiceOver + Safari (macOS)", "vision",
        "Blind candidate on a Mac using VoiceOver; announcements always on (ducking user).",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "VoiceOver on macOS", "announcements": "always", "reader_rate_wpm": 220},
         "environment": {"browser": "webkit", "os": "macOS", "input": "keyboard_only", "assistive_tech": "VoiceOver (macOS)"}},
        ALL_SR, SR_SPEC, ["pause", "repeat"], SR_NOTE + ["Try the 'always announce' setting and note collisions with the voice."], "hybrid", SR_MANUAL),
    "blind_voiceover_ios_safari": _ap(
        "Blind, VoiceOver + Safari (iPhone)", "vision",
        "Blind candidate on an iPhone using VoiceOver gestures.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "VoiceOver on iOS and iPadOS", "reader_rate_wpm": 240},
         "environment": {"browser": "webkit", "os": "iOS", "viewport": {"w": 390, "h": 844}, "device_scale_factor": 3,
                         "input": "touch", "assistive_tech": "VoiceOver (iOS)"}},
        ALL_SR + ["1.3.4", "2.5.1", "2.5.8"], SR_SPEC, ["pause", "repeat", "give_me_a_sec"],
        SR_NOTE + ["Run in portrait and landscape; no controls may need a multi-finger or path gesture.", "Check mic permission prompt is reachable with VoiceOver."], "manual_required", SR_MANUAL),
    "blind_talkback_android_chrome": _ap(
        "Blind, TalkBack + Chrome (Android)", "vision",
        "Blind candidate on Android using TalkBack.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "TalkBack", "reader_rate_wpm": 230},
         "environment": {"os": "Android", "viewport": {"w": 412, "h": 915}, "device_scale_factor": 2.6,
                         "input": "touch", "assistive_tech": "TalkBack"}},
        ALL_SR + ["1.3.4", "2.5.1", "2.5.8"], SR_SPEC, ["pause", "repeat"],
        SR_NOTE + ["Spec notes TalkBack treats every live region as assertive; confirm no state is announced twice."], "manual_required", SR_MANUAL),
    "blind_narrator_edge": _ap(
        "Blind, Narrator + Edge (Windows)", "vision",
        "Blind candidate using Windows Narrator with Edge.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "Narrator", "reader_rate_wpm": 240},
         "environment": {"input": "keyboard_only", "assistive_tech": "Narrator", "browser_channel": "msedge"}},
        ALL_SR, SR_SPEC, ["pause", "repeat"], SR_NOTE, "hybrid", SR_MANUAL),
    "blind_orca_firefox": _ap(
        "Blind, Orca + Firefox (Linux)", "vision",
        "Blind candidate on Linux using Orca with Firefox.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "Orca", "reader_rate_wpm": 280},
         "environment": {"browser": "firefox", "os": "Linux", "input": "keyboard_only", "assistive_tech": "Orca"}},
        ALL_SR, SR_SPEC, ["pause", "repeat", "hint"], SR_NOTE, "manual_required", SR_MANUAL),
    "blind_braille_display": _ap(
        "Blind, JAWS + refreshable braille display", "vision",
        "Blind candidate who reads output on a braille display; speech may be off.",
        {"interface": "both",
         "ux": {"captions": "accurate", "ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "JAWS", "announcements": "off", "reader_rate_wpm": 300},
         "environment": {"input": "keyboard_only", "assistive_tech": "JAWS", "braille_display": True}},
        ALL_SR + ["1.2.4"], SR_SPEC + ["CUE-CAP-001/002"], ["pause", "repeat", "switch_voice_text"],
        ["Spec says live regions may not reach a braille display; rely on the navigable transcript.", "Turn announcements off (chime and transcript only) and confirm the session is still usable.",
         "Confirm the Uninterruptible notice is on screen as text, not only announced."], "manual_required", SR_MANUAL + " Needs a physical or emulated braille display."),
    # ------------------------------------------------------------ deafblind / deaf / HoH
    "deafblind_braille_text": _ap(
        "Deafblind, braille display, text interview", "multiple",
        "Candidate who cannot rely on audio or sight: text interface, braille display, live captions to the screen reader.",
        {"interface": "text",
         "ux": {"captions": "accurate", "interviewer_voice": "off", "ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"screen_reader_mode": True, "sr_profile": "NVDA", "announcements": "quiet_while_speaking",
                                 "live_captions_to_sr": True, "reader_rate_wpm": 150, "pause_timing": "extended"},
         "environment": {"input": "keyboard_only", "assistive_tech": "NVDA", "braille_display": True}},
        ALL_SR + ["1.2.4", "2.2.1"], SR_SPEC + ["CUE-CAP-001/002", "ORC-MOD-001"], ["pause", "repeat", "give_me_a_sec"],
        ["Live captions append one final sentence at a time, never word by word.", "No cue may depend on sound; check every audio cue has a text/visual twin.",
         "Take extra time on every turn; the session must not time out."], "manual_required", SR_MANUAL + " Needs a braille display."),
    "deaf_asl_text": _ap(
        "Deaf (ASL), captions on, answers by text", "hearing",
        "Deaf candidate who uses captions and replies by typing; cannot hear the 'your turn' chime.",
        {"interface": "both", "ux": {"captions": "accurate", "ambient_audio": False, "ambient_volume": 0.0},
         "environment": {"input": "mouse+keyboard"}},
        ["1.2.4", "1.4.1", "1.4.2", "4.1.3", "2.2.1", "3.3.2"], ["SPEC 4.2", "CUE-CAP-001/002", "ORC-MOD-001", "EVL-FAI-001"],
        ["switch_voice_text", "repeat"],
        ["Turn captions on in one press from the Accessibility button and from the main screen.", "Confirm every audio cue has a visual equivalent: 'Your turn', Thinking, Uninterruptible.",
         "Reply by typing after the first question; the typed answers must be scored the same as spoken ones."], "hybrid",
        "Caption accuracy and perceived timing should be judged by a human reader."),
    "hard_of_hearing": _ap(
        "Hard of hearing, captions + clipped audio", "hearing",
        "Candidate with partial hearing loss using captions, on a laggy clipped call.",
        {"ux": {"captions": "accurate", "ambient_audio": False, "ambient_volume": 0.0},
         "simulator": {"preset": "laggy_clipped", "seed": 11}},
        ["1.2.4", "1.4.2", "4.1.3", "1.4.1"], ["CUE-CAP-001/002", "CUE-AMB-001", "EVL-FAI-001", "SPEC 4.2"],
        ["repeat"],
        ["Run with the laggy_clipped preset and accurate captions: captions must show true text even when audio is clipped.", "Compare with as_heard mode (hard-mode practice); the user relying on captions must not be penalised.",
         "Use the interviewer voice volume control; ambient sound off."], "hybrid", "Judge audio intelligibility by ear."),
    "deaf_low_vision_usher": _ap(
        "Deaf + low vision, text interface, magnified high contrast", "multiple",
        "Candidate with combined hearing and vision loss using magnification, large captions and a text interview.",
        {"interface": "text",
         "ux": {"captions": "accurate", "interviewer_voice": "off", "ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"caption_size": "x-large", "pause_timing": "extended"},
         "environment": {"browser_zoom_pct": 300, "color_scheme": "dark", "forced_colors": True, "input": "mouse+keyboard",
                         "assistive_tech": "Screen magnifier (OS)"}},
        ["1.4.3", "1.4.4", "1.4.10", "1.4.11", "1.4.12", "1.4.13", "2.4.7", "2.4.11", "1.2.4", "2.2.1"],
        ["SPEC 4.2", "CUE-CAP-001/002", "EVL-FAI-001"], ["pause", "give_me_a_sec"],
        ["At 300% zoom nothing may need two-dimensional scrolling and the focus ring must stay visible and unobscured.", "Check large captions do not push controls off screen.", "Forced-colors mode must keep icons, state cues and the End interview control distinguishable."],
        "hybrid", "Magnifier tracking behaviour needs a human."),
    # ------------------------------------------------------------ low vision
    "low_vision_zoom_400": _ap(
        "Low vision, 400% zoom / reflow", "vision",
        "Candidate magnifying the page to 400% (320 CSS px wide) with large captions.",
        {"ux": {"captions": "accurate"},
         "accessibility_panel": {"caption_size": "x-large"},
         "environment": {"viewport": {"w": 1280, "h": 1024}, "browser_zoom_pct": 400, "input": "mouse+keyboard"}},
        ["1.4.3", "1.4.4", "1.4.10", "1.4.11", "1.4.12", "2.4.7", "2.4.11", "1.3.4", "2.5.8"],
        ["SPEC 4.2", "CUE-CAP-001/002", "SPEC 4.1"], ["pause", "repeat"],
        ["No horizontal scrolling at 320 CSS px; no clipped or overlapping controls.", "Accessibility button must remain visible and first in focus order.", "Check the End interview control and its confirmation at 400%."],
        "automated"),
    "low_vision_forced_colors": _ap(
        "Low vision, Windows high contrast (forced colors)", "vision",
        "Candidate using an OS high-contrast theme.",
        {"environment": {"forced_colors": True, "color_scheme": "dark", "browser_zoom_pct": 150}},
        ["1.4.1", "1.4.3", "1.4.11", "2.4.7", "1.4.4"], ["SPEC 4.2", "SPEC 4.1"], ["pause"],
        ["State cues (ear, thought bubble, ellipsis, ear with slash) must survive forced colors and still carry text labels.", "Focus ring and the captions switch state must be visible without author colors."],
        "automated"),
    # ------------------------------------------------------------ color vision
    "colorblind_deuteranopia": _ap(
        "Color vision: deuteranopia", "vision",
        "Candidate with red-green color vision deficiency (deuteranopia).",
        {"environment": {"vision_deficiency": "deuteranopia"}},
        ["1.4.1", "1.4.3", "1.4.11", "4.1.2"], ["SPEC 4.2"], ["pause"],
        ["Status, mic level, error and success states must be distinguishable without color alone.", "Check the simulator badge and call-conditions preset selector."], "automated"),
    "colorblind_protanopia": _ap(
        "Color vision: protanopia", "vision",
        "Candidate with protanopia (red-weak/blind).",
        {"environment": {"vision_deficiency": "protanopia"}},
        ["1.4.1", "1.4.3", "1.4.11"], ["SPEC 4.2"], ["pause"],
        ["Red 'recording / error' versus green 'ok' cues need shape or text twins.", "Check captions on/off switch state."], "automated"),
    "colorblind_tritanopia": _ap(
        "Color vision: tritanopia", "vision",
        "Candidate with tritanopia (blue-yellow).",
        {"environment": {"vision_deficiency": "tritanopia"}},
        ["1.4.1", "1.4.3", "1.4.11"], ["SPEC 4.2"], ["pause"],
        ["Check blue/yellow state pairs, charts or meters in the report view, and link versus text color."], "automated"),
    "colorblind_achromatopsia": _ap(
        "Color vision: achromatopsia, light-sensitive", "vision",
        "Candidate seeing in grayscale and sensitive to bright light; prefers dark mode.",
        {"environment": {"vision_deficiency": "achromatopsia", "color_scheme": "dark"}},
        ["1.4.1", "1.4.3", "1.4.11", "2.4.7"], ["SPEC 4.2"], ["pause"],
        ["Run the full flow in grayscale and dark mode; every state still distinguishable by shape and text.", "Check the contrast of cue icons on the dark theme."], "automated"),
    # ------------------------------------------------------------ motor
    "motor_keyboard_only": _ap(
        "Motor: keyboard only", "motor",
        "Candidate who cannot use a pointing device and navigates by keyboard alone.",
        {"environment": {"input": "keyboard_only"}},
        ["2.1.1", "2.1.2", "2.1.4", "2.4.3", "2.4.7", "2.4.11", "3.2.1", "4.1.2"],
        ["SPEC 4.2", "SPEC 4.1", "CUE-CTL-001"], ["pause", "repeat", "skip", "hint", "give_me_a_sec"],
        ["Complete Setup, Hardware check, the interview and End interview using Tab, Shift+Tab, Enter, Space and Esc only.", "After load, focus must land on the Accessibility button first.",
         "Confirm single-character shortcuts can be turned off or remapped."], "automated"),
    "motor_voice_control": _ap(
        "Motor: voice control (Dragon / OS voice control)", "motor",
        "Candidate operating the page by speaking commands, using push-to-talk to keep commands out of the interview.",
        {"turn_detector": {"push_to_talk": True},
         "environment": {"input": "voice_control", "assistive_tech": "Voice control software"}},
        ["2.5.3", "4.1.2", "2.1.1", "2.4.6", "2.5.8", "3.3.2"], ["CUE-CTL-001", "SPEC 4.1", "EVL-FAI-001"],
        ["push_to_talk", "pause", "give_me_a_sec"],
        ["Every control's spoken name must match its visible label (2.5.3).", "Check that voice commands to the page are not captured as interview answers (use push-to-talk).",
         "Icon-only buttons need visible or addressable names."], "hybrid", "Voice-control software needs a human run."),
    "motor_switch_scanning": _ap(
        "Motor: single-switch scanning, extended time", "motor",
        "Candidate using one switch with scanning; slow input and needs extra time.",
        {"turn_detector": {"push_to_talk": True, "max_silence_secs": 8.0},
         "accessibility_panel": {"pause_timing": "extended"},
         "environment": {"input": "switch_scanning", "assistive_tech": "Switch access"}},
        ["2.1.1", "2.1.2", "2.2.1", "2.2.2", "2.4.3", "2.4.7", "2.5.1", "2.5.7", "3.2.1"],
        ["CUE-CTL-001", "EVL-FAI-001", "SPEC 4.2"], ["push_to_talk", "pause", "give_me_a_sec", "repeat"],
        ["Focus order must be linear and logical for scanning; no keyboard traps.", "Long gaps between actions must not end the session or lower the score.",
         "No dragging or path gestures anywhere in the flow."], "manual_required", "Switch scanning needs a real or emulated switch."),
    "motor_tremor_one_hand": _ap(
        "Motor: hand tremor / one-handed use", "motor",
        "Candidate with imprecise pointer control, operating with one hand.",
        {"environment": {"pointer_jitter_px": 8, "input": "mouse+keyboard"}},
        ["2.5.1", "2.5.2", "2.5.7", "2.5.8", "2.4.7", "2.1.4", "3.3.2"], ["SPEC 4.1", "CUE-CTL-001"],
        ["pause", "repeat"],
        ["Mis-click near controls; End interview must not be hit by accident, and its confirmation must default to 'Keep going'.", "Check target sizes of at least 24x24 CSS px or sufficient spacing.",
         "Test with one-handed keyboard use and any shortcuts."], "automated"),
    # ------------------------------------------------------------ speech
    "speech_stutter": _ap(
        "Speech: stutter / disfluent speech", "speech",
        "Candidate who stutters; repetitions, blocks and long pauses mid-answer.",
        {"turn_detector": {"vad_stop_secs": 0.6, "max_silence_secs": 5.0, "push_to_talk": False}},
        ["2.2.1", "3.3.2"], ["CUE-CTL-001", "EVL-FAI-001", "SPEC 4.2"],
        ["give_me_a_sec", "repeat"],
        ["Use recorded or synthesized disfluent speech: syllable repetitions and 3-5 second blocks inside one answer. Do not caricature.",
         "Count false cutoffs: the interviewer must not talk over the candidate.", "Fluency must not reduce the content score (EVL-FAI-001)."], "hybrid",
        "Needs recorded or synthesized disfluent audio to drive the microphone."),
    "speech_aac_text": _ap(
        "Speech: AAC / dysarthria, answers by text", "speech",
        "Candidate who communicates with an AAC device or typed text; long gaps before answers.",
        {"interface": "both", "turn_detector": {"push_to_talk": True, "max_silence_secs": 20.0},
         "accessibility_panel": {"pause_timing": "extended"}},
        ["2.2.1", "2.2.2", "3.3.2", "3.3.7", "2.1.1"], ["ORC-MOD-001", "CUE-CTL-001", "EVL-FAI-001"],
        ["switch_voice_text", "give_me_a_sec", "push_to_talk"],
        ["Answer with pre-composed pasted text after a 30-60 second gap.", "The session must not time out or move on without the candidate.", "Typed answers must score the same as spoken ones."], "automated"),
    # ------------------------------------------------------------ neurodivergent / cognitive
    "dyslexia": _ap(
        "Dyslexia: text spacing, captions, read-aloud", "neurodivergent",
        "Candidate with dyslexia who reads slowly, uses text-spacing overrides and a read-aloud tool.",
        {"interface": "both", "ux": {"captions": "accurate", "ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"pause_timing": "extended"},
         "environment": {"user_css": TEXT_SPACING_CSS, "assistive_tech": "Read-aloud (text to speech)"}},
        ["1.4.12", "1.4.4", "1.4.8", "2.2.1", "3.3.2"],
        ["CUE-CAP-001/002", "EVL-FAI-001", "SPEC 4.2"], ["repeat", "pause", "switch_voice_text"],
        ["Apply the 1.4.12 text-spacing override and confirm nothing clips or overlaps.", "Use captions to re-read the question; spelling errors in typed answers must not lower the score.",
         "Interviewer wording should be short and one question at a time (INT constraints)."], "hybrid", "Readability is a human judgment."),
    "adhd": _ap(
        "ADHD: pacing, interruptions, low distraction", "neurodivergent",
        "Candidate with ADHD who loses the thread, needs repeats and benefits from a calm interface.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "environment": {"prefers_reduced_motion": True}},
        ["2.2.1", "2.2.2", "2.3.3", "1.4.2", "3.2.1", "3.2.2"], ["CUE-CTL-001", "EVL-FAI-001", "SPEC 4.1"],
        ["repeat", "pause", "hint", "give_me_a_sec"],
        ["Drift off-topic once, then ask for a repeat; ask for a hint on a question you pretend to be stuck on.", "Pause mid-session for a few minutes and resume; resuming repeats the Uninterruptible notice once.",
         "Check that nothing moves or sounds without a way to stop it."], "hybrid", "Pacing and distraction need a human tester."),
    "autism_sensory": _ap(
        "Autism: literal language, sensory sensitivity", "neurodivergent",
        "Candidate on the autism spectrum who interprets questions literally and is sensitive to sudden sounds and motion.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "environment": {"prefers_reduced_motion": True}},
        ["1.4.2", "2.2.2", "2.3.3", "3.2.1", "3.2.2", "3.3.2", "3.2.6"], ["CUE-AMB-001", "SPEC 4.1", "SPEC 4.2", "EVL-FAI-001"],
        ["repeat", "hint", "give_me_a_sec"],
        ["Ask what an ambiguous question means ('tell me about yourself') and check the interviewer can rephrase concretely.", "The chime and thinking sounds must be mutable and not startling; cues must be predictable and consistent.",
         "The Uninterruptible notice and hold must be clearly explained; no surprise state changes."], "hybrid", "Sensory comfort is a human judgment."),
    "adhd_dyslexia": _ap(
        "ADHD + dyslexia", "neurodivergent",
        "Candidate with both ADHD and dyslexia: needs captions, spacing, calm UI and repeats.",
        {"interface": "both", "ux": {"captions": "accurate", "ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"pause_timing": "extended"},
         "environment": {"prefers_reduced_motion": True, "user_css": TEXT_SPACING_CSS}},
        ["1.4.12", "1.4.4", "2.2.1", "2.2.2", "2.3.3", "1.4.2", "3.3.2"], ["CUE-CAP-001/002", "CUE-CTL-001", "EVL-FAI-001"],
        ["repeat", "pause", "hint", "give_me_a_sec", "switch_voice_text"],
        ["Combine the dyslexia and ADHD behaviours: captions on, text spacing override, frequent repeats and a mid-session pause.", "Check combined settings do not conflict (captions size vs spacing vs reduced motion)."], "hybrid"),
    "tbi_memory_processing": _ap(
        "Cognitive: slower processing and memory (brain injury)", "cognitive",
        "Candidate with slower processing speed and short-term memory difficulty; needs time, repeats and a record of the conversation.",
        {"interface": "both", "ux": {"captions": "accurate", "ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"pause_timing": "extended"},
         "turn_detector": {"vad_stop_secs": 0.5, "max_silence_secs": 6.0, "push_to_talk": False}},
        ["2.2.1", "2.2.2", "3.3.2", "3.3.7", "3.2.6", "1.4.2"], ["CUE-CTL-001", "EVL-FAI-001", "ORC-MOD-001"],
        ["repeat", "hint", "give_me_a_sec", "pause", "resume"],
        ["Ask for each question to be repeated at least twice; ask for a hint on two questions.", "Read earlier questions back from the transcript; check the history persists after a pause and resume.",
         "Do not be asked to re-enter information already given (3.3.7)."], "hybrid"),
    "vestibular_photosensitive": _ap(
        "Vestibular / photosensitive: motion and flash safe", "neurological",
        "Candidate who gets ill from motion or is sensitive to flashing; reduced motion on.",
        {"ux": {"ambient_audio": False, "ambient_volume": 0.0},
         "environment": {"prefers_reduced_motion": True, "color_scheme": "dark"}},
        ["2.3.1", "2.3.3", "2.2.2", "1.4.2", "1.4.3"], ["SPEC 4.2", "SPEC 4.1"], ["pause"],
        ["With prefers-reduced-motion on, confirm the ellipsis, thought bubble, progress bar and mic meter do not animate (or animate only gently).", "Sample frames to confirm nothing flashes more than three times per second.",
         "Check the indeterminate progress bar and the pause control."], "automated"),
    # ------------------------------------------------------------ other
    "non_native_english": _ap(
        "Non-native English speaker (accent, captions on)", "language",
        "Candidate who speaks English as a second language with a strong accent; uses captions to follow fast speech. Not a disability accommodation, included for STT and turn-taking coverage.",
        {"ux": {"captions": "accurate"}, "simulator": {"preset": "decent_call", "seed": 21}},
        ["1.2.4", "3.3.2", "1.4.2"], ["CUE-CAP-001/002", "EVL-FAI-001"], ["repeat", "give_me_a_sec"],
        ["Speak at a natural pace with an accent; use brief pauses to find words.", "Check transcription accuracy on accented speech and domain terms, and that captions remain accurate."],
        "hybrid", "Accent realism needs a human or accented test audio."),
    "older_adult_multi": _ap(
        "Older adult: reduced vision, hearing and dexterity", "multiple",
        "Candidate with several mild age-related changes: needs larger text, captions, louder voice, bigger targets and more time.",
        {"ux": {"captions": "accurate", "ambient_audio": False, "ambient_volume": 0.0},
         "accessibility_panel": {"caption_size": "large", "pause_timing": "extended"},
         "environment": {"browser_zoom_pct": 200, "pointer_jitter_px": 5}},
        ["1.4.3", "1.4.4", "1.4.10", "2.2.1", "2.5.8", "2.5.2", "1.2.4", "2.4.7"], ["SPEC 4.2", "CUE-CAP-001/002", "EVL-FAI-001"],
        ["repeat", "pause", "give_me_a_sec"],
        ["Run at 200% zoom with larger captions and the interviewer voice louder.", "Take longer to start each answer; the session must wait.", "Check controls are easy to hit and the End interview confirmation is clear."], "hybrid"),
}

# persona id -> accommodation profile key
ASSIGNMENT = {
    "RET-01": "nt_voice", "RET-02": "blind_nvda_chrome", "RET-03": "colorblind_deuteranopia",
    "RET-04": "dyslexia", "RET-05": "motor_tremor_one_hand",
    "HOS-01": "hard_of_hearing", "HOS-02": "adhd", "HOS-03": "speech_stutter", "HOS-04": "blind_voiceover_ios_safari",
    "HLT-01": "nt_text_first", "HLT-02": "deaf_asl_text", "HLT-03": "autism_sensory",
    "HLT-04": "low_vision_zoom_400", "HLT-05": "adhd_dyslexia",
    "LOG-01": "nt_rough_day", "LOG-02": "motor_voice_control", "LOG-03": "non_native_english",
    "LOG-04": "tbi_memory_processing", "LOG-05": "vestibular_photosensitive",
    "MFG-01": "colorblind_achromatopsia", "MFG-02": "motor_switch_scanning",
    "MFG-03": "blind_braille_display", "MFG-04": "blind_narrator_edge",
    "FIN-01": "nt_voice", "FIN-02": "blind_jaws_chrome", "FIN-03": "colorblind_tritanopia",
    "FIN-04": "deafblind_braille_text", "FIN-05": "older_adult_multi",
    "TEC-01": "blind_orca_firefox", "TEC-02": "blind_voiceover_macos_safari", "TEC-03": "colorblind_protanopia",
    "TEC-04": "deaf_low_vision_usher", "TEC-05": "motor_keyboard_only",
    "MED-01": "blind_talkback_android_chrome", "MED-02": "speech_aac_text", "MED-03": "low_vision_forced_colors",
}


def _merge(base, over):
    out = copy.deepcopy(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def resolve(ap_key):
    """Full effective config for an AP: BASE merged with that AP's overrides."""
    return _merge(BASE, APS[ap_key]["overrides"])
