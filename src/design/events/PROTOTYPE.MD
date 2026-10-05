*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# Prototype brief: event stream (EVT)

Read [`../PROTOTYPES.MD`](../PROTOTYPES.MD) first. This is the first prototype, because every other layer depends on the stream.

## Goal

Prove that three languages can agree on one event stream, and learn what it costs. This prototype has **no models and no audio hardware.** It is about the schema, the authority, recording and replay, and delivery.

## Spec to answer

[`specs/events/README.MD`](../../../specs/events/README.MD). Every requirement is in scope. The ones that need real work:

| Priority | Requirements | Why |
|---|---|---|
| High | EVT-CORE, EVT-TIME, EVT-EXT | The schema and the clock decide everything else |
| High | EVT-SIM-001 to -005 | The simulator and the cues depend on them |
| High | EVT-REC-001, EVT-REC-002 | Replay must be exact |
| Medium | EVT-DELIV-001 to -004 | Reconnect, gaps and slow readers |
| Medium | EVT-TYPE-001 to -010 | Define each type's fields, no more than needed |
| Low | EVT-EXP-001, EVT-EXP-002 | Export, with a way to leave content out |

## Scope

**In**

- A **language-neutral schema** for the core catalog, with a format version, validated by a tool in at least two languages.
- An **authority** in C# (.NET 10) that accepts reports from producers, assigns positions and true timestamps, and writes the stream.
- A **recorder and replayer** for a stream, with a test that replay gives an identical result (EVT-REC-002 is checked later with the simulator, so replay of true timestamps is enough here).
- A **consumer in Python** that reads the stream written by C#, ignores unknown types and fields, detects gaps, and reports delivery delay. Optionally a third reader in TypeScript.
- A **transport sketch**: the authority exposes the stream on a local WebSocket and the Python consumer reads it live. This is the web client's path (`src/design/events/README.MD`).
- Tests for the seven planned conformance vectors in the spec.

**Out**

- Audio samples, models, any real layer, the user interface, the simulator's behavior. Fake producers that emit scripted events are enough.

## Questions this prototype must answer

1. Can one schema file validate the stream in C# and Python without drifting? Which schema language, and what broke?
2. **Frame granularity (spec open question 6).** Record five minutes of fake 20 ms audio frame events in both directions. How large is the record with one event per frame? With one event covering a run of frames? What does each cost to read and replay?
3. **Clock placement (EVT-TIME-004).** Between a client process and the authority on one machine, how well can a clock offset be estimated with round trips, and what uncertainty can honestly be recorded?
4. **Delivery delay (EVT-DELIV-003).** What is the delay from event creation to a consumer receiving it over a local WebSocket, at 100 events a second, at p50, p95 and p99?
5. **Slow consumers (EVT-DELIV-004).** What happens to the session and to other consumers when one consumer stops reading for 30 seconds?
6. **Reconnect (EVT-DELIV-002).** Can a consumer return after a drop and receive exactly what it missed? How is the point of return identified?
7. Which fields did each event type actually need? Remove anything that was never used.

## Measurements to produce

| Spec target or question | Measure |
|---|---|
| EVT-DELIV-003 | Delivery delay at 10, 100 and 1,000 events per second, p50 / p95 / p99 |
| Question 2 | Bytes per minute of stream under each frame approach |
| Question 3 | Clock offset error and recorded uncertainty |
| Cost | CPU and memory of the authority at 100 events per second |

## Conformance vectors to run

The seven in the spec. Vector files are data (inputs and expected observations), readable by each language's test harness, and are meant to live in `specs/events/conformance/` once agreed. Put drafts in `src/prototypes/events/vectors/` and propose them in the summary.

## Candidate technology

Named here because this is a design brief (decision 0002, decision 0003):

- C# on .NET 10 for the authority.
- Python for the consumer.
- JSON for text messages is the working assumption. Try a schema language that all three languages have good support for, and say which you chose and why.

## Deliverables

- Code in `src/prototypes/events/`.
- Draft conformance vectors.
- `docs/research/prototype-events.md` as in the shared rules.

## Done when

The shared definition of done holds, a C# authority and a Python consumer pass all seven vectors against the same vector files, and the five-minute frame experiment has a recommendation.
