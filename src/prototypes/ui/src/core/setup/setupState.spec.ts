// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Spec: contracts/page-flow.md, "Application setup". Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { blockers, initialSetup, interviewTypeOf, roleValidation, setupReducer, toForm, type SetupState } from './setupState.ts'
import { defaultAi } from './slots.ts'

const ready = (resumes: 'some' | 'none', roles: 'some' | 'none'): SetupState =>
  initialSetup({
    type: 'ready',
    form: { ai: defaultAi(), interviewType: { type: 'cold' }, roleFocus: 'unanswered' },
    resumes:
      resumes === 'some'
        ? {
            type: 'ready',
            all: [
              ['r2', 'New'],
              ['r1', 'Old'],
            ],
          }
        : { type: 'none' },
    roles: roles === 'some' ? { type: 'ready', all: [['x', 'Engineer']] } : { type: 'none' },
  })

describe('interview type (ResumeValidation)', () => {
  it('is cold when cold is wanted, whatever resumes exist', () => {
    expect(interviewTypeOf(ready('some', 'some'))).toEqual({ type: 'cold' })
  })
  it('is hot with the newest saved resume selected once hot is wanted', () => {
    const s = setupReducer(ready('some', 'some'), { type: 'wants', wants: 'hot' })
    expect(interviewTypeOf(s)).toEqual({ type: 'hot', resumeId: 'r2' })
  })
  it('stays hot-incomplete=>cold with no resume, and while one is processing', () => {
    let s = setupReducer(ready('none', 'some'), { type: 'wants', wants: 'hot' })
    expect(interviewTypeOf(s)).toEqual({ type: 'hot-incomplete=>cold' })
    s = setupReducer(s, { type: 'resumeProcessing', fileName: 'cv.pdf' })
    expect(interviewTypeOf(s)).toEqual({ type: 'hot-incomplete=>cold' })
  })
  it('becomes hot, with the new resume selected, when the upload returns ResumeProcessed', () => {
    let s = setupReducer(ready('none', 'some'), { type: 'wants', wants: 'hot' })
    s = setupReducer(s, { type: 'resumeProcessing', fileName: 'cv.pdf' })
    s = setupReducer(s, { type: 'resumeProcessed', processed: { resumeId: 'new', displayName: 'cv' } })
    expect(interviewTypeOf(s)).toEqual({ type: 'hot', resumeId: 'new' })
  })
})

describe('role focus (JobDescriptionValidation)', () => {
  it('is unanswered when roles exist and none is chosen', () => {
    expect(roleValidation(ready('some', 'some'))).toEqual({ type: 'unanswered' })
  })
  it('is required only when the server had no roles', () => {
    expect(roleValidation(ready('some', 'none'))).toEqual({ type: 'required' })
  })
  it('is loading while a job description processes, then ready with its role selected', () => {
    let s = setupReducer(ready('some', 'none'), { type: 'jdProcessing' })
    expect(roleValidation(s)).toEqual({ type: 'loading' })
    s = setupReducer(s, { type: 'jdProcessed', processed: { roleId: 'n', displayName: 'Role' } })
    expect(roleValidation(s)).toEqual({ type: 'ready', roleId: 'n' })
  })
})

describe('what blocks Prepare interview', () => {
  it('needs only a role focus for a cold interview', () => {
    expect(blockers(ready('some', 'some'))).toEqual(['Choose a role focus.'])
    const s = setupReducer(ready('some', 'some'), { type: 'pickRole', roleId: 'x' })
    expect(blockers(s)).toEqual([])
  })
  it('names the missing job description when no roles are saved', () => {
    expect(blockers(ready('none', 'none'))).toEqual(['Add a job description. No roles are saved yet.'])
  })
  it('names the resume for a hot interview, and the wait while one processes', () => {
    let s = setupReducer(ready('none', 'some'), { type: 'pickRole', roleId: 'x' })
    s = setupReducer(s, { type: 'wants', wants: 'hot' })
    expect(blockers(s)).toEqual(['Pick or load a resume, or switch to a cold interview.'])
    s = setupReducer(s, { type: 'resumeProcessing', fileName: 'cv.pdf' })
    expect(blockers(s)).toEqual(['Wait for your resume to finish processing.'])
  })
  it('sends the role id, never "unanswered", once nothing blocks', () => {
    const s = setupReducer(ready('some', 'some'), { type: 'pickRole', roleId: 'x' })
    expect(toForm(s).roleFocus).toBe('x')
  })
})

describe('what the session just added', () => {
  // Found by running against the real API: the page once keyed this off the mock's id format.
  it('remembers the loaded resume and added role whatever their ids look like, until another is picked', () => {
    let s = setupReducer(ready('some', 'some'), { type: 'resumeProcessed', processed: { resumeId: '3f2c-guid', displayName: 'cv' } })
    expect(s.loadedResumeId).toBe('3f2c-guid')
    s = setupReducer(s, { type: 'pickResume', resumeId: 'r1' })
    expect(s.loadedResumeId).toBeNull()

    s = setupReducer(s, { type: 'jdProcessed', processed: { roleId: '9a-guid', displayName: 'Role' } })
    expect(s.addedRoleId).toBe('9a-guid')
    s = setupReducer(s, { type: 'pickRole', roleId: 'x' })
    expect(s.addedRoleId).toBeNull()
  })
})
