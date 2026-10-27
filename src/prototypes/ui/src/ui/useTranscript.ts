// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useEffect, useState } from 'react'
import type { SetupHost } from '../core/ports.ts'
import { emptyTranscript, withFailure, withSegment, withSnapshot, type TranscriptState } from '../core/media/transcript.ts'

export interface TranscriptView {
  state: TranscriptState
  /** The hub could not be reached: nothing is known about either pass. */
  error: string | null
  watching: boolean
}

/** Follows a session's transcript through the host while `active`; stops, and forgets nothing, when it ends. */
export function useTranscript(host: SetupHost | null, sessionId: string, active: boolean): TranscriptView {
  const [state, setState] = useState<TranscriptState>(emptyTranscript)
  const [error, setError] = useState<string | null>(null)
  const watching = host !== null && active

  useEffect(() => {
    if (!host || !active) return
    const stop = host.watchTranscript(sessionId, {
      snapshot: (s) => setState((current) => withSnapshot(current, s)),
      segment: (s) => setState((current) => withSegment(current, s)),
      failed: (f) => setState((current) => withFailure(current, f)),
      error: (message) => setError(message),
    })
    return () => {
      stop()
      setError(null) // a failure to reach the hub belongs to the watch that saw it
    }
  }, [host, sessionId, active])

  return { state, error, watching }
}
