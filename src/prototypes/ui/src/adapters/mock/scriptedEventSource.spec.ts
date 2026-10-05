import { describe, expect, it } from 'vitest'
import type { StreamEvent } from '../../core/contract/index.ts'
import { SimulatedClock } from '../simulatedClock.ts'
import { builtMockStream } from './index.ts'
import { ScriptedEventSource } from './scriptedEventSource.ts'

function setup(clockOptions?: ConstructorParameters<typeof SimulatedClock>[0]) {
  const clock = new SimulatedClock(clockOptions)
  const stream = builtMockStream('simulation-off')
  const source = new ScriptedEventSource(stream, clock)
  const seen: StreamEvent[] = []
  source.subscribe((e) => seen.push(e))
  return { clock, stream, source, seen }
}

describe('ScriptedEventSource (the EventSource port)', () => {
  it('exposes the stream header', () => {
    expect(setup().source.header.session_id).toBe('mock-simulation-off')
  })

  it('delivers nothing until started', () => {
    const { clock, seen } = setup()
    clock.advance(20_000)
    expect(seen).toEqual([])
  })

  it('delivers each event when the clock reaches its true time', () => {
    const { clock, source, seen } = setup()
    source.start()
    clock.advance(150)
    expect(seen.map((e) => e.type)).toEqual(['session', 'condition', 'state'])
    expect(seen.every((e) => e.t_true_ms <= 150)).toBe(true)
  })

  it('delivers the whole stream, once, in position order', () => {
    const { clock, source, seen, stream } = setup()
    source.start()
    clock.advance(20_000)
    expect(seen).toEqual(stream.events)
  })

  it('starting twice does not deliver events twice', () => {
    const { clock, source, seen, stream } = setup()
    source.start()
    source.start()
    clock.advance(20_000)
    expect(seen).toHaveLength(stream.events.length)
  })

  it('stops delivering after stop()', () => {
    const { clock, source, seen } = setup()
    source.start()
    clock.advance(150)
    source.stop()
    clock.advance(20_000)
    expect(seen).toHaveLength(3)
  })

  it('stops a listener that unsubscribed, and keeps the others', () => {
    const { clock, source, seen } = setup()
    const other: StreamEvent[] = []
    const off = source.subscribe((e) => other.push(e))
    source.start()
    clock.advance(150)
    off()
    clock.advance(20_000)
    expect(other).toHaveLength(3)
    expect(seen.length).toBeGreaterThan(3)
  })

  it('delivers early in true time when the front-end clock runs fast', () => {
    const { clock, source, seen } = setup({ driftPpm: 100_000 }) // 10% fast
    source.start()
    const talking = () => seen.some((e) => e.type === 'state' && e.state === 'talking') // true time 1400 ms
    clock.advance(1270) // the front end believes 1397 ms have passed
    expect(talking()).toBe(false)
    clock.advance(5) // 1400 ms of its time is reached after about 1273 true ms
    expect(talking()).toBe(true)
  })
})
