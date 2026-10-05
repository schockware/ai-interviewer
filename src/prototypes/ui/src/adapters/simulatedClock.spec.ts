import { describe, expect, it, vi } from 'vitest'
import { SimulatedClock } from './simulatedClock.ts'

describe('SimulatedClock', () => {
  it('advances by hand and reports exact time with no drift', () => {
    const c = new SimulatedClock()
    c.advance(250)
    expect(c.now()).toBe(250)
  })

  it('applies offset and drift to readings', () => {
    const c = new SimulatedClock({ offsetMs: 40, driftPpm: 1000 }) // 0.1% fast
    c.advance(10_000)
    expect(c.now()).toBeCloseTo(10_010 + 40, 6)
  })

  it('fires scheduled work in order and honours cancel', () => {
    const c = new SimulatedClock()
    const calls: string[] = []
    c.schedule(200, () => calls.push('b'))
    c.schedule(100, () => calls.push('a'))
    const cancel = c.schedule(150, () => calls.push('x'))
    cancel()
    c.advance(300)
    expect(calls).toEqual(['a', 'b'])
  })

  it('a fast clock fires a timer early in true time', () => {
    const c = new SimulatedClock({ driftPpm: 100_000 }) // 10% fast
    const fn = vi.fn()
    c.schedule(1100, fn)
    c.advance(999)
    expect(fn).not.toHaveBeenCalled()
    c.advance(2)
    expect(fn).toHaveBeenCalledOnce()
  })
})
