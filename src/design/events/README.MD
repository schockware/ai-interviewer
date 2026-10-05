*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Design: event stream for the web client

Answers [`specs/events`](../../../specs/events/README.MD) for the first client: a browser talking to C# over WebSocket ([decision 0003](../../../docs/decisions/0003-transport-ui-and-service-architecture.md)).

Status: **draft proposal, nothing decided.** The point of this first pass is to see what the event spec forces on the web design. Figures marked **[unverified]** come from memory and need checking. The audio I/O spec is deliberately left as a stub, because the desktop client will make its own decisions there.

## What falls out

1. **There are two clocks, and the spec already says so.** The browser captures audio on its own clock. The session clock lives on the server. *EVT-TIME-001, EVT-TIME-004.* The server must estimate the offset between them with timed round trips, and record the uncertainty on each uplink event. The real browser-to-server delay then adds to the simulated uplink delay and must be reported separately in the debug view.
2. **Simulate by timestamp, not by holding the network.** Send each event and audio frame early with both its true and its perceived timestamp, and let the client play it at the chosen time. *EVT-SIM-001, EVT-SIM-005, EVT-REC-002.* This makes switching between `perceived` and `true_state` instant (SPEC §6.5), makes the debug view's two lanes possible, and makes a seeded run reproducible regardless of the real network. The cost is that the client keeps a small scheduling buffer of audio.
3. **The user's side is different.** Simulated uplink delay has to shift what the listening and transcription layers see, so on that path the server really holds the user's audio until its perceived time (SPEC §5.1). Everything else is scheduled by the client.
4. **Dropped frames are never sent.** A dropped marker is enough, and it saves bandwidth. *EVT-SIM-001.* The client renders silence or concealment for the gap.
5. **As-heard captions need text linked to audio.** *EVT-TYPE-006.* The speech layer must report which frames carry which text. TTS engines rarely give word timings **[unverified]**, but they synthesize one sentence at a time, so sentence-level links (a text piece mapped to a range of frames) are probably enough. This becomes an assumption in the speech layer's spec.
6. **Reconnecting is a requirement, not a nicety.** A page refresh or a dropped socket is routine in a browser. *EVT-DELIV-002.* The server keeps each session's event log. The client reconnects with the last position it saw and receives what it missed. Already-played audio is not resent, so a snapshot of current state is enough for audio.
7. **One event per audio frame is a lot.** At 20 ms frames, one stream is 50 events a second, and both directions together make about 100. That is fine on a local connection but bloats exports and the recorded stream. *EVT-TYPE-002, EVT-REC-001.* Either the spec allows an event to cover a run of frames, or the design stores frames compactly. This is raised as an open question in the event spec.

## Proposed transport mapping

- **One WebSocket per session.** Events and audio share it, so their order is preserved. Two sockets would need a way to line them up again.
- **Text messages carry events**, serialized as JSON. Unknown types and fields are skipped (*EVT-EXT-001, EVT-EXT-004*). The format version travels in the first message (*EVT-CORE-005*).
- **Binary messages carry audio frames.** A small header names the audio stream, the frame's order within it, and its timestamps, followed by the samples. The event for a downlink frame is sent as text, and the binary message follows with the same stream and order.
- **Browser capture:** an audio worklet captures the microphone, converts it to 16 kHz mono 16-bit samples **[unverified: the rate the chosen listening and transcription models expect]**, and cuts it into 20 ms frames of 640 bytes, so about 32 KB/s upstream.
- **Playback:** the interviewer's audio arrives at the speech model's own rate, for example 24 kHz mono **[unverified]**, 960 bytes per 20 ms frame, about 48 KB/s. The client schedules frames on the audio clock, not on a timer.
- **Controls** (pause, repeat, push-to-talk and the rest) go up as text messages and come back as control events (*EVT-TYPE-007*), placed by the server.

## Slow consumers and faults

- Each consumer has its own queue, so one slow reader never stalls the session (*EVT-DELIV-004*). Events are small and kept. If a queue grows past a limit, the consumer is told it has fallen behind and resynchronizes from a snapshot.
- The browser path reports microphone problems (permission denied, device lost) as fault events (*EVT-TYPE-010*), so the setup pains are visible to the session and to the report.

## What this asks of other layers

| Layer | Asked |
|---|---|
| Speech | Report which frames carry which text, at least per sentence |
| Simulator | Work on timestamps and markers, and apply uplink delay by really holding the user's audio |
| Session (authority) | Place client events on the session clock with a stated uncertainty, keep the log for reconnects |
| Cues | Read events on either timeline, chosen at any moment |
| Audio I/O | Not changed. The desktop client keeps its own decisions. For the web, the browser path above is the working design |

## Open items

1. Frame size. 20 ms matches the loss model in SPEC §5.1, but a larger frame would cut message overhead. Measure.
2. Audio compression. Raw samples are fine locally. A compressed codec would matter only if the server is ever remote.
3. How accurately the browser-to-server clock offset can be estimated, and whether that is good enough for the uplink delay claims in the debug view.
4. Retention of recorded streams and the personal data in them (*EVT-EXP-002*).
5. A language-neutral schema file for events and the binary header, shared by C#, Python and TypeScript.
