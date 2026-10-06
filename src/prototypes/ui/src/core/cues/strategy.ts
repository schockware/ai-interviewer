import type { CueMode } from '../contract/index.ts'

export type Timeline = 'perceived' | 'true_state'

/**
 * The middle layer's choice of how to build the cue payload. A strategy says which timeline
 * drives what is shown and whether to expose both lanes. It is small on purpose: the payload
 * shape comes out of the vectors, and the presentation layer renders what it is given.
 */
export interface CueStrategy {
  readonly mode: CueMode
  /** The timeline the user-facing cue follows (CUE-MOD-001). */
  readonly shown: Timeline
  /** Timelines whose transitions must wake the engine. Debug follows both. */
  readonly watched: readonly Timeline[]
  /** Expose both lanes in the payload (CUE-MOD-001, debug). */
  readonly exposeLanes: boolean
}

const perceived: CueStrategy = { mode: 'perceived', shown: 'perceived', watched: ['perceived'], exposeLanes: false }
const trueState: CueStrategy = { mode: 'true_state', shown: 'true_state', watched: ['true_state'], exposeLanes: false }
// Debug shows what the user would perceive, and also exposes both lanes for comparison.
const debug: CueStrategy = { mode: 'debug', shown: 'perceived', watched: ['perceived', 'true_state'], exposeLanes: true }

export function strategyFor(mode: CueMode): CueStrategy {
  return mode === 'true_state' ? trueState : mode === 'debug' ? debug : perceived
}
