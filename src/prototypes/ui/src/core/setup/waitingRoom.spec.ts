// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: specs/page-flow.md, section 3, Waiting room (the step list is a proposal). Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import type { ResumeUploadProgress } from '../contract/pageFlow.ts'
import type { TrackedUpload } from './resumeUpload.ts'
import { doneCount, nowText, percentDone, PREP_STEP_TOTAL, roomState, stepList, stepViews } from './waitingRoom.ts'

const upload = (status: ResumeUploadProgress['status'] | null, error: string | null = null): TrackedUpload => ({
  resumeId: 'r1',
  displayName: 'CV',
  progress: status ? { resumeId: 'r1', displayName: 'CV', status, steps: [] } : null,
  error,
})

describe('the waiting room steps', () => {
  it('lists the resume steps only for a hot interview, and names the role step by where the role came from', () => {
    const cold = stepList({ hot: false, roleSource: 'saved' })
    expect(cold.map((s) => s.label)).toEqual([
      'Looking up the role',
      'Preparing your role review',
      'Planning the questions',
      'Writing the opening script',
      'Preparing the follow-up questions',
      'Preparing the scoring guide',
      'Writing the closing script',
      'Warming up the interviewer’s voice',
      'Connecting to the interview room',
    ])
    const hot = stepList({ hot: true, roleSource: 'uploaded' })
    expect(hot.slice(0, 4).map((s) => s.label)).toEqual(['Uploading your resume', 'Reading your resume', 'Uploading your job description', 'Reading the role and job description'])
  })

  it('has as many host-reported steps as the host counts to', () => {
    expect(stepList({ hot: true, roleSource: 'uploaded' }).filter((s) => s.source === 'prep')).toHaveLength(PREP_STEP_TOTAL)
    expect(stepList({ hot: false, roleSource: 'saved' }).filter((s) => s.source === 'prep')).toHaveLength(PREP_STEP_TOTAL)
  })

  it('marks host steps done up to the count, the current one in progress, and the rest waiting', () => {
    const views = stepViews(stepList({ hot: false, roleSource: 'saved' }), { report: { progress: 'preparing', stepsDone: 3 }, resumeUpload: null })
    expect(views.map((v) => v.status)).toEqual(['done', 'done', 'done', 'running', 'pending', 'pending', 'pending', 'pending', 'pending'])
    expect(nowText(views)).toBe('Writing the opening script')
    expect(doneCount(views)).toBe(3)
    expect(percentDone(views)).toBe(33)
    expect(roomState(views)).toBe('waiting')
  })

  it('shows the current step as slow while retrying and as failed while diagnosing', () => {
    const steps = stepList({ hot: false, roleSource: 'saved' })
    expect(stepViews(steps, { report: { progress: 'retrying', stepsDone: 4 }, resumeUpload: null })[4].status).toBe('slow')
    const failing = stepViews(steps, { report: { progress: 'diagnosing', stepsDone: 4 }, resumeUpload: null })
    expect(failing[4].status).toBe('failed')
    expect(roomState(failing)).toBe('blocked')
  })

  it('is ready only when every step is done, including reading the resume', () => {
    const steps = stepList({ hot: true, roleSource: 'saved' })
    const stillReading = stepViews(steps, { report: { progress: 'ready', stepsDone: PREP_STEP_TOTAL }, resumeUpload: upload('running') })
    expect(stillReading.find((v) => v.id === 'read-resume')?.status).toBe('running')
    expect(roomState(stillReading)).toBe('waiting')
    expect(nowText(stillReading)).toBe('Reading your resume')

    const read = stepViews(steps, { report: { progress: 'ready', stepsDone: PREP_STEP_TOTAL }, resumeUpload: upload('done') })
    expect(roomState(read)).toBe('ready')
    expect(percentDone(read)).toBe(100)
    expect(nowText(read)).toBe('Your interview is ready')
  })

  it('blocks on a resume that failed to process or was never reported, and treats a saved resume as read earlier', () => {
    const steps = stepList({ hot: true, roleSource: 'saved' })
    const ready = { progress: 'ready' as const, stepsDone: PREP_STEP_TOTAL }
    expect(roomState(stepViews(steps, { report: ready, resumeUpload: upload('failed') }))).toBe('blocked')
    expect(roomState(stepViews(steps, { report: ready, resumeUpload: upload(null, 'Could not reach the API.') }))).toBe('blocked')
    expect(stepViews(steps, { report: ready, resumeUpload: null }).find((v) => v.id === 'read-resume')?.status).toBe('done')
  })

  it('shows every host step waiting before the first report', () => {
    const views = stepViews(stepList({ hot: false, roleSource: 'saved' }), { report: null, resumeUpload: null })
    expect(views.every((v) => v.status === 'pending')).toBe(true)
    expect(percentDone(views)).toBe(0)
  })
})
