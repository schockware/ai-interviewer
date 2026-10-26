// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { ResumeUploadProgress, UploadStepStatus } from '../contract/pageFlow.ts'
import type { Tone } from './hardware.ts'

/** One tracked resume as the page holds it: what the server last said, or why it could not say. */
export interface TrackedUpload {
  resumeId: string
  displayName: string
  progress: ResumeUploadProgress | null
  error: string | null
}

export interface UploadView {
  chip: string
  tone: Tone
  summary: string
}

export const STEP_LABEL: Record<UploadStepStatus, string> = { pending: 'waiting', running: 'in progress', done: 'done', failed: 'failed' }
export const STEP_TONE: Record<UploadStepStatus, Tone> = { pending: 'neutral', running: 'warn', done: 'ok', failed: 'bad' }

/** Words for one resume's processing, from the latest whole snapshot. */
export function uploadView(upload: TrackedUpload): UploadView {
  if (upload.error) return { chip: 'Not reported', tone: 'bad', summary: upload.error }
  if (!upload.progress) return { chip: 'Connecting', tone: 'neutral', summary: 'Waiting for the first report from the server.' }
  const { status, steps } = upload.progress
  const done = steps.filter((s) => s.status === 'done').length
  if (status === 'done') return { chip: 'Processed', tone: 'ok', summary: `All ${steps.length} steps finished. The interviewer can use ${upload.displayName}.` }
  if (status === 'failed') {
    const failed = steps.find((s) => s.status === 'failed')
    return {
      chip: 'Failed',
      tone: 'bad',
      summary: `Processing stopped at “${failed?.name ?? 'an unknown step'}”. Load the resume again, or run a cold interview.`,
    }
  }
  const current = steps.find((s) => s.status === 'running')
  return {
    chip: 'Processing',
    tone: 'warn',
    summary: current ? `Step ${done + 1} of ${steps.length}: ${current.name}.` : `${done} of ${steps.length} steps done.`,
  }
}
