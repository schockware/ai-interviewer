import { describe, expect, it } from 'vitest'
import { createPositionTracker, perceivedTime } from '../../core/contract/index.ts'
import { buildStream } from './buildStream.ts'
import { builtMockStream } from './index.ts'
import type { MockScript } from './script.ts'

const tiny = (events: MockScript['events']): MockScript => ({
  name: 'tiny',
  description: '',
  covers: [],
  session_id: 's',
  events,
})

describe('buildStream, acting as the authority (EVT-CORE-004)', () => {
  it('assigns positions from 0 with no gaps or duplicates (EVT-CORE-003)', () => {
    const { events } = builtMockStream('simulation-off')
    const tracker = createPositionTracker(0)
    expect(events.map((e) => tracker.accept(e.position).kind).every((k) => k === 'ok')).toBe(true)
    expect(events[0]?.position).toBe(0)
  })

  it('keeps true timestamps non-decreasing in position order (EVT-TIME-002)', () => {
    const { events } = builtMockStream('simulation-off')
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.t_true_ms).toBeGreaterThanOrEqual(events[i - 1]!.t_true_ms)
    }
  })

  it('orders out-of-order script entries by true time, ties by script order', () => {
    const { events } = buildStream(
      tiny([
        { type: 'state', t_true_ms: 500, state: 'talking' },
        { type: 'state', t_true_ms: 100, state: 'thinking' },
        { type: 'state', t_true_ms: 500, state: 'listening' },
      ]),
    )
    expect(events.map((e) => e.type === 'state' && e.state)).toEqual(['thinking', 'talking', 'listening'])
  })

  it('expands an audio run into one frame event per frame (EVT-TYPE-002)', () => {
    const { events } = buildStream(
      tiny([{ type: 'audio_run', stream: 'voice', start_ms: 1000, seq_from: 7, count: 3, dur_ms: 20 }]),
    )
    expect(events.map((e) => [e.t_true_ms, e.type === 'audio_frame' && e.seq])).toEqual([
      [1000, 7],
      [1020, 8],
      [1040, 9],
    ])
  })

  it('carries the session identifier and the format version (EVT-CORE-002, EVT-CORE-005)', () => {
    const { header, events } = buildStream(tiny([{ type: 'state', t_true_ms: 0, state: 'listening' }]))
    expect(header).toEqual({ format_version: 1, session_id: 's' })
    expect(events[0]?.session_id).toBe('s')
  })

  it('refuses a script that breaks the contract, naming the event', () => {
    const bad = tiny([{ type: 'state', t_true_ms: 0, state: 'dancing' } as never])
    expect(() => buildStream(bad)).toThrow(/event 0 \(state\)/)
  })
})

describe('the simulation-off script', () => {
  const { events } = builtMockStream('simulation-off')

  it('has no perceived times and no dropped markers, so perceived equals true (EVT-SIM-003)', () => {
    for (const e of events) {
      expect(e.t_perceived_ms).toBeUndefined()
      expect(e.dropped).toBeUndefined()
      expect(perceivedTime(e)).toBe(e.t_true_ms)
    }
  })

  it('walks the conversation through thinking, talking and listening twice (CUE-STA-001)', () => {
    const states = events.flatMap((e) => (e.type === 'state' ? [e.state] : []))
    expect(states).toEqual(['thinking', 'talking', 'listening', 'thinking', 'talking', 'listening'])
  })

  it('links every interviewer text to frames that exist (EVT-TYPE-006)', () => {
    const seqs = new Set(events.flatMap((e) => (e.type === 'audio_frame' ? [e.seq] : [])))
    for (const e of events) {
      if (e.type !== 'interviewer_text' || !e.frames) continue
      expect(seqs.has(e.frames.from_seq)).toBe(true)
      expect(seqs.has(e.frames.to_seq)).toBe(true)
    }
  })

  it('has a final transcript piece that replaces earlier partial pieces (EVT-TYPE-005)', () => {
    const partials = new Set(events.flatMap((e) => (e.type === 'transcript' && !e.final ? [e.id] : [])))
    const final = events.find((e) => e.type === 'transcript' && e.final)
    expect(final?.type === 'transcript' && final.replaces?.every((id) => partials.has(id))).toBe(true)
  })
})
