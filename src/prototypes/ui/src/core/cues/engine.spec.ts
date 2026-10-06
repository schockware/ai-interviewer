import { describe, expect, it } from 'vitest'
import { SimulatedClock } from '../../adapters/simulatedClock.ts'
import { builtMockStream, ScriptedEventSource, type BuiltStream } from '../../adapters/mock/index.ts'
import type { CueMode } from '../contract/index.ts'
import { CueEngine } from './engine.ts'

/** Stands in for the simulator, which does not exist yet: every state event arrives `delayMs` late. */
function withDownlinkDelay(stream: BuiltStream, delayMs: number): BuiltStream {
  return {
    header: stream.header,
    events: stream.events.map((e) => ({ ...e, t_perceived_ms: e.t_true_ms + delayMs })),
  }
}

function setup(stream: BuiltStream, mode: CueMode) {
  const clock = new SimulatedClock()
  const engine = new CueEngine(new ScriptedEventSource(stream, clock), clock, mode)
  const shown: [number, string][] = []
  const announced: [number, string][] = []
  let lastAnnouncement = 0
  let lastState = 'idle'
  engine.subscribe(() => {
    const p = engine.getState().payload
    if (p.state !== lastState) {
      lastState = p.state
      shown.push([clock.now(), p.state])
    }
    if (p.announcementId !== lastAnnouncement) {
      lastAnnouncement = p.announcementId
      announced.push([p.announcementId, p.announcement])
    }
  })
  engine.start()
  return { clock, engine, shown, announced }
}

const clean = () => builtMockStream('simulation-off')

describe('CueEngine against the mock stream', () => {
  it('with no simulation, perceived and true_state show the same cues at the same times (CUE-MOD-003, vector 1)', () => {
    const a = setup(clean(), 'perceived')
    const b = setup(clean(), 'true_state')
    a.clock.advance(15_000)
    b.clock.advance(15_000)
    expect(a.shown).toEqual(b.shown)
    expect(a.shown.slice(0, 3)).toEqual([
      [100, 'thinking'],
      [1400, 'talking'],
      [3900, 'listening'],
    ])
  })

  it('with 800 ms downlink delay, perceived cues arrive 800 ms late and true_state cues on time (CUE-MOD-001, vector 2)', () => {
    const delayed = withDownlinkDelay(clean(), 800)
    const p = setup(delayed, 'perceived')
    const t = setup(delayed, 'true_state')
    p.clock.advance(16_000)
    t.clock.advance(16_000)
    expect(t.shown.slice(0, 3)).toEqual([
      [100, 'thinking'],
      [1400, 'talking'],
      [3900, 'listening'],
    ])
    expect(p.shown.slice(0, 3)).toEqual([
      [900, 'thinking'],
      [2200, 'talking'],
      [4700, 'listening'],
    ])
  })

  it('a cue never appears before its event has arrived (CUE-MOD-004)', () => {
    const p = setup(withDownlinkDelay(clean(), 800), 'perceived')
    p.clock.advance(850) // thinking happened at 100 but is perceived at 900
    expect(p.engine.getState().payload.state).toBe('idle')
    p.clock.advance(50)
    expect(p.shown[0]).toEqual([900, 'thinking'])
  })

  it('switches mode mid-session at once, without restarting or replaying (CUE-MOD-002, vector 3)', () => {
    const { clock, engine, announced } = setup(withDownlinkDelay(clean(), 800), 'perceived')
    clock.advance(2000) // talking is true at 1400 but perceived at 2200
    expect(engine.getState().payload.state).toBe('thinking')
    const logLength = engine.getState().log.length
    engine.setMode('true_state')
    expect(engine.getState().payload.state).toBe('talking')
    expect(engine.getState().log.length).toBe(logLength)
    expect(announced.map(([, text]) => text)).toEqual(['Interviewer is thinking', 'Interviewer is speaking'])
    clock.advance(1000)
    expect(engine.getState().payload.state).toBe('talking')
    expect(announced).toHaveLength(2)
  })

  it('announces once per displayed change over a whole session (CUE-ANN-001, CUE-ANN-002, vector 7)', () => {
    const { clock, shown, announced } = setup(clean(), 'true_state')
    clock.advance(15_000)
    const stateChanges = shown.map(([, s]) => s)
    expect(announced.map(([id]) => id)).toEqual(stateChanges.map((_, i) => i + 1))
    expect(announced.map(([, text]) => text)).toEqual([
      'Interviewer is thinking',
      'Interviewer is speaking',
      'Your turn',
      'Interviewer is thinking',
      'Interviewer is speaking',
      'Your turn',
      'Session ended',
    ])
  })

  it('follows the displayed cue, not the hidden state, when announcing (CUE-ANN-001)', () => {
    const { clock, announced } = setup(withDownlinkDelay(clean(), 800), 'perceived')
    clock.advance(1000) // true state is already thinking, and talking is not due until 1400
    expect(announced.map(([, text]) => text)).toEqual(['Interviewer is thinking'])
    clock.advance(1300)
    expect(announced.map(([, text]) => text)).toEqual(['Interviewer is thinking', 'Interviewer is speaking'])
  })

  it('exposes both lanes in debug mode, with the offset of the latest transition (CUE-MOD-001)', () => {
    const { clock, engine } = setup(withDownlinkDelay(clean(), 800), 'debug')
    clock.advance(1500)
    expect(engine.getState().payload.lanes).toEqual({ trueState: 'talking', perceivedState: 'thinking', offsetMs: 800 })
    expect(engine.getState().payload.state).toBe('thinking') // debug shows what the user would perceive
  })

  it('shows no lanes outside debug mode', () => {
    const { clock, engine } = setup(clean(), 'perceived')
    clock.advance(1500)
    expect(engine.getState().payload.lanes).toBeNull()
  })

  it('stops updating after stop()', () => {
    const { clock, engine } = setup(clean(), 'true_state')
    clock.advance(1500)
    engine.stop()
    clock.advance(15_000)
    expect(engine.getState().payload.state).toBe('talking')
  })

  it('follows a front-end clock that runs fast (drifting Clock port)', () => {
    const clock = new SimulatedClock({ driftPpm: 100_000 }) // 10% fast
    const engine = new CueEngine(new ScriptedEventSource(clean(), clock), clock, 'true_state')
    engine.start()
    clock.advance(1270)
    expect(engine.getState().payload.state).toBe('thinking') // 1400 ms of session time is about 1273 ms of real time
    clock.advance(5)
    expect(engine.getState().payload.state).toBe('talking')
  })
})

describe('CueEngine against calibrated scripts (false cutoffs)', () => {
  it('shows listening, thinking, then back to listening when the user resumes before a word is said (micro-pauses P3)', () => {
    const { clock, shown } = setup(builtMockStream('turn-eager'), 'true_state')
    clock.advance(40_000)
    const labels = shown.map(([, s]) => s)
    // question: thinking, talking, listening. Then the breath-pause cutoff: thinking, listening.
    expect(labels.slice(0, 5)).toEqual(['thinking', 'talking', 'listening', 'thinking', 'listening'])
  })

  it('announces every flip of an eager session exactly once, in order, with no repeats', () => {
    const { clock, shown, announced } = setup(builtMockStream('turn-eager'), 'true_state')
    clock.advance(40_000)
    expect(announced).toHaveLength(shown.length)
    for (let i = 1; i < announced.length; i++) expect(announced[i]![1]).not.toBe(announced[i - 1]![1])
  })

  it('patient shows no cutoff flip: one listening stretch through both pauses', () => {
    const { clock, shown } = setup(builtMockStream('turn-patient'), 'true_state')
    clock.advance(40_000)
    expect(shown.map(([, s]) => s)).toEqual(['thinking', 'talking', 'listening', 'thinking', 'talking', 'listening', 'ended'])
  })
})
