import {
  AUDIO_STREAMS,
  CONTROL_ACTIONS,
  CONVERSATION_STATES,
  CUE_MODES,
  INTERFACES,
  type EventBase,
  type StreamEvent,
} from './events.ts'

/**
 * What a consumer does with one raw message (a parsed JSON value).
 * - `event`: a known type, valid.
 * - `ignored`: a type this consumer does not know. Never an error (EVT-EXT-001).
 * - `invalid`: a malformed envelope or payload, or a rule broken (EVT-SIM-001, EVT-SIM-002).
 */
export type ParseOutcome =
  | { kind: 'event'; event: StreamEvent }
  | { kind: 'ignored'; type: string }
  | { kind: 'invalid'; reasons: string[] }

type Raw = Record<string, unknown>

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

function checkEnvelope(raw: Raw, reasons: string[]): void {
  if (!isStr(raw.session_id) || raw.session_id === '') reasons.push('session_id must be a non-empty string')
  if (!isNum(raw.position) || !Number.isInteger(raw.position) || raw.position < 0)
    reasons.push('position must be a non-negative integer')
  if (!isNum(raw.t_true_ms) || raw.t_true_ms < 0) reasons.push('t_true_ms must be a non-negative number')
  const hasPerceived = raw.t_perceived_ms !== undefined
  const hasDropped = raw.dropped !== undefined
  if (hasPerceived && hasDropped) reasons.push('t_perceived_ms and dropped are mutually exclusive (EVT-SIM-001)')
  if (hasPerceived) {
    if (!isNum(raw.t_perceived_ms)) reasons.push('t_perceived_ms must be a number')
    else if (isNum(raw.t_true_ms) && raw.t_perceived_ms < raw.t_true_ms)
      reasons.push('t_perceived_ms must not be earlier than t_true_ms (EVT-SIM-002)')
  }
  if (hasDropped && raw.dropped !== true) reasons.push('dropped must be true when present')
}

function checkPayload(type: string, raw: Raw, reasons: string[]): void {
  switch (type) {
    case 'state':
      if (!oneOf(CONVERSATION_STATES, raw.state)) reasons.push('state must be a conversation state')
      break
    case 'audio_frame':
      if (!oneOf(AUDIO_STREAMS, raw.stream)) reasons.push('stream must be an audio stream')
      if (!isNum(raw.seq) || !Number.isInteger(raw.seq) || raw.seq < 0) reasons.push('seq must be a non-negative integer')
      if (!isNum(raw.dur_ms) || raw.dur_ms <= 0) reasons.push('dur_ms must be positive')
      break
    case 'speech_activity':
      if (raw.activity !== 'started' && raw.activity !== 'stopped') reasons.push('activity must be started or stopped')
      break
    case 'turn_decision':
      if (!isNum(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) reasons.push('confidence must be 0 to 1')
      break
    case 'transcript':
      if (!isStr(raw.id)) reasons.push('id must be a string')
      if (!isStr(raw.text)) reasons.push('text must be a string')
      if (typeof raw.final !== 'boolean') reasons.push('final must be a boolean')
      if (raw.replaces !== undefined && !(Array.isArray(raw.replaces) && raw.replaces.every(isStr)))
        reasons.push('replaces must be a list of ids')
      if (raw.final === false && raw.replaces !== undefined) reasons.push('only a final piece can replace others')
      break
    case 'interviewer_text':
      if (!isStr(raw.id)) reasons.push('id must be a string')
      if (!isStr(raw.text)) reasons.push('text must be a string')
      if (raw.frames !== undefined) {
        const f = raw.frames
        if (!isObject(f) || !isNum(f.from_seq) || !isNum(f.to_seq) || f.to_seq < f.from_seq)
          reasons.push('frames must be a range with from_seq <= to_seq')
      }
      break
    case 'control':
      if (!oneOf(CONTROL_ACTIONS, raw.action)) reasons.push('action must be a control action')
      break
    case 'condition':
      if (!isStr(raw.preset)) reasons.push('preset must be a string')
      if (!isObject(raw.params)) reasons.push('params must be an object')
      if (!isNum(raw.seed)) reasons.push('seed must be a number')
      break
    case 'session':
      if (raw.phase !== 'started' && raw.phase !== 'ended') reasons.push('phase must be started or ended')
      if (raw.config !== undefined) {
        const c = raw.config
        if (!isObject(c) || !oneOf(CUE_MODES, c.cue_mode) || !isStr(c.preset) || !oneOf(INTERFACES, c.interface))
          reasons.push('config needs cue_mode, preset and interface')
      }
      break
    case 'fault':
      if (!isStr(raw.layer)) reasons.push('layer must be a string')
      if (!isStr(raw.effect)) reasons.push('effect must be a string')
      break
  }
}

const KNOWN_TYPES: readonly string[] = [
  'state',
  'audio_frame',
  'speech_activity',
  'turn_decision',
  'transcript',
  'interviewer_text',
  'control',
  'condition',
  'session',
  'fault',
]

/** Never throws. Fields this contract does not name are carried along and not interpreted (EVT-EXT-004). */
export function parseEvent(raw: unknown): ParseOutcome {
  if (!isObject(raw)) return { kind: 'invalid', reasons: ['an event must be an object'] }
  if (!isStr(raw.type) || raw.type === '') return { kind: 'invalid', reasons: ['type must be a non-empty string'] }
  if (!KNOWN_TYPES.includes(raw.type)) return { kind: 'ignored', type: raw.type }

  const reasons: string[] = []
  checkEnvelope(raw, reasons)
  checkPayload(raw.type, raw, reasons)
  if (reasons.length > 0) return { kind: 'invalid', reasons }
  return { kind: 'event', event: raw as unknown as StreamEvent & EventBase }
}
