// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { TranscriptFailure, TranscriptSegment, TranscriptSnapshot, TranscriptSource } from '../contract/pageFlow.ts'

// What the page holds of the two transcription passes, and how pieces replace each other
// (specs/transcription STT-STR-002: a final names the partials it replaces). Pure.

/** Until the question generator exists, the interview has this one question (Steven, 2026-10-27). */
export const PLACEHOLDER_QUESTION_ID = 'q1'

export interface TranscriptState {
  segments: TranscriptSegment[]
  failures: TranscriptFailure[]
}

export const emptyTranscript: TranscriptState = { segments: [], failures: [] }

const byTime = (a: TranscriptSegment, b: TranscriptSegment) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds || a.id.localeCompare(b.id)

/** Adds one piece: whatever it replaces goes, a piece with the same id is updated, and the rest stays in time order. */
export function withSegment(state: TranscriptState, incoming: TranscriptSegment): TranscriptState {
  const gone = new Set(incoming.replaces)
  const kept = state.segments.filter((s) => !(s.source === incoming.source && (gone.has(s.id) || s.id === incoming.id)))
  return { ...state, segments: [...kept, incoming].sort(byTime) }
}

export function withFailure(state: TranscriptState, failure: TranscriptFailure): TranscriptState {
  return { ...state, failures: [...state.failures, failure] }
}

/** A late watcher's starting point: the snapshot folded in order, so replaces apply. */
export function withSnapshot(state: TranscriptState, snapshot: TranscriptSnapshot): TranscriptState {
  let next = state
  for (const s of snapshot.segments) next = withSegment(next, s)
  for (const f of snapshot.failures) next = withFailure(next, f)
  return next
}

export const linesOf = (state: TranscriptState, source: TranscriptSource): TranscriptSegment[] => state.segments.filter((s) => s.source === source && s.text.trim() !== '')

export const failuresOf = (state: TranscriptState, source: TranscriptSource): TranscriptFailure[] => state.failures.filter((f) => f.source === source)

/** The model and device a pass used, from its latest piece, for the footnote. */
export function producerOf(state: TranscriptState, source: TranscriptSource): string | null {
  const last = state.segments.filter((s) => s.source === source).at(-1)
  return last ? `${last.model} on ${last.device}` : null
}
