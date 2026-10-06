// Ports: what core/ needs from the outside, in its own terms (decision 0003, ports and adapters).
// core/ imports nothing from adapters/ or ui/, and names no framework or browser API.

import type { StreamEvent, StreamHeader } from './contract/index.ts'

/**
 * Where events come from. A mock script, a recorded stream or a WebSocket all implement this,
 * so core/ never knows which. Events arrive in position order, each as the authority produced
 * it, with both timestamps already on it (see src/design/events, "simulate by timestamp").
 */
export interface EventSource {
  /** The first message of the stream (EVT-CORE-005). */
  readonly header: StreamHeader
  /** Returns a function that unsubscribes. */
  subscribe(listener: (event: StreamEvent) => void): () => void
  /** Begin delivering. Calling it twice has no effect. */
  start(): void
  /** Stop delivering. Events not yet delivered are not delivered later. */
  stop(): void
}

/** Time source. All timing in core/ goes through this, so tests and the simulator can drift it. */
export interface Clock {
  /** Milliseconds since an arbitrary origin, as this clock sees it. */
  now(): number
  /** Run `fn` after `delayMs` of this clock's time. Returns a function that cancels it. */
  schedule(delayMs: number, fn: () => void): () => void
}

/** Makes the sounds that go with cues (CUE-RED-001). Sound is placeholder for now: simple generated tones. */
export interface CuePlayer {
  /** The hand-off to the user (CUE-STA-003). */
  chime(): void
  /** Must be called from a user gesture in a browser, so sound is never played on its own (CUE-AMB-001). */
  unlock(): void
  /** Sound on or off, as the user chose. */
  setMuted(muted: boolean): void
}
