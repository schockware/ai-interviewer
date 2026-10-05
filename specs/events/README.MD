*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Event stream (EVT)

Status: **first draft.** Requirements are written; none is tested yet, and no conformance vectors exist.

## Purpose

Define the one stream of timestamped events that every other layer reads or writes, so the layers can be built, tested and replaced in isolation and in different languages.

## Terms

| Term | Meaning |
|---|---|
| **Session** | One interview, from start to end. Every event belongs to exactly one session |
| **Stream** | The ordered record of all events in a session |
| **Event** | One thing that happened, with a type, a position, a true timestamp and a payload |
| **Authority** | The single party that places events in the stream and assigns their positions and true timestamps. The session layer holds this role |
| **Producer** | A layer that reports something that happened, through the authority |
| **Consumer** | Anything that reads the stream: the simulator, the cue renderer, the debug view, an exporter, a test |
| **True timestamp** | When the event actually happened on the interviewer's side of the call |
| **Perceived timestamp** | When the event reaches the user after simulated conditions, or a marker that it never arrives |
| **Position** | An event's place in the stream. Ascending, with no two events sharing one |

## Boundary

**Takes in**

- Reports from every layer of things that happened, in each layer's terms
- Requests from consumers for events: live, from a point, or the whole record

**Puts out**

- Ordered, timestamped events, live and as a complete record
- A way to learn the current state of a session without reading its whole history

**Not this layer's job:** deciding what an event means to a consumer. A cue renderer, a debug view and a test each read the same events differently.

## Requirements

### Core

- **EVT-CORE-001** A session MUST have exactly one stream, and every event MUST belong to it.
- **EVT-CORE-002** Every event MUST carry an event type, a session identifier, a position and a true timestamp.
- **EVT-CORE-003** Positions MUST ascend with no duplicates, and consumers MUST be able to tell whether a position is missing.
- **EVT-CORE-004** Only the authority MAY assign positions and true timestamps. A producer MUST NOT assign its own.
- **EVT-CORE-005** The stream MUST identify its format version, so a consumer can tell whether it understands the stream.

### Time

- **EVT-TIME-001** True timestamps MUST be measured on one session clock, from the start of the session, and MUST NOT depend on the wall-clock time of any machine.
- **EVT-TIME-002** True timestamps MUST be non-decreasing in position order.
- **EVT-TIME-003** The clock's resolution MUST be 1 ms or finer.
- **EVT-TIME-004** An event produced on a machine other than the authority's MUST be placed on the session clock, and the uncertainty of that placement MUST be recorded or bounded.

### Extension

- **EVT-EXT-001** A consumer MUST ignore an event type it does not recognize, and MUST NOT fail because of it.
- **EVT-EXT-002** New event types and new fields on existing types MAY be added without changing the format version.
- **EVT-EXT-003** The meaning of an existing field MUST NOT change without changing the format version.
- **EVT-EXT-004** A consumer MUST ignore a field it does not recognize on a type it does recognize.

### Perceived time and simulation

- **EVT-SIM-001** After simulation, each event MUST carry either a perceived timestamp or a dropped marker, never both.
- **EVT-SIM-002** A perceived timestamp MUST NOT be earlier than the event's true timestamp.
- **EVT-SIM-003** When no simulation is active, a consumer MUST be able to treat the perceived time of every event as equal to its true time, whether or not it is stated.
- **EVT-SIM-004** Perceived timestamps MAY be out of position order, because delay varies. A consumer that needs perceived order MUST sort by perceived timestamp.
- **EVT-SIM-005** True timestamps and positions MUST NOT change when simulation is applied, so the true timeline stays available.

### Delivery

- **EVT-DELIV-001** A consumer MUST receive events in position order, without duplicates, or be told that a gap exists and where.
- **EVT-DELIV-002** A consumer that joins or reconnects mid-session MUST be able to obtain the events it missed, or the current state of the session.
- **EVT-DELIV-003** A consumer MUST be able to compute the delay between an event's true timestamp and the moment it received the event.
- **EVT-DELIV-004** A slow or absent consumer MUST NOT stop the session or delay other consumers.

### Event types (core catalog)

The catalog is additive (EVT-EXT-002). Each type states only the information it must carry.

- **EVT-TYPE-001 State.** The conversation state changed to one of: listening, thinking, talking, paused.
- **EVT-TYPE-002 Audio frame.** A frame of audio was produced or received: which audio stream it belongs to (the interviewer's voice, ambient sound, effects, the user's voice), its order within that stream, and its duration. A consumer MUST be able to obtain exactly the audio that the frame describes.
- **EVT-TYPE-003 Speech activity.** The user started or stopped speaking.
- **EVT-TYPE-004 Turn decision.** The end of a user turn was decided, with a confidence.
- **EVT-TYPE-005 Transcript.** A piece of the user's speech as text, marked partial or final. A final piece MUST identify which earlier partial pieces it replaces.
- **EVT-TYPE-006 Interviewer text.** A piece of the interviewer's reply as text. It MUST be linkable to the audio frames that carry it, so captions can match what the user actually heard.
- **EVT-TYPE-007 Control.** The user asked for something: pause, resume, repeat, skip, hint, "give me a sec", push-to-talk start or stop, or a switch between voice and text.
- **EVT-TYPE-008 Condition.** Simulated conditions in effect changed: the preset, its parameters and its seed.
- **EVT-TYPE-009 Session lifecycle.** The session started or ended, with the configuration that matters to later reading (cue mode, preset, interface).
- **EVT-TYPE-010 Fault.** A layer failed or degraded, with which layer and what the user will experience.

### Record and replay

- **EVT-REC-001** The stream MUST be recordable losslessly, including everything needed to obtain the audio that frames describe.
- **EVT-REC-002** Replaying a recorded stream through the simulator with the same conditions and seed MUST produce identical perceived timestamps and dropped markers.

### Export

- **EVT-EXP-001** A recorded stream MUST be exportable as a self-contained record, for bug reports and tests.
- **EVT-EXP-002** An export SHOULD let the user leave out audio and transcript content, because both are personal data.

## Conformance vectors (planned)

To live in `specs/events/conformance/` once the format is chosen. Each is an input stream and an expected observation:

1. Positions with a gap, and a consumer that must report the gap (EVT-CORE-003, EVT-DELIV-001).
2. A stream containing an unknown type and an unknown field, which a consumer must pass over (EVT-EXT-001, EVT-EXT-004).
3. A perceived timestamp earlier than its true one, which is invalid (EVT-SIM-002).
4. A stream with simulation off and no perceived timestamps, read as perceived equals true (EVT-SIM-003).
5. A recorded stream replayed twice with one seed, identical both times (EVT-REC-002).
6. A final transcript piece replacing its partials (EVT-TYPE-005).
7. Interviewer text linked to frames, with some frames dropped (EVT-TYPE-006, EVT-SIM-001).

## Assumptions about neighbouring layers

- Every producing layer can report what it did with a timestamp the authority can place on the session clock (or an uncertainty bound, EVT-TIME-004).
- The speech layer reports which audio frames carry which text (needed by EVT-TYPE-006).
- The simulator is the only party that adds perceived timestamps and dropped markers.
- Consumers never write events. Anything a consumer wants recorded goes through a producer and the authority.

## Open questions

1. **Time resolution and targets.** How quickly must an event reach a local consumer? The requirement is that it is measurable (EVT-DELIV-003). A target value is for benchmarking to propose.
2. **Late join.** Is the missed-event replay enough, or is a state snapshot also required? Both are allowed by EVT-DELIV-002.
3. **Audio content.** Whether audio travels with its frame event or beside it is a design choice. The spec only requires that it can be obtained exactly (EVT-TYPE-002).
4. **Where this ends and a contract begins.** Whether the schema lives here or in a separate contract file shared by the three languages.
5. **Retention.** How long a session's stream is kept, and what happens to personal data in it.
6. **Frame granularity.** EVT-TYPE-002 asks for one event per audio frame, which is about 50 a second per stream. Should an event be allowed to cover a run of frames? Raised by the web design (`src/design/events`).

## Source

`SPEC.md` §5, §6, §7.
