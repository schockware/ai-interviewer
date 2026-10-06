*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Screen readers and live updates: keeping announcements out of the interviewer's way

Research date and source access date: 2026-10-06. Input to the cue layer (`specs/cues`: CUE-ANN-001, CUE-ANN-002, CUE-RED-001, CUE-CAP-*, CUE-CTL-*), the accessibility section of SPEC §4.2, and the screen-reader pass still missing from `src/prototypes/ui/audit/main-page.md`. Companion to [latency-perception.md](latency-perception.md) (cue timing) and [micro-pauses-and-run-ons.md](micro-pauses-and-run-ons.md) (false cutoffs that flip cues quickly).

Conventions: **[unverified]** marks a claim from a search excerpt, a single anecdotal source, or my own inference. **[verified]** means I read the page. Anything labeled a **proposal** is my suggestion to tune and test, not a finding.

**The problem, stated.** A screen reader (SR) user hears up to three audio sources at once: the interviewer's synthesized voice (the content), the SR's own speech (UI changes, captions, focus), and our cue sounds (chime, ambient bed). The page controls only the first and third. It cannot see or pause the SR, and ARIA has no way to say "hold announcements while audio plays." So collisions have to be avoided by *what we send to the SR, and when*, plus a few user settings. A fourth source matters too: on speakers, SR speech can leak into the microphone and trigger the turn detector (SPEC §4.1 echo trap).

## Summary

- **A polite live region does not protect the interviewer's voice.** `aria-live="polite"` waits until the *screen reader* is idle, not until *other audio* has stopped. The SR knows nothing about our TTS. So the current prototype (a polite region, one announcement per displayed change) can still talk over the interviewer, and the audit already notes this is unconfirmed.
- **The lever is a page-side announcement policy.** Decide, per state, whether to announce at all; wait for a quiet moment when the interviewer is talking; drop announcements that a newer state has replaced; and keep them short. Proposals in §5.
- **Do not announce "interviewer is talking."** The user hears the voice, and the announcement lands on the first words. SPEC §4 already lists the screen-reader output for Talking as optional. Treat it as off by default.
- **Do not make captions a live region by default.** Reading captions aloud over the voice that is already speaking them is the worst collision, and an endlessly updating live region is the documented "too chatty" failure. Offer a navigable transcript (read on demand), and a live-caption option for people who need it.
- **Deafblind and braille users need the transcript on the page.** Live regions are reported not to reach braille displays reliably **[unverified]**. A transcript they can read by moving through the page works for them.
- **Support for live regions is inconsistent across SR and browser pairs,** so behavior must be tested, not assumed. Two things are consistent: the region must exist and be empty before it is filled, and rapid updates may be batched so only the last is spoken.
- **Users can already duck audio.** NVDA, JAWS and VoiceOver can lower other audio while they speak. That helps the user hear the SR, but it lowers the interviewer's voice, and the page cannot detect it. Tell users it exists, don't depend on it.
- **`ariaNotify()` is a new alternative to live regions** (Baseline 2026 per MDN, but one source says only Firefox fully supports it). Use it only as a progressive enhancement behind a live-region fallback, never both at once.

## 1. Standards that apply

| Criterion | What it says | Why it matters here | Status |
|---|---|---|---|
| **WCAG 2.2 SC 4.1.3 Status Messages** (AA) | Status messages must be programmatically determinable through role or properties, so assistive tech can present them *without receiving focus* | Our state cues ("your turn", "thinking") are status messages. Do not move focus to announce them | **[verified]** |
| Same page, the caution | "There is a risk of making an application too 'chatty' for a screen reader user. User testing should be carried out." | The standard itself warns against the failure mode we are designing against | **[verified]** |
| **SC 1.4.2 Audio Control** (A) | Audio that plays automatically for more than 3 s needs a way to pause or stop it, or a volume control independent of the system volume. Muting the system volume does not count | The page's own text says people using a screen reader "can find it hard to hear the speech output if there is other audio playing." Applies to ambient audio (CUE-AMB-001) and arguably to long interviewer speech | **[verified]** |
| SC 2.2.2 Pause, Stop, Hide (A), SC 1.2.4 Captions (Live) (AA), SC 2.1.4 Character Key Shortcuts (A) | Moving or updating content needs a pause; live audio needs captions; single-key shortcuts need an off switch or remap | Relevant to caption display, the live interviewer voice, and any keyboard shortcut that pauses the interviewer (§5.6) | **[unverified]** (recalled from memory; confirm against WCAG 2.2) |

Techniques named for 4.1.3 **[verified]**: ARIA22 (`role="status"`, for success and state), ARIA19 (`role="alert"`, for errors), ARIA23 (`role="log"`, for sequential updates).

## 2. How live regions behave

### 2.1 What is documented

| Fact | Source | Status |
|---|---|---|
| `polite` waits until the user is idle and does not interrupt current speech; `assertive` interrupts and should be rare; `off` announces only when focus is in the element | MDN | **[verified]** |
| The live region must exist in the DOM *before* its content changes; if you create it dynamically, add the text after a short delay such as `setTimeout(…, 0)` | MDN; TetraLogical | **[verified]** |
| Pre-populated live regions commonly fail to announce. `role="alert"` is the exception, with inconsistencies. Priming an empty container first, then injecting after a short delay, gives "relatively consistent" results | TetraLogical | **[verified]** |
| `role="status"` implies `aria-live="polite"` and `aria-atomic="true"`; `role="log"` implies polite; `role="alert"` is assertive | WCAG ARIA22; MDN | **[verified]** |
| Redundant `aria-live` on `status` and `log` helps compatibility; on `alert` it can double-speak in VoiceOver on iOS | MDN | **[verified]** |
| Hidden regions (`hidden`, `aria-hidden`, `display:none`) never announce, in every combination tested | Roselli 2026 | **[verified]** |
| Live regions announce plain text only; links and buttons inside an update may not be conveyed | MDN | **[verified]** |
| `aria-relevant`, `aria-atomic` and `aria-busy` lack consistent support, so do not rely on them | Soueidan | **[verified]** |
| Use a persistent element instead of a live region wherever that works; live regions suit transient notices | Soueidan | **[verified]** |

### 2.2 What differs between screen readers

From Roselli's January 2026 support tests (JAWS 2023 and 2026 builds with Chrome; NVDA 2023 to 2025 with Firefox; Narrator with Edge; VoiceOver with Safari on macOS and iPadOS; Orca; TalkBack) **[verified]**:

- Most pairs treat `polite` and `<output>` as polite and speak at a natural break.
- NVDA's `role="alert"` interrupts, then *re-announces the content it interrupted*.
- TalkBack 13.1 treats every region as assertive and does not re-announce what it cut off.
- `role="alert"` does not prefix the word "alert" in JAWS, Narrator, TalkBack or VoiceOver.
- Changes to `aria-describedby` are not announced by VoiceOver, NVDA 2025.3.2, Narrator or Orca.
- In NVDA 2024.1 and later, the braille emulator showed an alert as the word "alert" without its message.

From the search excerpt only **[unverified]**: JAWS with Chrome treats every live region as polite and speaks at the first break rather than the end of a sentence; VoiceOver on macOS is buggy with polite regions in audio and braille.

### 2.3 Rapid updates

- One developer reports that updates sent in quick succession were silently reduced to the last one: "Only 'All done!' might get announced." NVDA "waits a little after an update before announcing, to gather potential additional changes." The fix shown was a 100 ms delay between clearing the region and setting new text. This was checked by hand, not with a test suite **[verified as stated; anecdotal]**.
- A separate note says a current announcement can block or cancel queued ones, with no detail on priorities **[verified as stated; anecdotal]**.

**What this means for us:** the interviewer can change state several times in a second (the prototype's `eager` calibration does exactly that after a false cutoff). Each SR will batch, drop or queue those differently. If we rely on that, the same session sounds different on every SR. The page should coalesce changes itself (§5.3), so the SR only ever sees settled states.

### 2.4 Braille and captions

- A search excerpt says live regions are not shown on braille displays in JAWS and NVDA **[unverified]**. Roselli's alert result (message missing in the braille emulator) points the same way, but is only partial testing.
- An endlessly changing caption set as a live region makes the SR "keep interrupting" **[unverified]** (a GitHub issue and a W3C list excerpt). Several captioned players at once is called a "usability nightmare" in the same results.

## 3. Collision sources in our app

| # | Collision | Cause | Effect |
|---|---|---|---|
| C1 | SR speaks a state change while the interviewer talks | A cue update arrives during TTS playback, and the SR is idle, so a polite region speaks at once | Two voices; the question is partly lost |
| C2 | SR reads captions aloud over the same words | Caption region is live | The user hears the same sentence twice, out of step |
| C3 | Stale announcement | Perceived-mode delay, or a false cutoff, means the state has already changed by the time the SR speaks | The SR says "thinking" while the interviewer is already talking, or "your turn" after the user resumed |
| C4 | Burst of announcements | Several state flips within a second | Batching, dropping or queueing, differing by SR (§2.3) |
| C5 | Chime and spoken "your turn" overlap | Both signal the hand-off | A cluttered moment at the most important cue (CUE-STA-003) |
| C6 | Focus moves | Focus changes make the SR speak the newly focused element | A large unplanned announcement |
| C7 | SR speech enters the microphone | The user is on speakers | VAD hears speech, turn detector may fire or the candidate seems to talk |
| C8 | Ambient bed under SR speech | Our bed runs while the SR speaks | The SR is harder to hear (the 1.4.2 concern) |
| C9 | SR hotkeys against our shortcuts | A single-key shortcut that pauses or repeats | Fires while the user is just reading the page |

C1 to C5 are in our control. C6 to C9 are partly or fully design and documentation issues.

## 4. What users can already do

| Mechanism | What it does | Limits | Status |
|---|---|---|---|
| **NVDA audio ducking** | Modes: no ducking; duck while NVDA speaks or plays sounds; always duck. Toggle NVDA+Shift+D | Windows 8 or later. A bug report (issue 10441) says ducking applies to the main sound device even when NVDA speech is sent to another device | **[verified]** (NV Access issue page; docs via search excerpt) |
| **JAWS audio ducking** | "Lower the volume of other programs while JAWS is speaking," in Settings Center; quick toggle Insert+Space then D | Setting, not default for everyone | **[unverified]** (search excerpt) |
| **VoiceOver ducking** | iOS: Off, When Speaking, Always. macOS: on by default, reduces other audio whenever VoiceOver speaks | A forum report describes volume changing randomly with "When Speaking" | **[unverified]** (search excerpt) |
| **Separate output devices** | NVDA can send speech to a different device than other audio | Needs two devices or a mixer; not everyone has them | **[unverified]**, inferred from the NVDA issue |
| **Headphones** | Keeps the SR out of the microphone and the voice out of the SR's way | A user choice; we can only recommend | common practice |

Ducking is a **mitigation the user owns**. It makes SR speech win against the interviewer's voice, which can hide part of a question. The page cannot know whether it is on, so the safest design leaves the interviewer's voice alone during announcements by sending fewer of them.

## 5. Recommendations (proposals to test)

### 5.1 One speaker at a time

Treat the interviewer's voice as the **foreground channel** while it plays. Anything bound for the SR that is not urgent waits until the voice stops (the talking to listening transition), and is then delivered once. This is the page-side equivalent of the "double-talk policy" in SPEC §5.4.

### 5.2 Per-state announcement policy

| State or event | Announce? | Priority | Why |
|---|---|---|---|
| Listening ("your turn") | Yes, once, when the interviewer's audio has ended | polite, `role="status"` | The hand-off cue (CUE-STA-003). Coincides with the quiet moment, so no collision. If the chime is on, the text and chime together are the multi-sense cue |
| Thinking | Yes, but only if it lasts longer than a short threshold; skip if replaced quickly | polite | A pause must not read as a stall (CUE-STA-002), but a 300 ms flip is noise. Threshold is a proposal, start near 500 ms |
| **Talking** | **No** (off by default; a user option) | n/a | The user hears it. The announcement would hit the first words. SPEC §4 already marks the SR output for Talking as optional |
| Idle or paused | Yes | polite | Follows a user action, so there is no surprise and no voice to collide with |
| Control feedback (muted, repeat requested) | Yes, short | polite | Direct response to a key press |
| Errors that block the session (mic lost, connection lost) | Yes | assertive (`role="alert"`) | The one case that justifies interrupting. Expect NVDA to re-announce what it interrupted |
| Simulation badge, first-use explanation | On the first appearance only | polite | CUE-SIM-001. Do not repeat |
| Captions | **Not live by default** (§5.4) | n/a | C2 |

### 5.3 Coalescing and stale-state rules

- **Debounce state announcements** and announce only the state that is current when the debounce ends. A false cutoff (listening, thinking, listening within a second) then announces nothing, or only the final state. The prototype notes already require "must not announce a state that has been replaced by the time it arrives" ([prototype-ui.md](prototype-ui.md), mock calibrations). The debounce makes that rule independent of the SR's own batching. **Proposal:** start at 250 to 500 ms and tune with real SR runs. The developer's 100 ms figure (§2.3) is for clear-then-set timing, not for coalescing.
- **Check the displayed state at speaking time.** The announcement text is chosen when written to the region, from what is on screen then (this is already CUE-ANN-001's "follow the displayed cue").
- **Never announce a state twice** (CUE-ANN-002) and never re-announce the same text: setting identical text into a live region often announces nothing, so do not use that as a repeat trick.
- **Clear then set** with a short delay if the same text must be spoken again, per the 100 ms example. Otherwise leave the region alone.

### 5.4 Captions and the transcript

- **Default:** captions are visible text, with `aria-live` off. The SR does not read them out. They are reachable on demand by moving through the page.
- **Transcript:** a persistent `role="log"` of finished interviewer sentences and the candidate's finished answers, in order, navigable by line. For braille users and anyone who wants to re-read, this is the main channel. (A navigable log fits SC 4.1.3's ARIA23 technique.)
- **Live captions to the SR, optional:** for users who cannot hear the voice (for example deafblind users on braille). When on, append **one sentence at a time**, and only **final** pieces, never interim ones. The event stream already marks final pieces (EVT-TYPE-005). In `accurate` and `as_heard` modes (CUE-CAP-001, 002) the text is whichever mode is active.
- **Never word by word.** Every word appended is a possible interruption.

### 5.5 Focus, sound and brevity

- **Do not move focus** to announce anything (4.1.3 says focus need not move). Focus moves are the largest unplanned announcements (C6).
- **Keep announcements to a few words.** SR users often listen at high speeds, and shorter text means a shorter collision window. "Your turn" beats "The interviewer has finished speaking and it is now your turn." Candidate strings for user testing: "Your turn", "Thinking", "Paused".
- **Keep the chime short, and do not duplicate it with a long spoken cue** (C5). One option: the chime plays, the text appears in the status region at the same moment, and the SR speaks "Your turn" just after it.
- **Ambient bed:** independent volume and off switch (CUE-AMB-001, SC 1.4.2) and off by default for users who set an SR hint. Offer "no ambient sound" as a one-step choice. A bed under SR speech is harder to hear (C8).
- **Independent volume for the interviewer's voice,** separate from system volume, so a user can balance it against their SR (SC 1.4.2 applies to ambient audio at least; for the voice it is a good practice).

### 5.6 Controls

- **Pause or silence the interviewer from the keyboard.** SR users silence the SR with a key (Ctrl) and will look for the same. Offer a documented shortcut that pauses the interviewer. It must not collide with SR hotkeys, and single-character shortcuts need to be off or remappable (SC 2.1.4, **[unverified]**).
- **Do not rely on a single "announce everything" setting.** Offer a three-way user setting, remembered across sessions:
  1. **Quiet while the interviewer speaks** (default, §5.1)
  2. **Always announce** (for users who use ducking and want every change)
  3. **Off** (use the transcript and chime only)
- **First-run note:** say that headphones are recommended, because SR speech and the interviewer's voice can both reach the microphone on speakers (C7).

### 5.7 `ariaNotify()`

- **Status:** MDN lists `Element.ariaNotify()` as Baseline 2026, "newly available since September 2026." Chrome shipped it in version 141 **[unverified]** (search excerpt). A CSS-Tricks article (undated in my fetch) says it was "currently only fully supported in Firefox." These conflict, and I did not test which is current.
- **How it works:** `priority: "normal"` (default) speaks after the current announcement; `"high"` interrupts. Roughly equal to polite and assertive. `aria-live` announcements take priority over `ariaNotify()` **[verified]**.
- **Why consider it:** it needs no pre-existing region, no timing workaround, and is not tied to DOM changes.
- **Why not rely on it:** it leaves no markup, so it can fall out of step with the screen without any test noticing; language handling was inconsistent across JAWS, NVDA and VoiceOver; and the author advises it only where "absolutely, one hundred percent necessary" **[verified as stated]**. It also still cannot see our TTS, so it does not solve C1.
- **Proposal:** keep the live region as the base. If we add `ariaNotify()`, feature-detect it and use *either* the region or the call for a given message, never both, to avoid doubled speech.

## 6. What the prototype does today, and what it implies

From the audit log and the cue spec (not re-read in code):

- A polite live region exists, is empty on load, and receives the new text once per displayed change. This matches the primer-then-fill advice and CUE-ANN-001/002.
- **Open item already recorded:** whether the text is spoken, and what happens with rapid flips (the `eager` scenario), has never been checked with a screen reader.
- **Not yet in the prototype:** a gate on interviewer audio (§5.1), a debounce (§5.3), a Talking opt-out (§5.2), a captions-not-live default and transcript (§5.4), the three-way setting (§5.6), and the first-run headphone note.

Implication: the first SR pass is a good moment to *measure the collisions*, not only to confirm the text is read. §7 lists what to record.

## 7. Testing

- **Playwright cannot hear a screen reader.** It reads the accessibility tree, not speech ([ui-testing-tools.md](ui-testing-tools.md)). It can still assert our own rules: the region is empty at load; nothing is written to it while the mock voice is talking (when the policy says so); a replaced state is never written; one write per settled change; captions are not in a live region by default.
- **Manual SR passes are needed.** WebAIM's 2024 survey (search excerpt, **[unverified]**) puts JAWS with Chrome at almost 25% and NVDA with Chrome at a little over 21% of combinations, with JAWS at 41% and NVDA at 38% as primary screen readers, and VoiceOver at 9.7%. The audit log currently names NVDA with Firefox and Chrome. **Proposal:** add JAWS with Chrome if a licence or the trial mode is available, and VoiceOver with Safari for the macOS and iOS case.
- **Record speech, not only pass or fail.** NVDA's Speech Viewer gives a timestamped transcript of what it says. It was mentioned in a comment and not tested by the source **[unverified]**, but it fits our need: compare it with the mock stream's timeline and count overlaps with interviewer audio.
- **Scenarios to run** (from the existing mock scripts): `simulation-off`; 800 ms delay (late cues); the `eager`, `balanced` and `patient` calibrations (rapid flips and false cutoffs); and a lossy utterance with captions on.
- **What to log per scenario:** SR and browser pair, version, announcements heard and when, overlaps with the interviewer's voice, announcements that arrived after the state changed, and any dropped.
- **Test with users who rely on an SR.** Both the 4.1.3 page and the live-region sources say to user-test the verbosity. A developer's pass is not a substitute.

## 8. Findings for the spec

For the spec owner. I have not edited `specs/` or `SPEC.MD` (beyond the earlier reference line).

1. **CUE-ANN-001 and 002** say what to announce but not when. Add a rule that announcements for state changes MUST NOT be delivered while the interviewer's audio is playing, except for errors, and MUST be discarded if a newer state has replaced them.
2. **SPEC §4 table, Talking row:** change "Optional live caption" so the default is *no live announcement and no live caption*, with a transcript and an opt-in live-caption setting.
3. **SPEC §4.2:** add braille users and deafblind users to the accommodations, since live regions may not reach a braille display.
4. **CUE-CAP-*:** add a requirement that a navigable transcript exists, and that live caption announcements, if enabled, are per sentence and final pieces only.
5. **CUE-AMB-001 / SC 1.4.2:** extend independent volume and an off switch to the interviewer's voice, and note the screen-reader reason.
6. **CUE-CTL-001:** add a keyboard shortcut to pause the interviewer that does not clash with SR keys, and a three-way announcement setting.
7. **SPEC §4.1 echo trap:** add screen reader speech as a source that can reach the microphone, alongside ambient audio.
8. **CUE-TGT-*:** add targets for the announcement debounce and the thinking-announcement threshold (both **[unverified]**, from my proposals).
9. **SPEC §12:** open questions on `ariaNotify()` support and on which SR and browser pairs the project commits to test.

## 9. Unverified items and follow-ups

1. **Run the manual screen-reader pass** (§7) and replace every "expected" behavior here with a measured one. NVDA is installed by the user already per the audit plan; JAWS and VoiceOver are not confirmed.
2. **Confirm current `ariaNotify()` support** in Chrome, Edge, Firefox and Safari, and with which screen readers (§5.7 conflict).
3. **Confirm braille behavior** of live regions in current JAWS and NVDA (§2.4). Roselli's test was partial.
4. **Read WCAG 2.2 text** for SC 2.2.2, 1.2.4 and 2.1.4 (recalled from memory here).
5. **Find a primary source for ducking behavior** in JAWS and VoiceOver (NVDA's was confirmed via its issue tracker only).
6. **Find research on SR users in real-time voice calls.** I found video-conferencing guidance and a report of audio cutting out when focus switches between video and chat (a university guide, **[unverified]**), but no study of SR speech colliding with a conversational partner's voice. The voice-assistant and screen-reader papers I found (VERSE and others) are about replacing or combining the two, not collisions.
7. **Check an SR user's real speaking rate and verbosity settings.** Short-announcement advice (§5.5) assumes fast SR speech, which is common but I have no figure.
8. **Check live-region behavior with `inert` or modal dialogs** open (the cue panel may sit beside a settings dialog). Not covered by my sources.

## Sources

Read in full or in part (**[verified]**):

- [WCAG 2.2 Understanding SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [WCAG 2.2 Understanding SC 1.4.2 Audio Control](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html)
- [WCAG 2.2 Technique ARIA22, role=status](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22)
- [MDN, ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [MDN, Element.ariaNotify()](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaNotify)
- [Adrian Roselli, Live Region Support (2026)](http://adrianroselli.com/2026/01/live-region-support.html)
- [TetraLogical, Why are my live regions not working?](https://tetralogical.com/blog/2024/05/01/why-are-my-live-regions-not-working/)
- [Sara Soueidan, Accessible notifications with ARIA live regions, part 1](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/)
- [CSS-Tricks, The Siren Song of ariaNotify()](https://css-tricks.com/the-siren-song-of-arianotify/)
- [DEV Community, Screen reader handling of ARIA live regions](https://dev.to/mspk97/screen-reader-handling-of-aria-live-regions-timing-interruptions-and-debugging-404p) (anecdotal)
- [NVDA issue 10441, audio ducking and output device](https://github.com/nvaccess/nvda/issues/10441)

Search excerpts only (**[unverified]**):

- [Chrome 141 release notes](https://developer.chrome.com/release-notes/141) and [Intent to Ship: ARIA Notify API](https://groups.google.com/a/chromium.org/g/blink-dev/c/QCtWzIPgcCY)
- [Vispero, Screen reader support for ARIA live regions](https://vispero.com/resources/screen-reader-support-aria-live-regions/) (a 2014 article, read as out of date)
- [NV Access, In-Process 26 May 2020](https://www.nvaccess.org/post/in-process-26th-may-2020/) (NVDA ducking modes)
- [AppleVis, audio ducking on iOS](https://www.applevis.com/podcasts/how-use-audio-ducking-ios-clearer-voiceover) and [Apple Support, VoiceOver sound settings on Mac](https://support.apple.com/guide/voiceover/sound-category-cpvouaudio/mac)
- [JAWS audio ducking (SAS knowledge base)](https://sastltd.zohodesk.eu/portal/en/kb/articles/disable-jaws-audio-ducking-feature)
- [WebAIM Screen Reader User Survey 10](https://webaim.org/projects/screenreadersurvey10/) and [2024 findings summary](https://medium.com/design-domination/key-findings-from-the-webaim-2024-screen-reader-user-survey-bb15864d3bc8)
- [Auto-advancing caption is aria-live and announces forever (GitHub issue)](https://github.com/Nehanth/pooled/issues/201)
- [University of Melbourne, video conferencing for screen reader users](https://www.unimelb.edu.au/accessibility/video-conferencing-for-screen-reader-users)
- [Articulate community, screen reader and automatic audio collisions](https://community.articulate.com/discussions/discuss/accessibility-screen-reader-and-automatic-playing-audio-collisions/210652)
