// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: the resume processing card on the Hardware page (PROPOSAL; the contract has no shape for it). Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import type { ResumeUploadProgress } from '../contract/pageFlow.ts'
import { uploadView } from './resumeUpload.ts'

const progress = (status: ResumeUploadProgress['status'], steps: ResumeUploadProgress['steps']): ResumeUploadProgress => ({
  resumeId: 'r1',
  displayName: 'My CV',
  status,
  steps,
})
const tracked = (p: ResumeUploadProgress | null, error: string | null = null) => ({ resumeId: 'r1', displayName: 'My CV', progress: p, error })

describe('the words for a resume being processed', () => {
  it('says it is connecting until the first snapshot arrives', () => {
    expect(uploadView(tracked(null))).toMatchObject({ chip: 'Connecting', tone: 'neutral' })
  })

  it('names the running step and its place in the list', () => {
    const view = uploadView(
      tracked(
        progress('running', [
          { name: 'Reading', status: 'done' },
          { name: 'Finding sections', status: 'running' },
          { name: 'Indexing', status: 'pending' },
        ]),
      ),
    )
    expect(view).toMatchObject({ chip: 'Processing', tone: 'warn', summary: 'Step 2 of 3: Finding sections.' })
  })

  it('counts finished steps when none is running yet', () => {
    const view = uploadView(tracked(progress('running', [{ name: 'Reading', status: 'done' }, { name: 'Indexing', status: 'pending' }])))
    expect(view.summary).toBe('1 of 2 steps done.')
  })

  it('reports done with the resume name', () => {
    const view = uploadView(tracked(progress('done', [{ name: 'Reading', status: 'done' }])))
    expect(view).toMatchObject({ chip: 'Processed', tone: 'ok' })
    expect(view.summary).toContain('My CV')
  })

  it('names the step that failed and what to do', () => {
    const view = uploadView(tracked(progress('failed', [{ name: 'Reading', status: 'done' }, { name: 'Matching dates', status: 'failed' }])))
    expect(view).toMatchObject({ chip: 'Failed', tone: 'bad' })
    expect(view.summary).toContain('Matching dates')
  })

  it('shows the error in the server’s words when there is no report', () => {
    expect(uploadView(tracked(null, 'Could not reach the API.'))).toMatchObject({ chip: 'Not reported', tone: 'bad', summary: 'Could not reach the API.' })
  })
})
