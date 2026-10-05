import type { Clock } from '../core/ports.ts'

export interface SimulatedClockOptions {
  /** Offset added to every reading, in ms. */
  offsetMs?: number
  /** Drift in parts per million. +100 means this clock runs 0.01% fast. */
  driftPpm?: number
}

interface Timer {
  due: number
  fn: () => void
}

/**
 * A clock the test advances by hand, with optional offset and drift, so front-end
 * component tests can emulate a clock that disagrees with the event stream's.
 */
export class SimulatedClock implements Clock {
  private trueMs = 0
  private seq = 0
  private timers = new Map<number, Timer>()

  private readonly opts: SimulatedClockOptions

  constructor(opts: SimulatedClockOptions = {}) {
    this.opts = opts
  }

  private scale() {
    return 1 + (this.opts.driftPpm ?? 0) / 1e6
  }

  now(): number {
    return this.trueMs * this.scale() + (this.opts.offsetMs ?? 0)
  }

  schedule(delayMs: number, fn: () => void): () => void {
    const id = this.seq++
    // A fast clock reaches `delayMs` of its own time in less true time.
    this.timers.set(id, { due: this.trueMs + delayMs / this.scale(), fn })
    return () => void this.timers.delete(id)
  }

  /** Advance true time by `trueMs`, firing due timers in order. */
  advance(trueMs: number): void {
    const target = this.trueMs + trueMs
    for (;;) {
      let next: [number, Timer] | undefined
      for (const entry of this.timers) {
        if (entry[1].due <= target && (!next || entry[1].due < next[1].due)) next = entry
      }
      if (!next) break
      this.timers.delete(next[0])
      this.trueMs = Math.max(this.trueMs, next[1].due)
      next[1].fn()
    }
    this.trueMs = target
  }
}
