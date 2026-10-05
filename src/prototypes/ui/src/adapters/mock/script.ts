import type { AudioStream, StreamEvent } from '../../core/contract/index.ts'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * An event as a script author writes it. The mock plays the part of the authority
 * (EVT-CORE-004), so the script carries no session identifier or position.
 */
export type ScriptEvent = DistributiveOmit<StreamEvent, 'session_id' | 'position'>

/** Shorthand for a run of equal audio frames, so a script need not list 50 events a second. */
export interface AudioRun {
  type: 'audio_run'
  stream: AudioStream
  /** True time of the first frame. */
  start_ms: number
  /** Sequence number of the first frame. */
  seq_from: number
  count: number
  dur_ms: number
}

export interface MockScript {
  name: string
  description: string
  /** Requirement or vector IDs this script exists to exercise, for the report. */
  covers: string[]
  session_id: string
  events: (ScriptEvent | AudioRun)[]
}
