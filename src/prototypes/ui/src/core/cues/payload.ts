import type { ConversationState } from '../contract/index.ts'

/** What the user is shown. `idle` is before the first state, `ended` after the session ends. */
export type UiState = 'idle' | ConversationState | 'ended'

export type CueIcon = 'neutral' | 'ear' | 'thought' | 'ellipsis' | 'pause'
export type SoundBed = 'none' | 'room_tone' | 'scribbling' | 'voice'

/** The sight, sound and words for one state (SPEC §4 table). Every cue has an equivalent in another sense (CUE-RED-001). */
export interface StateCue {
  /** Visible words that sit beside the icon, so an icon never stands alone (CUE-RED-002). */
  label: string
  icon: CueIcon
  /** Sound that goes with the state. The player decides how to make it. */
  soundBed: SoundBed
  /** Words for assistive technology when this state appears (CUE-ANN-001). */
  announcement: string
}

const cues: Record<UiState, StateCue> = {
  idle: { label: 'Not started', icon: 'neutral', soundBed: 'none', announcement: 'Not started' },
  listening: { label: 'Your turn', icon: 'ear', soundBed: 'room_tone', announcement: 'Your turn' },
  thinking: { label: 'Interviewer is thinking', icon: 'thought', soundBed: 'scribbling', announcement: 'Interviewer is thinking' },
  talking: { label: 'Interviewer is speaking', icon: 'ellipsis', soundBed: 'voice', announcement: 'Interviewer is speaking' },
  paused: { label: 'Paused', icon: 'pause', soundBed: 'none', announcement: 'Paused' },
  ended: { label: 'Session ended', icon: 'neutral', soundBed: 'none', announcement: 'Session ended' },
}

export const cueFor = (state: UiState): StateCue => cues[state]

/** The hand-off to the user gets its own sound as well as its own icon (CUE-STA-003). */
export const chimeOnChange = (from: UiState, to: UiState): boolean => to === 'listening' && from !== 'listening'

/**
 * The payload the presentation layer renders as received. It decides nothing:
 * which timeline produced it is the strategy's business.
 */
export interface CuePayload extends StateCue {
  state: UiState
  /** Changes every time the displayed state changes. A player sounds a transition once per id. */
  transitionId: number
  /** True when the change that produced this payload should be marked with a chime. */
  chime: boolean
  /** Latest words for the live region. `id` changes only when the displayed state changes (CUE-ANN-001, CUE-ANN-002). */
  announcement: string
  announcementId: number
  simulation: { active: boolean; preset: string }
  /** CUE-MOD-003: say so when the two modes cannot differ. */
  modesIdentical: boolean
  /** Only in debug mode (CUE-MOD-001): both timelines, with the offset of the latest transition. */
  lanes: { trueState: UiState; perceivedState: UiState; offsetMs: number | null } | null
}
