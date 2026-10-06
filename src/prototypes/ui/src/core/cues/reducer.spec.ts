import { describe, expect, it } from 'vitest'
import type { StreamEvent } from '../contract/index.ts'
import { initialState, reduce, type CueAction, type CueState } from './reducer.ts'

const state = (position: number, s: 'listening' | 'thinking' | 'talking' | 'paused', t: number, perceived?: number): StreamEvent => ({
  type: 'state',
  session_id: 's',
  position,
  t_true_ms: t,
  state: s,
  ...(perceived === undefined ? {} : { t_perceived_ms: perceived }),
})

const run = (start: CueState, actions: CueAction[]) => actions.reduce(reduce, start)

describe('cue reducer', () => {
  it('starts idle with nothing announced (CUE-ANN-002)', () => {
    const s = initialState()
    expect(s.payload.state).toBe('idle')
    expect(s.payload.announcementId).toBe(0)
  })

  it('shows exactly one state, the latest whose time has come (CUE-STA-001)', () => {
    const s = run(initialState('true_state'), [
      { type: 'event', event: state(0, 'thinking', 100), nowMs: 100 },
      { type: 'event', event: state(1, 'talking', 200), nowMs: 200 },
    ])
    expect(s.payload.state).toBe('talking')
  })

  it('holds back an event whose perceived time has not come (CUE-MOD-004)', () => {
    const s = run(initialState('perceived'), [{ type: 'event', event: state(0, 'thinking', 100, 900), nowMs: 100 }])
    expect(s.payload.state).toBe('idle')
    expect(reduce(s, { type: 'tick', nowMs: 899 }).payload.state).toBe('idle')
    expect(reduce(s, { type: 'tick', nowMs: 900 }).payload.state).toBe('thinking')
  })

  it('announces a change once, and an unchanged state not at all (CUE-ANN-001, CUE-ANN-002)', () => {
    let s = run(initialState('true_state'), [{ type: 'event', event: state(0, 'thinking', 100), nowMs: 100 }])
    expect([s.payload.announcement, s.payload.announcementId]).toEqual(['Interviewer is thinking', 1])
    s = run(s, [
      { type: 'tick', nowMs: 150 },
      { type: 'event', event: state(1, 'thinking', 160), nowMs: 160 },
    ])
    expect(s.payload.announcementId).toBe(1)
    s = run(s, [{ type: 'event', event: state(2, 'listening', 300), nowMs: 300 }])
    expect([s.payload.announcement, s.payload.announcementId]).toEqual(['Your turn', 2])
  })

  it('keeps the same payload object when nothing visible changed', () => {
    const a = run(initialState('true_state'), [{ type: 'event', event: state(0, 'thinking', 100), nowMs: 100 }])
    const b = reduce(a, { type: 'tick', nowMs: 500 })
    expect(b.payload).toBe(a.payload)
  })

  it('marks a chime only on the hand-off to the user (CUE-STA-003)', () => {
    const at = (s: CueState) => [s.payload.state, s.payload.chime]
    let s = run(initialState('true_state'), [{ type: 'event', event: state(0, 'thinking', 100), nowMs: 100 }])
    expect(at(s)).toEqual(['thinking', false])
    s = run(s, [{ type: 'event', event: state(1, 'talking', 200), nowMs: 200 }])
    expect(at(s)).toEqual(['talking', false])
    s = run(s, [{ type: 'event', event: state(2, 'listening', 300), nowMs: 300 }])
    expect(at(s)).toEqual(['listening', true])
  })

  it('gives every state a label, an icon and a sound or words (CUE-RED-001, CUE-RED-002)', () => {
    for (const st of ['listening', 'thinking', 'talking', 'paused'] as const) {
      const p = run(initialState('true_state'), [{ type: 'event', event: state(0, st, 0), nowMs: 0 }]).payload
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.icon).not.toBe('neutral')
      expect(p.announcement.length).toBeGreaterThan(0)
      expect(['room_tone', 'scribbling', 'voice', 'none']).toContain(p.soundBed)
    }
  })

  it('switches mode at once, keeping the log (CUE-MOD-002)', () => {
    let s = run(initialState('perceived'), [{ type: 'event', event: state(0, 'talking', 100, 900), nowMs: 100 }])
    expect(s.payload.state).toBe('idle')
    const logBefore = s.log
    s = reduce(s, { type: 'mode', mode: 'true_state' })
    expect(s.payload.state).toBe('talking')
    expect(s.log).toBe(logBefore)
  })

  it('says the modes are identical until a condition is simulated (CUE-MOD-003)', () => {
    const condition = (preset: string): StreamEvent => ({
      type: 'condition',
      session_id: 's',
      position: 0,
      t_true_ms: 0,
      preset,
      params: {},
      seed: 1,
    })
    const clean = run(initialState(), [{ type: 'event', event: condition('clean'), nowMs: 0 }])
    expect(clean.payload.modesIdentical).toBe(true)
    const laggy = run(initialState(), [{ type: 'event', event: condition('laggy_clipped'), nowMs: 0 }])
    expect(laggy.payload).toMatchObject({ modesIdentical: false, simulation: { active: true, preset: 'laggy_clipped' } })
  })

  it('shows session end', () => {
    const ended: StreamEvent = { type: 'session', session_id: 's', position: 1, t_true_ms: 50, phase: 'ended' }
    expect(run(initialState('true_state'), [{ type: 'event', event: ended, nowMs: 50 }]).payload.state).toBe('ended')
  })
})
