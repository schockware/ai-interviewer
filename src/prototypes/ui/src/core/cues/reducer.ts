import type { CueMode, StreamEvent } from '../contract/index.ts'
import { laneAt, presetAt } from './display.ts'
import { chimeOnChange, cueFor, type CuePayload, type UiState } from './payload.ts'
import { strategyFor } from './strategy.ts'

export interface CueState {
  mode: CueMode
  /** Every event received, in arrival order. The display is derived from it, never stored as history. */
  log: readonly StreamEvent[]
  /** Session time the display is current to, in ms. */
  nowMs: number
  payload: CuePayload
}

export type CueAction =
  | { type: 'event'; event: StreamEvent; nowMs: number }
  | { type: 'tick'; nowMs: number }
  | { type: 'mode'; mode: CueMode }

export function initialState(mode: CueMode = 'perceived'): CueState {
  const cue = cueFor('idle')
  return {
    mode,
    log: [],
    nowMs: 0,
    payload: {
      ...cue,
      state: 'idle',
      transitionId: 0,
      chime: false,
      simulation: { active: false, preset: 'clean' },
      modesIdentical: true,
      lanes: null,
      announcementId: 0,
    },
  }
}

/** Rebuilds the payload for the log, mode and time. Counters only advance when the shown state changes. */
function derive(prev: CuePayload, mode: CueMode, log: readonly StreamEvent[], nowMs: number): CuePayload {
  const strategy = strategyFor(mode)
  const shown = laneAt(log, strategy.shown, nowMs)
  const preset = presetAt(log, strategy.shown, nowMs)
  const changed = shown.state !== prev.state
  // Keep the same object when nothing visible moved, so a UI reading the payload does not re-render per event.
  if (!changed && !strategy.exposeLanes && prev.lanes === null && prev.simulation.preset === preset) return prev
  const state: UiState = shown.state
  const cue = cueFor(state)
  const simulationActive = preset !== 'clean'

  return {
    ...cue,
    state,
    transitionId: changed ? prev.transitionId + 1 : prev.transitionId,
    chime: changed ? chimeOnChange(prev.state, state) : prev.chime,
    // CUE-ANN-001, CUE-ANN-002: announce the displayed change once, and an unchanged state not at all.
    announcement: changed ? cue.announcement : prev.announcement,
    announcementId: changed ? prev.announcementId + 1 : prev.announcementId,
    simulation: { active: simulationActive, preset },
    modesIdentical: !simulationActive,
    lanes: strategy.exposeLanes
      ? {
          trueState: laneAt(log, 'true_state', nowMs).state,
          perceivedState: laneAt(log, 'perceived', nowMs).state,
          offsetMs: laneAt(log, 'perceived', nowMs).offsetMs,
        }
      : null,
  }
}

export function reduce(state: CueState, action: CueAction): CueState {
  switch (action.type) {
    case 'event': {
      const log = [...state.log, action.event]
      const nowMs = Math.max(state.nowMs, action.nowMs)
      return { ...state, log, nowMs, payload: derive(state.payload, state.mode, log, nowMs) }
    }
    case 'tick': {
      const nowMs = Math.max(state.nowMs, action.nowMs)
      return { ...state, nowMs, payload: derive(state.payload, state.mode, state.log, nowMs) }
    }
    case 'mode':
      // CUE-MOD-002: the log is kept and only the reading of it changes. No restart, no replay.
      if (action.mode === state.mode) return state
      return { ...state, mode: action.mode, payload: derive(state.payload, action.mode, state.log, state.nowMs) }
  }
}
