import type { EventBase } from './events.ts'

/**
 * When an event reaches the user, in milliseconds on the session clock.
 * - Dropped: it never arrives, so `null` (EVT-SIM-001).
 * - No perceived time stated: simulation is off, so it equals the true time (EVT-SIM-003).
 */
export function perceivedTime(e: EventBase): number | null {
  if (e.dropped) return null
  return e.t_perceived_ms ?? e.t_true_ms
}

/** The timeline a cue mode reads: `true_state` follows true time, `perceived` follows perceived time. */
export function timelineTime(e: EventBase, mode: 'perceived' | 'true_state'): number | null {
  return mode === 'true_state' ? e.t_true_ms : perceivedTime(e)
}

/**
 * Events in the order a user would perceive them. Perceived order can differ from position
 * order because delay varies (EVT-SIM-004). Dropped events are left out. Ties keep position order.
 */
export function inPerceivedOrder<T extends EventBase>(events: readonly T[]): T[] {
  return events
    .filter((e) => perceivedTime(e) !== null)
    .sort((a, b) => perceivedTime(a)! - perceivedTime(b)! || a.position - b.position)
}
