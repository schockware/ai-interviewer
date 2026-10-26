// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { InterviewType, PrepProgress, RoleId } from '../contract/pageFlow.ts'
import { audioPasses, type CheckPhase, type Tone } from './hardware.ts'
import { uploadView, type TrackedUpload } from './resumeUpload.ts'

/**
 * The pre-flight check behind Start interview (Steven, 2026-10-26): the Hardware page is never
 * blocked by the resume or role uploads, but the interview must not start until they are
 * complete and every other requirement holds. Start opens a short interstitial that lists these
 * checks, waits on the ones still in flight, and goes on by itself once all are ok.
 */
export type PreflightState = { type: 'ok' | 'waiting' | 'blocked'; detail: string }

export interface PreflightItem {
  name: string
  state: PreflightState
}

export interface PreflightInput {
  prep: PrepProgress
  audio: CheckPhase
  interviewType: InterviewType
  roleFocus: 'unanswered' | RoleId
  /** The hot interview's resume as this session tracks it; null when it was not loaded this session. */
  resumeUpload: TrackedUpload | null
}

export const PREFLIGHT_TONE: Record<PreflightState['type'], Tone> = { ok: 'ok', waiting: 'warn', blocked: 'bad' }

export function preflight(input: PreflightInput): PreflightItem[] {
  return [
    { name: 'Interview prepared', state: prepared(input.prep) },
    { name: 'Resume', state: resume(input.interviewType, input.resumeUpload) },
    { name: 'Role', state: input.roleFocus === 'unanswered' ? { type: 'blocked', detail: 'no role chosen' } : { type: 'ok', detail: 'chosen' } },
    { name: 'Audio', state: audio(input.audio) },
  ]
}

/** How long the pre-flight dialog stays up at the least, so an instant pass is still seen. PROPOSAL. */
export const PREFLIGHT_HOLD_MS = 700

export type PreflightOutcome = 'ready' | 'waiting' | 'blocked'

export const preflightOutcome = (items: PreflightItem[]): PreflightOutcome =>
  items.some((i) => i.state.type === 'blocked') ? 'blocked' : items.some((i) => i.state.type === 'waiting') ? 'waiting' : 'ready'

const prepared = (prep: PrepProgress): PreflightState => {
  switch (prep) {
    case 'ready':
      return { type: 'ok', detail: 'ready' }
    case 'diagnosing':
      return { type: 'blocked', detail: 'preparation failed; the diagnosis is on this page' }
    case 'retrying':
      return { type: 'waiting', detail: 'still preparing, retrying' }
    case 'preparing':
      return { type: 'waiting', detail: 'still preparing' }
  }
}

const resume = (interviewType: InterviewType, upload: TrackedUpload | null): PreflightState => {
  if (interviewType.type === 'cold') return { type: 'ok', detail: 'not used in a cold interview' }
  if (interviewType.type === 'hot-incomplete=>cold') return { type: 'ok', detail: 'not used; the interview runs cold' }
  // A resume picked from the saved list was processed in an earlier session. PROPOSAL: the server
  // should confirm this at start; today only this session's uploads are checked.
  if (!upload) return { type: 'ok', detail: 'processed earlier' }
  if (upload.error) return { type: 'blocked', detail: `processing was not reported: ${upload.error}` }
  if (!upload.progress) return { type: 'waiting', detail: 'waiting for the first processing report' }
  const view = uploadView(upload)
  switch (upload.progress.status) {
    case 'done':
      return { type: 'ok', detail: 'processed' }
    case 'failed':
      return { type: 'blocked', detail: view.summary }
    case 'running':
      return { type: 'waiting', detail: `still processing. ${view.summary}` }
  }
}

const audio = (phase: CheckPhase): PreflightState => {
  if (audioPasses(phase)) return { type: 'ok', detail: 'verified' }
  if (phase.type === 'checking') return { type: 'waiting', detail: 'check in progress' }
  if (phase.type === 'errored') return { type: 'blocked', detail: 'the device could not be reached' }
  if (phase.type === 'done') return { type: 'blocked', detail: 'rated unreadable' }
  return { type: 'blocked', detail: 'not verified yet' }
}
