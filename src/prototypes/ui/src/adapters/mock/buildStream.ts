import { FORMAT_VERSION, parseEvent, type StreamEvent, type StreamHeader } from '../../core/contract/index.ts'
import type { AudioRun, MockScript, ScriptEvent } from './script.ts'

export interface BuiltStream {
  header: StreamHeader
  events: StreamEvent[]
}

function expand(item: ScriptEvent | AudioRun): ScriptEvent[] {
  if (item.type !== 'audio_run') return [item]
  return Array.from({ length: item.count }, (_, i) => ({
    type: 'audio_frame' as const,
    t_true_ms: item.start_ms + i * item.dur_ms,
    stream: item.stream,
    seq: item.seq_from + i,
    dur_ms: item.dur_ms,
  }))
}

/**
 * Acts as the authority: orders the script's events by true time (ties keep script order),
 * then assigns positions from 0 and the session identifier (EVT-CORE-004, EVT-TIME-002).
 * Every event is checked with the same parser a real consumer uses, and a script that
 * breaks the contract throws, so a bad script is caught when it is loaded.
 */
export function buildStream(script: MockScript): BuiltStream {
  const ordered = script.events
    .flatMap(expand)
    .map((e, index) => ({ e, index }))
    .sort((a, b) => a.e.t_true_ms - b.e.t_true_ms || a.index - b.index)
    .map(({ e }) => e)

  const events = ordered.map((e, position) => {
    const outcome = parseEvent({ ...e, session_id: script.session_id, position })
    if (outcome.kind !== 'event') {
      const why = outcome.kind === 'invalid' ? outcome.reasons.join('; ') : `unknown type ${outcome.type}`
      throw new Error(`Script "${script.name}", event ${position} (${e.type}): ${why}`)
    }
    return outcome.event
  })

  return { header: { format_version: FORMAT_VERSION, session_id: script.session_id }, events }
}
