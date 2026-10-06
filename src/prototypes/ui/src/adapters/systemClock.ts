import type { Clock } from '../core/ports.ts'

/** The real clock. Not used in tests, which use SimulatedClock. */
export class SystemClock implements Clock {
  now(): number {
    return performance.now()
  }

  schedule(delayMs: number, fn: () => void): () => void {
    const id = setTimeout(fn, delayMs)
    return () => clearTimeout(id)
  }
}
