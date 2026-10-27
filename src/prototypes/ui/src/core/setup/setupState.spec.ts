// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: contracts/page-flow.md, "Application setup"; specs/page-flow.md, sections 1 and 2 (Role set up). Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import type { RoleDetail } from '../contract/pageFlow.ts'
import {
  initialSetup,
  interviewTypeOf,
  materialsOf,
  panelOpen,
  questionPlan,
  questionsNote,
  questionsSummary,
  roleBlockers,
  roleCase,
  roleValidation,
  setupBlockers,
  setupReducer,
  showSetupButton,
  toForm,
  type SetupAction,
  type SetupState,
} from './setupState.ts'
import { defaultAi } from './slots.ts'

const ready = (resumes: 'some' | 'none', roles: 'some' | 'none'): SetupState =>
  initialSetup({
    type: 'ready',
    form: { ai: defaultAi(), interviewType: { type: 'cold' }, roleFocus: 'unanswered', questions: { type: 'generate' } },
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

const apply = (s: SetupState, ...actions: SetupAction[]): SetupState => actions.reduce(setupReducer, s)

const detail = (roleId: string, questions: string[] = []): RoleDetail => ({
  roleId,
  displayName: 'Engineer',
  description: 'Build things.',
  questions: questions.length === 0 ? { type: 'none' } : { type: 'ready', all: questions.map((q, i) => [`q${i + 1}`, q] as const) },
})

describe('interview type (ResumeValidation)', () => {
  it('is cold when cold is wanted, whatever resumes exist', () => {
    expect(interviewTypeOf(ready('some', 'some'))).toEqual({ type: 'cold' })
  })
  it('is hot with the newest saved resume selected once hot is wanted', () => {
    const s = setupReducer(ready('some', 'some'), { type: 'wants', wants: 'hot' })
    expect(interviewTypeOf(s)).toEqual({ type: 'hot', resumeId: 'r2' })
  })
  it('stays hot-incomplete=>cold with no resume, and while one is sent', () => {
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

describe('what blocks Role set up on Application setup', () => {
  it('is only a hot interview with no resume at all; a resume that is uploading counts', () => {
    expect(setupBlockers(ready('some', 'some'))).toEqual([])
    let s = setupReducer(ready('none', 'some'), { type: 'wants', wants: 'hot' })
    expect(setupBlockers(s)).toEqual(['Pick or load a resume, or switch to a cold interview.'])
    s = setupReducer(s, { type: 'resumeProcessing', fileName: 'cv.pdf' })
    expect(setupBlockers(s)).toEqual([])
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

describe('the role being looked up', () => {
  it('starts loading when a role is picked or added, and keeps only the answer for the current role', () => {
    let s = setupReducer(ready('some', 'some'), { type: 'pickRole', roleId: 'x' })
    expect(s.roleDetail).toEqual({ type: 'loading', roleId: 'x' })
    expect(roleCase(s)).toBeNull()
    s = setupReducer(s, { type: 'roleLoaded', detail: detail('someone-else') })
    expect(s.roleDetail.type).toBe('loading')
    s = setupReducer(s, { type: 'roleLoaded', detail: detail('x') })
    expect(roleCase(s)).toBe('existing-missing')
  })
  it('tells a new role from an existing one with or without questions', () => {
    const added = apply(ready('some', 'none'), { type: 'jdProcessed', processed: { roleId: 'n', displayName: 'Role' } }, { type: 'roleLoaded', detail: detail('n') })
    expect(roleCase(added)).toBe('new')
    expect(showSetupButton(added)).toBe(false)
    expect(panelOpen(added)).toBe(true)
    const has = apply(ready('some', 'some'), { type: 'pickRole', roleId: 'x' }, { type: 'roleLoaded', detail: detail('x', ['A?', 'B?']) })
    expect(roleCase(has)).toBe('existing-has')
    expect(showSetupButton(has)).toBe(true)
    expect(panelOpen(has)).toBe(false)
    expect(panelOpen(setupReducer(has, { type: 'toggleQuestions' }))).toBe(true)
  })
  it('can fail, and be asked again', () => {
    let s = apply(ready('some', 'some'), { type: 'pickRole', roleId: 'x' }, { type: 'roleFailed', roleId: 'x', message: 'offline' })
    expect(roleBlockers(s)).toEqual(["We could not check this role's questions. offline"])
    s = setupReducer(s, { type: 'roleRetry' })
    expect(s.roleDetail).toEqual({ type: 'loading', roleId: 'x' })
  })
})

describe('what blocks Prepare interview on Role set up', () => {
  it('needs a role, then waits for the check, and nothing else for a cold interview', () => {
    expect(roleBlockers(ready('some', 'some'))).toEqual(['Choose a role focus.'])
    let s = setupReducer(ready('some', 'some'), { type: 'pickRole', roleId: 'x' })
    expect(roleBlockers(s)).toEqual(['Wait while we check whether this role has questions.'])
    s = setupReducer(s, { type: 'roleLoaded', detail: detail('x') })
    expect(roleBlockers(s)).toEqual([])
  })
  it('names the missing job description when no roles are saved', () => {
    expect(roleBlockers(ready('none', 'none'))).toEqual(['Add a job description. No roles are saved yet.'])
  })
  it('never blocks on a resume: uploads lead to the waiting room instead', () => {
    const s = apply(ready('none', 'some'), { type: 'wants', wants: 'hot' }, { type: 'pickRole', roleId: 'x' }, { type: 'roleLoaded', detail: detail('x') })
    expect(roleBlockers(s)).toEqual([])
    expect(toForm(s).interviewType).toEqual({ type: 'hot-incomplete=>cold' })
  })
  it('blocks only the upload choice with no file, until a file is loaded or the AI is chosen again', () => {
    const base = apply(ready('some', 'some'), { type: 'pickRole', roleId: 'x' }, { type: 'roleLoaded', detail: detail('x') }, { type: 'toggleQuestions' }, { type: 'source', source: 'upload' })
    expect(roleBlockers(base)).toEqual(['Choose your questions file, or let the AI write them.'])
    expect(roleBlockers(setupReducer(base, { type: 'questionsProcessing', fileName: 'q.txt' }))).toEqual(['Choose your questions file, or let the AI write them.'])
    expect(roleBlockers(setupReducer(base, { type: 'questionsProcessed', processed: { questionSetId: 'qs1', displayName: 'q', count: 3 } }))).toEqual([])
    expect(roleBlockers(setupReducer(base, { type: 'source', source: 'generate' }))).toEqual([])
  })
})

describe('the question plan the server receives', () => {
  const has = apply(ready('some', 'some'), { type: 'pickRole', roleId: 'x' }, { type: 'roleLoaded', detail: detail('x', ['A?', 'B?', 'C?']) })
  const missing = apply(ready('some', 'some'), { type: 'pickRole', roleId: 'x' }, { type: 'roleLoaded', detail: detail('x') })

  it('keeps saved questions by default, and says so beside the button and in the summary', () => {
    expect(questionPlan(has)).toEqual({ type: 'keep' })
    expect(questionsNote(has)).toEqual({ lead: 'Already loaded.', note: '3 questions are saved for Engineer. They are kept unless you change them.' })
    expect(questionsSummary(has)).toBe('3 saved questions, kept')
    expect(materialsOf(has).questions).toBe('kept')
  })
  it('purging turns the plan into generate, with the warning words', () => {
    const purged = apply(has, { type: 'toggleQuestions' }, { type: 'existing', existing: 'purge' })
    expect(questionPlan(purged)).toEqual({ type: 'generate' })
    expect(questionsNote(purged).lead).toBe('Purge chosen.')
    expect(materialsOf(purged).questions).toBe('generate')
  })
  it('defaults to the AI for a role without questions, and sends the uploaded set once a file is loaded', () => {
    expect(questionPlan(missing)).toEqual({ type: 'generate' })
    expect(questionsNote(missing)).toEqual({ lead: 'Default.', note: 'The AI will write the questions.' })
    expect(questionsSummary(missing)).toBe('The AI writes them (default)')
    const uploaded = apply(missing, { type: 'toggleQuestions' }, { type: 'source', source: 'upload' }, { type: 'questionsProcessed', processed: { questionSetId: 'qs1', displayName: 'My list', count: 4 } })
    expect(questionPlan(uploaded)).toEqual({ type: 'uploaded', questionSetId: 'qs1' })
    expect(questionsNote(uploaded)).toEqual({ lead: 'Your own questions.', note: 'My list' })
    expect(questionsSummary(uploaded)).toBe('My list')
    expect(materialsOf(uploaded).questions).toBe('uploaded')
    expect(toForm(uploaded)).toMatchObject({ roleFocus: 'x', questions: { type: 'uploaded', questionSetId: 'qs1' } })
  })
  it('starts over when another role is picked', () => {
    const uploaded = apply(missing, { type: 'toggleQuestions' }, { type: 'source', source: 'upload' }, { type: 'questionsProcessed', processed: { questionSetId: 'qs1', displayName: 'My list', count: 4 } })
    const other = setupReducer(uploaded, { type: 'pickRole', roleId: 'y' })
    expect(other.source).toBe('generate')
    expect(other.questionUpload).toEqual({ type: 'none' })
    expect(other.questionsOpen).toBe(false)
    expect(other.roleDetail).toEqual({ type: 'loading', roleId: 'y' })
  })
  it('sends the role id, never "unanswered", once nothing blocks', () => {
    expect(toForm(missing).roleFocus).toBe('x')
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
    expect(materialsOf(setupReducer(s, { type: 'roleLoaded', detail: detail('9a-guid') })).roleSource).toBe('uploaded')
    s = setupReducer(s, { type: 'pickRole', roleId: 'x' })
    expect(s.addedRoleId).toBeNull()
  })
})
