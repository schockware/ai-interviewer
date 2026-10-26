// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: the pre-flight check behind Start interview (Steven, 2026-10-26: uploads never block the Hardware page, but the interview
// must not start until they are complete). Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import type { ResumeUploadProgress } from '../contract/pageFlow.ts'
import type { TrackedUpload } from './resumeUpload.ts'
import { preflight, preflightOutcome, type PreflightInput } from './preflight.ts'

const upload = (progress: ResumeUploadProgress | null, error: string | null = null): TrackedUpload => ({ resumeId: 'r1', displayName: 'CV', progress, error })
const snapshot = (status: ResumeUploadProgress['status'], steps: ResumeUploadProgress['steps']): ResumeUploadProgress => ({ resumeId: 'r1', displayName: 'CV', status, steps })

const base: PreflightInput = {
  prep: 'ready',
  audio: { type: 'done', quality: 'clear' },
  interviewType: { type: 'cold' },
  roleFocus: 'role-1',
  resumeUpload: null,
}
const stateOf = (input: PreflightInput, name: string) => preflight(input).find((i) => i.name === name)?.state

describe('the pre-flight check', () => {
  it('is ready for a cold interview that is prepared, with a role and verified audio', () => {
    expect(preflightOutcome(preflight(base))).toBe('ready')
    expect(stateOf(base, 'Resume')).toEqual({ type: 'ok', detail: 'not used in a cold interview' })
  })

  it('waits while a hot interview’s resume is still processing, naming the step', () => {
    const input: PreflightInput = {
      ...base,
      interviewType: { type: 'hot', resumeId: 'r1' },
      resumeUpload: upload(snapshot('running', [{ name: 'Reading', status: 'done' }, { name: 'Indexing', status: 'running' }])),
    }
    expect(stateOf(input, 'Resume')).toMatchObject({ type: 'waiting' })
    expect(stateOf(input, 'Resume')?.detail).toContain('Indexing')
    expect(preflightOutcome(preflight(input))).toBe('waiting')
  })

  it('waits before the first processing report', () => {
    const input: PreflightInput = { ...base, interviewType: { type: 'hot', resumeId: 'r1' }, resumeUpload: upload(null) }
    expect(stateOf(input, 'Resume')).toMatchObject({ type: 'waiting' })
  })

  it('is ready once the resume is processed', () => {
    const input: PreflightInput = { ...base, interviewType: { type: 'hot', resumeId: 'r1' }, resumeUpload: upload(snapshot('done', [{ name: 'Reading', status: 'done' }])) }
    expect(stateOf(input, 'Resume')).toEqual({ type: 'ok', detail: 'processed' })
    expect(preflightOutcome(preflight(input))).toBe('ready')
  })

  it('blocks when the resume failed to process, or its processing was never reported', () => {
    const failed: PreflightInput = {
      ...base,
      interviewType: { type: 'hot', resumeId: 'r1' },
      resumeUpload: upload(snapshot('failed', [{ name: 'Matching dates', status: 'failed' }])),
    }
    expect(stateOf(failed, 'Resume')).toMatchObject({ type: 'blocked' })
    expect(stateOf(failed, 'Resume')?.detail).toContain('Matching dates')
    expect(preflightOutcome(preflight(failed))).toBe('blocked')

    const unreported: PreflightInput = { ...failed, resumeUpload: upload(null, 'Could not reach the API.') }
    expect(stateOf(unreported, 'Resume')).toMatchObject({ type: 'blocked', detail: expect.stringContaining('Could not reach the API.') })
  })

  it('treats a saved resume that was not loaded this session as processed earlier', () => {
    const input: PreflightInput = { ...base, interviewType: { type: 'hot', resumeId: 'res-1' }, resumeUpload: null }
    expect(stateOf(input, 'Resume')).toEqual({ type: 'ok', detail: 'processed earlier' })
  })

  it('waits on preparation and blocks when it failed', () => {
    expect(stateOf({ ...base, prep: 'preparing' }, 'Interview prepared')).toMatchObject({ type: 'waiting' })
    expect(stateOf({ ...base, prep: 'retrying' }, 'Interview prepared')).toMatchObject({ type: 'waiting' })
    expect(stateOf({ ...base, prep: 'diagnosing' }, 'Interview prepared')).toMatchObject({ type: 'blocked' })
  })

  it('blocks without a role or without verified audio, and a block outranks a wait', () => {
    expect(stateOf({ ...base, roleFocus: 'unanswered' }, 'Role')).toMatchObject({ type: 'blocked' })
    expect(stateOf({ ...base, audio: { type: 'pending' } }, 'Audio')).toMatchObject({ type: 'blocked', detail: 'not verified yet' })
    expect(stateOf({ ...base, audio: { type: 'done', quality: 'unreadable' } }, 'Audio')).toMatchObject({ type: 'blocked' })
    expect(stateOf({ ...base, audio: { type: 'checking' } }, 'Audio')).toMatchObject({ type: 'waiting' })
    expect(preflightOutcome(preflight({ ...base, prep: 'preparing', roleFocus: 'unanswered' }))).toBe('blocked')
  })
})
