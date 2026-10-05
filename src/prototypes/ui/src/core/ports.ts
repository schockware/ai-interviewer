// Ports: what core/ needs from the outside, in its own terms (decision 0003, ports and adapters).
// core/ imports nothing from adapters/ or ui/, and names no framework or browser API.

/** Time source. All timing in core/ goes through this, so tests and the simulator can drift it. */
export interface Clock {
  /** Milliseconds since an arbitrary origin, as this clock sees it. */
  now(): number
  /** Run `fn` after `delayMs` of this clock's time. Returns a function that cancels it. */
  schedule(delayMs: number, fn: () => void): () => void
}
