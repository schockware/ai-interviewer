import { describe, expect, it } from 'vitest'
import { inPerceivedOrder, perceivedTime, timelineTime } from './time.ts'

const at = (position: number, t_true_ms: number, extra: { t_perceived_ms?: number; dropped?: true } = {}) => ({
  session_id: 's',
  position,
  t_true_ms,
  ...extra,
})

describe('perceived time (EVT-SIM)', () => {
  it('equals true time when no simulation is stated (EVT-SIM-003, vector 4)', () => {
    expect(perceivedTime(at(0, 2500))).toBe(2500)
  })

  it('uses the stated perceived time when there is one', () => {
    expect(perceivedTime(at(0, 2500, { t_perceived_ms: 3300 }))).toBe(3300)
  })

  it('is null for a dropped event (EVT-SIM-001)', () => {
    expect(perceivedTime(at(0, 2500, { dropped: true }))).toBeNull()
  })

  it('reads true time in true_state and perceived time in perceived (CUE-MOD-001)', () => {
    const e = at(0, 2500, { t_perceived_ms: 3300 })
    expect(timelineTime(e, 'true_state')).toBe(2500)
    expect(timelineTime(e, 'perceived')).toBe(3300)
  })

  it('shows no difference between modes when simulation is off (CUE-MOD-003)', () => {
    const e = at(0, 2500)
    expect(timelineTime(e, 'perceived')).toBe(timelineTime(e, 'true_state'))
  })

  it('sorts by perceived time, leaves out dropped events, and breaks ties by position (EVT-SIM-004)', () => {
    const events = [at(0, 1000, { t_perceived_ms: 5000 }), at(1, 2000, { t_perceived_ms: 3000 }), at(2, 3000, { dropped: true }), at(3, 4000, { t_perceived_ms: 5000 })]
    expect(inPerceivedOrder(events).map((e) => e.position)).toEqual([1, 0, 3])
  })
})
