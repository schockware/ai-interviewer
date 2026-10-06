import { perceivedTime, timelineTime, type StreamEvent } from '../contract/index.ts'
import type { UiState } from './payload.ts'
import type { Timeline } from './strategy.ts'

export interface Lane {
  state: UiState
  /** Perceived minus true timestamp of the transition that produced `state`, or null if none yet. */
  offsetMs: number | null
}

/**
 * What is displayed at session time `nowMs` on one timeline: a pure fold over the events whose
 * time on that timeline has come, in that timeline's order. Because it is a function of the
 * whole log, switching timelines is instant and replays nothing (CUE-MOD-002).
 *
 * Not yet handled: holding the talking cue through gaps in arriving audio (CUE-MOD-005). That
 * needs the dropped-frame scripts and lands with them.
 */
export function laneAt(log: readonly StreamEvent[], timeline: Timeline, nowMs: number): Lane {
  const due = log
    .flatMap((e) => {
      const t = timelineTime(e, timeline)
      return t !== null && t <= nowMs ? [{ e, t }] : []
    })
    .sort((a, b) => a.t - b.t || a.e.position - b.e.position)

  let state: UiState = 'idle'
  let offsetMs: number | null = null
  for (const { e } of due) {
    if (e.type === 'state') {
      state = e.state
      const perceived = perceivedTime(e)
      offsetMs = perceived === null ? null : perceived - e.t_true_ms
    } else if (e.type === 'session' && e.phase === 'ended') {
      state = 'ended'
    }
  }
  return { state, offsetMs }
}

/** The simulation preset in effect on the timeline shown. */
export function presetAt(log: readonly StreamEvent[], timeline: Timeline, nowMs: number): string {
  let preset = 'clean'
  let at = -Infinity
  for (const e of log) {
    const t = timelineTime(e, timeline)
    if (e.type === 'condition' && t !== null && t <= nowMs && t >= at) {
      preset = e.preset
      at = t
    }
  }
  return preset
}

/** Next time after `nowMs` at which a watched timeline changes, or null. */
export function nextDueMs(log: readonly StreamEvent[], watched: readonly Timeline[], nowMs: number): number | null {
  let next: number | null = null
  for (const e of log) {
    for (const timeline of watched) {
      const t = timelineTime(e, timeline)
      if (t !== null && t > nowMs && (next === null || t < next)) next = t
    }
  }
  return next
}
