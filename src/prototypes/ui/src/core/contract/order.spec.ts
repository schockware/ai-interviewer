import { describe, expect, it } from 'vitest'
import { createPositionTracker } from './order.ts'

describe('position tracker (EVT-CORE-003, EVT-DELIV-001)', () => {
  it('accepts consecutive positions', () => {
    const t = createPositionTracker(0)
    expect([0, 1, 2].map((p) => t.accept(p).kind)).toEqual(['ok', 'ok', 'ok'])
  })

  it('reports a gap and where it is (vector 1)', () => {
    const t = createPositionTracker(0)
    t.accept(0)
    t.accept(1)
    expect(t.accept(5)).toEqual({ kind: 'gap', from: 2, to: 4 })
  })

  it('reports a gap once, then carries on from the new position', () => {
    const t = createPositionTracker(0)
    t.accept(0)
    t.accept(3)
    expect(t.accept(4)).toEqual({ kind: 'ok' })
  })

  it('reports a gap at the start when the stream must begin at a given position', () => {
    const t = createPositionTracker(0)
    expect(t.accept(2)).toEqual({ kind: 'gap', from: 0, to: 1 })
  })

  it('does not report history to a consumer that joins late (EVT-DELIV-002)', () => {
    const t = createPositionTracker()
    expect(t.accept(40)).toEqual({ kind: 'ok' })
    expect(t.accept(41)).toEqual({ kind: 'ok' })
  })

  it('reports a repeated or older position as a duplicate', () => {
    const t = createPositionTracker(0)
    t.accept(0)
    t.accept(1)
    expect(t.accept(1)).toEqual({ kind: 'duplicate' })
    expect(t.accept(0)).toEqual({ kind: 'duplicate' })
  })
})
