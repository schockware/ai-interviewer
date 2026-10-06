// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { UiState } from '../core/cues/index.ts'

/** Words and colour for one state on the interview screen. Mockup: design/mockups/ui/Main.dc.html, iteration 1. */
export interface StateView {
  /** Second line under the status. */
  sub: string
  /** What the user hears, in words, for the "Sound:" line. Placeholder sounds today, so this is the intent. */
  sound: string
  /** Picks the colour pair in index.css. */
  tone: 'listening' | 'thinking' | 'talking' | 'idle'
}

const views: Record<UiState, StateView> = {
  idle: { sub: 'Press Start under Call conditions to begin the scripted interview.', sound: 'silence', tone: 'idle' },
  listening: { sub: 'The interviewer is listening. Take your time.', sound: 'chime, then soft office room tone', tone: 'listening' },
  thinking: { sub: 'Taking notes on your answer.', sound: 'pen scribbling', tone: 'thinking' },
  talking: { sub: 'Listen for the question. A chime tells you when it is your turn.', sound: 'the interviewer’s voice', tone: 'talking' },
  paused: { sub: 'Nothing is recording. Resume when you are ready.', sound: 'silence', tone: 'idle' },
  ended: { sub: 'The session is over.', sound: 'silence', tone: 'idle' },
}

export const viewFor = (state: UiState): StateView => views[state]
