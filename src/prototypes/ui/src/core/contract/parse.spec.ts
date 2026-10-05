import { describe, expect, it } from 'vitest'
import { parseEvent } from './parse.ts'

const base = { session_id: 's1', position: 4, t_true_ms: 4210 }

describe('parseEvent (EVT consumer rules)', () => {
  it('accepts a valid state event (EVT-CORE-002, EVT-TYPE-001)', () => {
    const out = parseEvent({ ...base, type: 'state', state: 'thinking' })
    expect(out).toMatchObject({ kind: 'event', event: { type: 'state', state: 'thinking' } })
  })

  it('passes over an unknown type without failing (EVT-EXT-001, vector 2)', () => {
    expect(parseEvent({ ...base, type: 'hologram', beam: 3 })).toEqual({ kind: 'ignored', type: 'hologram' })
  })

  it('passes over an unknown field on a known type (EVT-EXT-004, vector 2)', () => {
    const out = parseEvent({ ...base, type: 'state', state: 'talking', mood: 'cheerful' })
    expect(out.kind).toBe('event')
  })

  it('rejects a perceived time earlier than the true time (EVT-SIM-002, vector 3)', () => {
    const out = parseEvent({ ...base, type: 'state', state: 'talking', t_perceived_ms: 4000 })
    expect(out).toMatchObject({ kind: 'invalid' })
  })

  it('accepts a perceived time equal to or later than the true time (EVT-SIM-002)', () => {
    expect(parseEvent({ ...base, type: 'state', state: 'talking', t_perceived_ms: 4210 }).kind).toBe('event')
    expect(parseEvent({ ...base, type: 'state', state: 'talking', t_perceived_ms: 5000 }).kind).toBe('event')
  })

  it('rejects an event that is both perceived and dropped (EVT-SIM-001)', () => {
    const out = parseEvent({ ...base, type: 'state', state: 'talking', t_perceived_ms: 5000, dropped: true })
    expect(out).toMatchObject({ kind: 'invalid' })
  })

  it('accepts a dropped marker with no perceived time (EVT-SIM-001)', () => {
    const out = parseEvent({ ...base, type: 'audio_frame', stream: 'voice', seq: 1, dur_ms: 20, dropped: true })
    expect(out.kind).toBe('event')
  })

  it.each([
    ['no session', { type: 'state', state: 'talking', position: 1, t_true_ms: 1 }],
    ['no position', { type: 'state', state: 'talking', session_id: 's', t_true_ms: 1 }],
    ['no true timestamp', { type: 'state', state: 'talking', session_id: 's', position: 1 }],
  ])('rejects an envelope with %s (EVT-CORE-002)', (_name, raw) => {
    expect(parseEvent(raw).kind).toBe('invalid')
  })

  it('does not throw on non-objects, and reports them invalid', () => {
    for (const raw of [null, undefined, 42, 'x', [], { type: 7 }]) {
      expect(parseEvent(raw).kind).toBe('invalid')
    }
  })

  it('only lets a final transcript piece replace earlier pieces (EVT-TYPE-005, vector 6)', () => {
    const t = { ...base, type: 'transcript', id: 'b', text: 'hello world' }
    expect(parseEvent({ ...t, final: true, replaces: ['a1', 'a2'] }).kind).toBe('event')
    expect(parseEvent({ ...t, final: false, replaces: ['a1'] }).kind).toBe('invalid')
  })

  it('accepts interviewer text with and without a frame link (EVT-TYPE-006)', () => {
    const t = { ...base, type: 'interviewer_text', id: 'q1', text: 'Tell me about yourself.' }
    expect(parseEvent(t).kind).toBe('event')
    expect(parseEvent({ ...t, frames: { from_seq: 10, to_seq: 60 } }).kind).toBe('event')
    expect(parseEvent({ ...t, frames: { from_seq: 60, to_seq: 10 } }).kind).toBe('invalid')
  })
})
