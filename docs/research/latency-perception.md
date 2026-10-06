*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Latency perception: what humans notice, and what to emulate

Research date and source access date: 2026-10-05. Input to the Conditions Simulator (SPEC §5), the cue modes (SPEC §6), the default pipeline latencies (SPEC §8.4), and the open question on G.114 (SPEC §12 item 5).

Conventions: **[unverified]** marks a figure I could only get from a search-result excerpt or secondary summary, one I recalled from memory, or my own inference. **[verified]** means I read the primary page. Several primary PDFs (PNAS, ACM, the SIGdial paper) returned 403 or unreadable binary, so most conversation-science numbers below are **[unverified]** until someone reads the papers. Where sources disagree, the conflict is stated, not resolved.

## Summary

- **The 180-300 ms figure is real, but it is the human turn gap, not an uncanny-valley threshold.** People start the next turn about 200 ms after the last one ends, across languages (Stivers et al. 2009). A gap near that value reads as "natural." Gaps of about 300-500 ms start to feel slow in secondary sources, and about 700 ms and up read as hesitation, reluctance or a bad connection. The uncanny valley proper (Mori) is about appearance, and voice research on it is about prosody and voice/face mismatch, not delay. Treat "latency makes an agent feel off" as a timing-expectation effect, not as a proven uncanny-valley threshold.
- **Real remote calls are far above the face-to-face gap.** Over Zoom, one study measured a mean turn transition of about 487 ms against about 135 ms in person, for the same pairs of people. A controlled test measured about 976 ms against about 297 ms. This is the strongest anchor for the "Decent call" and "Laggy" presets.
- **Network planning guidance (ITU-T G.114) agrees:** up to 150 ms one-way is fine for most uses, 150-400 ms is acceptable with care, above 400 ms is unacceptable for planning. It also says highly interactive uses suffer at lower values. This **resolves** SPEC §12 item 5 except for the "recalled from memory" wording, which should now cite the ITU text.
- **Web UI thresholds are well established:** about 100 ms feels instant, about 1 s keeps flow of thought, about 10 s is the attention limit. INP is "good" at 200 ms or less. Frames should take 16 ms or less (10 ms of your own work).
- **Human-like delay helps chat, up to a point.** Chatbot studies find that a delay scaled to message complexity, shown with a typing indicator, raises perceived humanness and satisfaction. Instant replies are not always better.
- **For audio/video sync, the detection window is lopsided:** viewers notice audio leading video by about 45 ms and audio lagging by about 125 ms (ITU-R BT.1359). That matters for how closely a visual cue must track the audio it describes.
- **Packet loss research is mostly codec-side.** Opus conceals loss using 20 ms frames, and concealment degrades as bursts get longer (one source: good under about 120 ms of burst). I found no source I trust for realistic loss rates, so SPEC §5.2's rates stay **assumed**.

## 1. Conversation timing (the human baseline)

### 1.1 Turn gaps

| Finding | Value | Source | Status |
|---|---|---|---|
| Mean turn-transition offset across 10 languages | about 208 ms; every language mean within 250 ms of it | Stivers et al. 2009, PNAS | **[unverified]** (excerpt only, PNAS returned 403) |
| Fastest and slowest language means | Japanese about 7 ms, Danish about 469 ms | Stivers et al. 2009 | **[unverified]** |
| Language medians | 0 ms (English, Japanese, Tzeltal, Yélî-Dnye) to 300 ms (Danish, Ākhoe Haiom, Lao) | Stivers et al. 2009 | **[unverified]** |
| Modal gap in conversation | about 200 ms; median gaps between 0 and 300 ms across studies | Review in the Journal of Cognition, "Timing in Conversation" | **[verified]** (page read) |
| Time to prepare a one-word response | 600-800 ms; a simple sentence can take 1 s or more | same review; Levinson 2016 | **[verified]** (review), **[unverified]** (Levinson, excerpt) |
| Response is planned before the other turn ends | early-cue condition about 300 ms faster than late-cue | same review | **[verified]** |
| Typical turn length | mean about 2 s (about 7 words), median about 1 s (about 3 words) | same review | **[verified]** |
| Gaps shorter than 200 ms | not precise: turn-taking is "generally less precise than often claimed," with many overlaps and long gaps too | Heldner and Edlund 2010 | **[unverified]** (abstract excerpt) |

What this means for the build:

- **The target gap for a believable interviewer is not zero.** About 200 ms is the human mode, and the distribution is wide. A pipeline that answers in 0-50 ms every time is faster than people are, and may feel odd for a different reason (see §4).
- **Humans hit 200 ms by predicting the end of the turn and planning early.** A pipeline that starts its work only after silence is detected cannot match that. This supports the SPEC §8.4 advice to optimize time to first sentence, and the semantic end-of-turn model (Smart Turn) in SPEC §9.
- **Longer gaps carry meaning.** A review in the Journal of Cognition says a long gap "may express reluctance to accept a request." Kendrick and Torreira (2015) report that dispreferred answers come later, with about 700-800 ms as the point where late answers are almost always dispreferred **[unverified]** (search excerpt of the abstract, plus the whiterose eprint listing). So an interviewer that pauses 800 ms before a plain question reads as unsure or negative. This is a useful cue for training, and an accidental one for a laggy pipeline.

### 1.2 Perceived-delay bands (practitioner sources, not peer-reviewed)

Voice-AI vendor blogs repeat these bands. They are consistent with §1.1 but I did not find the underlying experiments, so they are **[unverified]** and should not be cited as research:

| Gap after the user stops | Reported perception |
|---|---|
| about 200-300 ms | natural |
| beyond about 300-400 ms | starts to feel awkward |
| beyond about 500 ms | the user wonders if they were heard |
| beyond about 700 ms | feels "robot" or hesitant |
| beyond about 1 s | the user assumes a fault, or feels ignored |
| beyond about 1.2 s | high abandonment reported for phone agents |

A claim that "a 2025 Stanford study" found 73% higher satisfaction under 700 ms came from one vendor blog with no citation. **Do not use it.**

## 2. Video-call and telephony latency

### 2.1 Standards

**ITU-T G.114 (2003), one-way transmission time [verified via search excerpts of the ITU text; not read in full]:**

| One-way delay | Guidance |
|---|---|
| 0-150 ms | acceptable for most applications; some highly interactive uses degrade even below this |
| 150-400 ms | acceptable if planners are aware of the quality impact |
| above 400 ms | unacceptable for general planning, with rare exceptions |

The effect of delay below 500 ms on conversation is modelled with a curve from the E-model (G.107). Highly interactive tasks, explicitly including video conferencing, can be hurt by lower delay than the 400 ms planning limit.

Note that these are **one-way** figures. A conversation's felt gap is closer to the round trip plus human reaction time, which is why SPEC §5.2 says "~90-150 ms one-way" for a measured "180-300 ms round-trip gap."

### 2.2 What real calls do to conversation

| Finding | Value | Source | Status |
|---|---|---|---|
| Mean turn transition, in person vs Zoom, same pairs | about 135 ms vs about 487 ms | Boland et al. 2022, J. Exp. Psychology: General | **[unverified]** (search excerpt) |
| Controlled experiment, local vs remote responses | about 297 ms vs about 976 ms | same | **[unverified]** |
| Authors' explanation | small, variable delays disrupt neural oscillators that sync on syllable rate (about 150-300 ms per cycle) | same | **[unverified]**, a hypothesis in the paper |
| Effects of poor video-call quality | more irregular silences, less fluent flow, lagged turn-taking | Schoenenberg et al. line of work | **[unverified]** (excerpt) |
| Delay-induced misattribution | listeners rate their partner as less friendly and attentive | same | **[unverified]** |
| Conversation type matters | high-interactivity talk suffers from delay sooner than slow, low-interactivity talk | same | **[unverified]** |
| Platform measurements | video latency about 90-150 ms (Zoom, Europe), 75-90 ms (Webex), 30-40 ms (Meet, Europe servers); Teams adds buffering at about 10% loss | Chang et al., "Can You See Me Now?" and related measurement studies | **[unverified]** (excerpt, PDF unreadable) |

Takeaways:

- **Interview-over-video is not a 200 ms world.** A trainee's real experience is closer to a 0.4-1 s gap and a lot of jitter, which also explains the SPEC's observed "1-2 s with jittery inflection" case.
- **Jitter matters as much as the mean.** The research framing is "small, variable transmission delays," and the SPEC's jitter parameter should be treated as a first-class setting, not a polish item.
- **Misattribution is the training hook.** Delay makes the other person look less attentive. Interview coaching can teach candidates not to read delay as disinterest, which is a good fit for SPEC §5.3.

## 3. Web UI responsiveness

All **[verified]** (primary pages read) unless noted.

| Threshold | Meaning | Source |
|---|---|---|
| 0.1 s | the system feels instantaneous; direct manipulation | Nielsen (after Miller 1968, Card et al. 1991) |
| 1 s | flow of thought uninterrupted, but the delay is noticed | Nielsen |
| 10 s | limit of attention; show progress, and a percent-done bar beyond this | Nielsen |
| 16 ms per frame | smooth animation at 60 fps; own work should fit in about 10 ms | RAIL model (web.dev) |
| 100 ms | complete a visual response to input; handle input events within 50 ms | RAIL |
| 50 ms chunks | idle work should yield often enough not to block input | RAIL |
| 200 ms or less | INP "good", at the 75th percentile | web.dev INP |
| 200-500 ms | INP "needs improvement" | web.dev INP |
| above 500 ms | INP "poor" | web.dev INP |

Recalled from memory, **[unverified]**: the Doherty threshold (about 400 ms for a computer and a person to stay in a productive loop); and research on touch and pen input finding that perceptible latency for direct dragging is down at about 1-10 ms. The second is irrelevant for a mouse and keyboard chat, but is the reason a typing-echo delay beyond a frame or two feels wrong.

Takeaways for the prototype UI:

- **The UI itself must be fast regardless of simulation.** Button presses, keystrokes, mute toggles and caption scrolling should stay inside the 100 ms response budget. Simulated lag applies to *the interviewer's side of the call*, never to the local controls (this matches SPEC §5 "added to real latency, never substituted").
- **Animations must hold 16 ms frames,** or jank will read as network lag and confuse the simulator's message.
- **A wait of 1-10 s needs feedback.** The "thinking" cue is exactly this. Above 10 s something stronger than a cue is needed, and no live interview turn should take that long.

## 4. Uncanny valley, voice, and timing

The honest status: **there is no established "uncanny delay" threshold.** What exists:

- **Mori's uncanny valley** is about visual human likeness. It is a hypothesis with mixed empirical support.
- **Voice and face mismatch:** one study (Mitchel et al. 2011) found that a mismatch in the realism of a face and a voice produced the uncanny effect: a human voice made a robot eerier, and a synthetic voice made a human eerier **[unverified]** (search excerpt).
- **Speech synthesis:** a TSD 2014 paper (Romportl) argues near-human prosody with subtle irregularities can cause discomfort **[unverified]** (PDF unreadable, summarized from an excerpt).
- **Timing as a tell:** reports that callers recognize automated calls by LLM-induced pauses between turns, and that dialogue systems show badly timed barge-ins and over-long pauses **[unverified]** (arXiv 1912.00369 and 1907.11585 excerpts).

My inference **[unverified, hypothesis]**: the "uncanny" part for an AI interviewer is likely a **mismatch between channels**: a natural-sounding voice paired with unnatural timing (a fixed 1.5 s gap every turn, no overlap, no backchannels, no hesitation), or a fast voice with slow cues. Variation matters: human gaps are a wide distribution, so a constant delay is itself a tell. The simulator should therefore draw delays from a distribution, not use a fixed number, and user testing (SPEC §11) should check whether jittered delay feels more natural than constant delay.

## 5. Chat and text timing

| Finding | Source | Status |
|---|---|---|
| A response delay scaled to the complexity of the reply and the prior message raised perceived humanness, social presence and satisfaction, compared with near-instant replies | Gnewuch et al., "Faster Is Not Always Better" (ECIS 2018) | **[verified]** (abstract read) |
| Typing indicators (three dots, "X is typing") reframe a delay as effort and add to perceived presence | Gnewuch et al.; related typing-indicator papers | **[unverified]** (excerpt) |
| In one shopping-chatbot study, moderate latency (5-10 s) made users more willing to follow suggestions than short (0-1 s) or long (13-18 s) latency | a paper in the same results list, not identified | **[unverified]** |
| A 2022 ACM paper on user perceptions of response delays exists (DOI 10.1145/3555765) | ACM | not read (403) |

Takeaways:

- **Text mode should not stream instantly by default.** For a text interview, a short typing-indicator phase followed by streaming matches the evidence on social presence. It also matches SPEC §4 (thinking cue doubling as latency masking).
- **The "right" delay scales with the content.** A one-line follow-up should come faster than a long behavioral question. Delay should be a function of the reply length.
- **Text delays run on a different clock than voice.** The 5-10 s band is for text chat. Do not apply it to voice, where the same gap is a fault.

## 6. Audio and video sync, and cue timing

**ITU-R BT.1359 [verified via search excerpts; not read in full]:** viewers detect audio-video offset at about **+45 ms** (audio leads) to **-125 ms** (audio lags). Acceptability limits are about +90 ms and -185 ms. The window is lopsided because light travels faster than sound, so people tolerate sound arriving late better than early.

Applying it to the interviewer's cues **[unverified extrapolation, since the data is for lip-sync on faces]**:

- The SPEC §6.3 rule "cues never lead the audio they describe" is **stricter than perception requires.** By this window a visual cue could lead its audio by up to about 125 ms unnoticed, and should not trail it by more than about 45 ms. The rule is still sound for the `perceived` mode, because its point is causality (a cue should not arrive before the thing it reports), not perception.
- For `true_state` mode, where cues are generated locally and may precede delayed audio, the lead is *meant* to be larger than 125 ms. Expect users to notice it, and treat that as the feature rather than a bug.
- If an avatar or animated mouth is ever added, hold lip sync inside the window above.

## 7. Packet loss, jitter, concealment

- Opus includes packet loss concealment in all modes, supports forward error correction in speech modes, and commonly uses 20 ms frames **[unverified]** (excerpts; matches SPEC §5.1 "about 20 ms frames").
- Burst loss degrades perceived quality more than scattered loss, and concealment models work well only up to bursts of about 120 ms, getting worse beyond that **[unverified]** (one research excerpt). This supports the SPEC's burst model, and suggests the simulator's `burst_length` default should be a small number of frames (about 1-6) with a long tail.
- When a critical speech frame (a consonant, a word-final inflection) is lost, concealment fails to mask it **[unverified]**. That is the mechanism behind the SPEC's "dropped right at the inflection" observation, and it argues for letting the loss model bias toward frames with high energy change, as an option.
- **No trustworthy figure for real-world loss rates** (SPEC §12 item 7 stays open). Teams reportedly buffers at about 10% loss, and Zoom keeps audio quality up with only slightly more delay **[unverified]** (excerpt). That shows 10% is a stress level for real products, which fits "Bad connection" at 3-10%.

## 8. Proposed emulation parameters

These are **proposals for tuning by ear and user test**, built from the anchors above. They are not requirements and should not be put in the spec as facts. All values are milliseconds unless stated.

### 8.1 Turn gap (interviewer reply gap after the user stops)

| Preset | Gap (median, with range) | Rationale |
|---|---|---|
| Clean | the measured pipeline floor, no padding. Target at or below 400 ms if the hardware allows | Human mode is about 200 ms, but a local pipeline cannot predict turn ends as humans do (§1.1) |
| Decent call | about +150 added, light jitter (about 30-60 SD) | Matches Zoom-class results of 400-500 ms mean transitions (§2.2) |
| Laggy / clipped | 1,000-2,000 as in SPEC, with jitter up to about 300 SD | Matches the 976 ms controlled result, plus the SPEC's observed case |
| Bad connection | little added delay, but loss dominates | as SPEC |
| Draw from a distribution | log-normal or similar, not constant | Human gaps are wide and skewed (§1.1, §4) |

### 8.2 Cue and UI timing

| Item | Proposed value | Anchor |
|---|---|---|
| Local controls (button, mic mute, text echo) | at or under 100 ms, never simulated | RAIL, Nielsen (§3) |
| State transition animations | 16 ms frames, 150-300 ms durations | RAIL; my choice for duration |
| "Thinking" cue after the user's turn ends | show if the gap would exceed about 300-500 ms | §1.2 bands **[unverified]** |
| Escalate the thinking cue (add the thought bubble or notes sound) | at about 1 s | Nielsen 1 s |
| Talking-cue hysteresis | keep SPEC's under about 300 ms | matches the syllable-rate period of 150-300 ms (§2.2) |
| Cue vs audio offset, visual after audio | at or under 45 ms | BT.1359 **[unverified extrapolation]** |
| Cue vs audio offset, visual before audio | at or under 125 ms | BT.1359 **[unverified extrapolation]** |

### 8.3 Text mode

| Item | Proposed value | Anchor |
|---|---|---|
| Typing indicator before reply | on for a time scaled to reply length (for example 0.5-3 s) | Gnewuch (§5) |
| Reply stream start | after the indicator, then stream | §5 |
| Do not reuse text timings for voice | | §5 |

### 8.4 Loss and clipping

| Item | Proposed value | Anchor |
|---|---|---|
| Frame size | 20 ms | Opus (§7) |
| Burst length | mostly 1-6 frames, with a long tail | §7 **[unverified]** |
| Loss rate, Decent call | 0-1% | my assumption |
| Loss rate, Bad connection | 3-10% | SPEC (assumed) |
| Tail clip | 150-400 ms as in SPEC | observed case; no research anchor |

## 9. Findings for the spec

For the spec owner. I have not edited `SPEC.MD` or `specs/`.

1. **SPEC §12 item 5:** G.114 can be marked checked against the ITU text (150 / 400 ms bands, one-way).
2. **SPEC §5.2 "Decent call":** the "measured 180-300 ms" figure is the human turn gap, not a network measurement. Consider restating the anchor as "Zoom-class transitions of about 400-500 ms (Boland 2022)" once that paper is read.
3. **SPEC §5.1:** add a note that delay should be sampled from a distribution (jitter shape), not a constant. This is a stronger claim than "light jitter."
4. **SPEC §6.3:** the "cues never lead the audio" rule is a causality rule, not a perception rule. Say so, so that `true_state` mode is not mistaken for violating it.
5. **SPEC §4 and §8.4:** text mode needs its own timing profile (typing indicator, reply-length-scaled delay). Voice and text should not share delay settings.
6. **SPEC §2:** the problem table's "180-300 ms gap" row is the *normal* human gap. Check that the wording does not imply it is a defect.

## 10. Unverified items and follow-ups

1. **Read the primary papers** behind every **[unverified]** conversation-science figure: Stivers 2009, Boland 2022, Kendrick and Torreira 2015, Heldner and Edlund 2010, Levinson 2016, and the ACM 2022 response-delay paper. PNAS, ACM and the PDFs returned 403 or binary.
2. **Find a primary source for delay bands** (§1.2). The vendor-blog numbers are consistent with the research but are not citable.
3. **Find real packet-loss and jitter distributions** for consumer broadband and Wi-Fi (SPEC §12 item 7).
4. **Find evidence on constant vs variable delay**, and on whether variation reduces "robotic" ratings (§4). This is a direct user-test candidate for SPEC §11.
5. **Check whether the lip-sync window transfers to non-face cues** (§6). Likely needs our own user test.
6. **Check sensitivity of the 300-500 ms "awkward" band for AI agents specifically.** The human gap research is human-to-human, and people may set different expectations for an AI.

## Sources

Read in full or in part (**[verified]**):

- [Nielsen Norman Group, Response Time Limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [web.dev, Interaction to Next Paint](https://web.dev/articles/inp)
- [web.dev, RAIL model](https://web.dev/articles/rail)
- [Journal of Cognition, Timing in Conversation](https://journalofcognition.org/articles/10.5334/joc.268)
- [Gnewuch et al., Faster Is Not Always Better (ECIS 2018)](https://aisel.aisnet.org/ecis2018_rp/113/)

Search excerpts only (**[unverified]**):

- [Stivers et al. 2009, Universals and cultural variation in turn-taking (PNAS)](https://www.pnas.org/doi/pdf/10.1073/pnas.0903616106) and [PMC copy](https://pmc.ncbi.nlm.nih.gov/articles/PMC2705608/)
- [ITU-T G.114 (05/2003), One-way transmission time](https://www.itu.int/rec/dologin_pub.asp?lang=e&id=T-REC-G.114-200305-I%21%21PDF-E)
- [Boland et al., Zoom disrupts the rhythm of conversation](https://www.semanticscholar.org/paper/Zoom-disrupts-the-rhythm-of-conversation.-Boland-Fonseca/8c7bcea51be44189e251a7c5dc4fb920f09300a4) and [Michigan news summary](https://record.umich.edu/articles/zoom-disrupts-the-rhythm-of-conversation-study-shows/)
- [Kendrick and Torreira 2015, The Timing and Construction of Preference](https://eprints.whiterose.ac.uk/id/eprint/116177/1/Kendrick_and_Torreira_2015_.pdf)
- [Levinson 2016, Turn-taking in human communication](https://pure.mpg.de/view/item_2193297_10)
- [Heldner and Edlund 2010, Pauses, gaps and overlaps in conversations](https://www.diva-portal.org/smash/get/diva2:388247/FULLTEXT01.pdf)
- [Schoenenberg, Raake and Lebreton, video-telephony delay](https://www.semanticscholar.org/paper/Conversational-quality-and-visual-interaction-of-Schoenenberg-Raake/704c1a815d440586c6deeb00773a4f9049c1104c)
- [Michael and Müller, Simulating Turn-Taking in Conversations with Delayed Transmission (SIGdial 2020)](https://aclanthology.org/2020.sigdial-1.20.pdf) (read as unreadable PDF; title and topic only)
- [Chang et al., Can You See Me Now? Zoom, Webex and Meet](https://www2.cs.uh.edu/~gnawali/courses/cosc6377-f23/papers/Chang21.pdf) (unreadable PDF; excerpt from a search summary)
- [Romportl, Speech Synthesis and Uncanny Valley (TSD 2014)](https://www.tsdconference.org/tsd2014/download/preprints/673.pdf) (unreadable PDF)
- [Mitchel et al., A Mismatch in the Human Realism of Face and Voice Produces an Uncanny Valley](https://www.researchgate.net/publication/215728219_A_Mismatch_in_the_Human_Realism_of_Face_and_Voice_Produces_an_Uncanny_Valley)
- [ITU-R BT.1359 summary, Managing lip sync (TV Technology)](https://www.tvtechnology.com/opinions/managing-lip-sync-267386)
- [Opus (Hydrogenaudio) and PLC papers](https://wiki.hydrogenaudio.org/index.php?title=Opus)
- Voice-AI vendor blogs on latency bands ([AssemblyAI](https://www.assemblyai.com/blog/low-latency-voice-ai), [Hamming](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it)); not research, cited only for the bands in §1.2
