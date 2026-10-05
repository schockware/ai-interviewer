// DRAFT contract for the event stream, written by the UI implementer because specs/events has no
// typed schema yet. Answers specs/events (EVT). Proposed for adoption there; see
// docs/research/prototype-ui.md, "Findings for the spec". Wire names follow SPEC.MD section 7.
//
// Pure types and constants. No framework, browser API or transport (decision 0003).

/** EVT-CORE-005: the version a consumer checks before reading a stream. */
export const FORMAT_VERSION = 1

/** First message of a stream. Not an event: it has no position or timestamp. */
export interface StreamHeader {
  format_version: number
  session_id: string
}

export const CONVERSATION_STATES = ['listening', 'thinking', 'talking', 'paused'] as const
export type ConversationState = (typeof CONVERSATION_STATES)[number]

export const AUDIO_STREAMS = ['voice', 'ambient', 'effects', 'user'] as const
export type AudioStream = (typeof AUDIO_STREAMS)[number]

export const CONTROL_ACTIONS = [
  'pause',
  'resume',
  'repeat',
  'skip',
  'hint',
  'give_me_a_sec',
  'push_to_talk_start',
  'push_to_talk_stop',
  'switch_to_voice',
  'switch_to_text',
] as const
export type ControlAction = (typeof CONTROL_ACTIONS)[number]

export const CUE_MODES = ['perceived', 'true_state', 'debug'] as const
export type CueMode = (typeof CUE_MODES)[number]

export const INTERFACES = ['voice', 'text', 'both'] as const
export type Interface = (typeof INTERFACES)[number]

/**
 * Fields on every event.
 * EVT-CORE-002: type, session, position and true timestamp.
 * Times are milliseconds on the session clock, from the start of the session (EVT-TIME-001).
 * Latency emulation is tuned at the millisecond level, so every layer works in ms and no
 * conversion is needed. Fractions are allowed, so 1 ms resolution or finer holds (EVT-TIME-003).
 * EVT-SIM-001: after simulation an event has t_perceived_ms or dropped, never both.
 */
export interface EventBase {
  session_id: string
  position: number
  t_true_ms: number
  t_perceived_ms?: number
  dropped?: true
}

/** EVT-TYPE-001 */
export interface StateEvent extends EventBase {
  type: 'state'
  state: ConversationState
}

/** EVT-TYPE-002. The audio itself travels beside the event (open question 3 in specs/events). */
export interface AudioFrameEvent extends EventBase {
  type: 'audio_frame'
  stream: AudioStream
  seq: number
  dur_ms: number
}

/** EVT-TYPE-003 */
export interface SpeechActivityEvent extends EventBase {
  type: 'speech_activity'
  activity: 'started' | 'stopped'
}

/** EVT-TYPE-004 */
export interface TurnDecisionEvent extends EventBase {
  type: 'turn_decision'
  confidence: number
}

/** EVT-TYPE-005. A final piece names the partial pieces it replaces. */
export interface TranscriptEvent extends EventBase {
  type: 'transcript'
  id: string
  text: string
  final: boolean
  replaces?: string[]
}

/** A run of audio frames on the voice stream. Sentence-level, as proposed in src/design/events. */
export interface FrameRange {
  from_seq: number
  to_seq: number
}

/**
 * EVT-TYPE-006. `frames` links the text to the audio that carries it. Optional, because text can be
 * produced before its audio exists; as_heard captions (CUE-CAP-002) need it once audio does.
 */
export interface InterviewerTextEvent extends EventBase {
  type: 'interviewer_text'
  id: string
  text: string
  frames?: FrameRange
}

/** EVT-TYPE-007. The authority's record of a user request. */
export interface ControlEvent extends EventBase {
  type: 'control'
  action: ControlAction
}

/** EVT-TYPE-008 */
export interface ConditionEvent extends EventBase {
  type: 'condition'
  preset: string
  params: Record<string, number | string>
  seed: number
}

/** EVT-TYPE-009. `config` is for later reading of the record (cue mode, preset, interface). */
export interface SessionEvent extends EventBase {
  type: 'session'
  phase: 'started' | 'ended'
  config?: { cue_mode: CueMode; preset: string; interface: Interface }
}

/** EVT-TYPE-010. `effect` says what the user will experience. */
export interface FaultEvent extends EventBase {
  type: 'fault'
  layer: string
  effect: string
  detail?: string
}

export type StreamEvent =
  | StateEvent
  | AudioFrameEvent
  | SpeechActivityEvent
  | TurnDecisionEvent
  | TranscriptEvent
  | InterviewerTextEvent
  | ControlEvent
  | ConditionEvent
  | SessionEvent
  | FaultEvent

export type EventType = StreamEvent['type']

/**
 * A request from the user interface. Not an event: it has no position or timestamp, because only
 * the authority assigns those (EVT-CORE-004). The authority answers with a ControlEvent.
 */
export interface ControlRequest {
  type: 'control_request'
  action: ControlAction
}
