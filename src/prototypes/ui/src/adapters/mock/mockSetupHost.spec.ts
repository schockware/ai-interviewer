// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { describe, expect, it } from 'vitest'
import type { PrepareInterview, PrepReport } from '../../core/contract/pageFlow.ts'
import { PREP_STEP_TOTAL } from '../../core/setup/waitingRoom.ts'
import { SimulatedClock } from '../simulatedClock.ts'
import { defaultMockConfig, MockSetupHost, MOCK_DELAYS, MOCK_STALL_STEP, type MockHostConfig } from './mockSetupHost.ts'

const run = (config: Partial<MockHostConfig>) => {
  const clock = new SimulatedClock()
  return { clock, host: new MockSetupHost(clock, () => ({ ...defaultMockConfig, ...config })) }
}

/** A cold interview for a sample role that has questions, with the AI writing new ones. */
const REQUEST: PrepareInterview = {
  sessionId: 's1',
  form: {
    ai: { listener: 'default', transcriber: 'default', followUp: 'interviewer', interviewer: 'default', evaluator: 'interviewer', speaker: 'default' },
    interviewType: { type: 'cold' },
    roleFocus: 'role-TEC-02',
    questions: { type: 'generate' },
  },
}

describe('MockSetupHost', () => {
  it('loads the page with saved resumes and roles, or none', async () => {
    const some = run({})
    const p = some.host.loadPage()
    some.clock.advance(MOCK_DELAYS.load)
    expect(await p).toMatchObject({ type: 'ready', resumes: { type: 'ready' }, roles: { type: 'ready' } })

    const none = run({ saved: 'none' })
    const q = none.host.loadPage()
    none.clock.advance(MOCK_DELAYS.load)
    expect(await q).toMatchObject({ type: 'ready', resumes: { type: 'none' }, roles: { type: 'none' } })
  })

  it('answers a failing load with the error state', async () => {
    const { clock, host } = run({ load: 'fails' })
    const p = host.loadPage()
    clock.advance(MOCK_DELAYS.load)
    expect(await p).toMatchObject({ type: 'error' })
  })

  it.each([
    ['succeeds', 'ready', false],
    ['retries-then-succeeds', 'ready', true],
    ['fails', 'diagnosing', true],
  ] as const)('prepares %s: steps count up and it ends %s', (preparation, last, retries) => {
    const { clock, host } = run({ preparation })
    const seen: PrepReport[] = []
    host.prepareInterview(REQUEST, (p) => seen.push(p))
    clock.advance(60_000)
    expect(seen[0]).toEqual({ progress: 'preparing', stepsDone: 0 })
    expect(seen.at(-1)).toEqual({ progress: last, stepsDone: last === 'ready' ? PREP_STEP_TOTAL : MOCK_STALL_STEP })
    for (let i = 1; i < seen.length; i++) expect(seen[i].stepsDone).toBeGreaterThanOrEqual(seen[i - 1].stepsDone)
    expect(seen.some((s) => s.progress === 'retrying')).toBe(retries)
  })

  it('stops reporting once cancelled', () => {
    const { clock, host } = run({})
    const seen: PrepReport[] = []
    host.prepareInterview(REQUEST, (p) => seen.push(p))()
    clock.advance(60_000)
    expect(seen).toEqual([{ progress: 'preparing', stepsDone: 0 }])
  })

  it('offers the sample personas as roles, each with its job description and five core questions, plus one role without questions', async () => {
    const { clock, host } = run({})
    const p = host.loadPage()
    clock.advance(MOCK_DELAYS.load)
    const page = await p
    if (page.type !== 'ready' || page.roles.type !== 'ready') throw new Error('page not ready')
    expect(page.roles.all.length).toBeGreaterThanOrEqual(37)
    expect(page.roles.all).toContainEqual(['role-TEC-02', 'Software Engineer'])

    const engineer = host.loadRole('role-TEC-02')
    clock.advance(MOCK_DELAYS.role)
    const detail = await engineer
    expect(detail.displayName).toBe('Software Engineer')
    expect(detail.description).toContain('# Software Engineer')
    expect(detail.questions.type === 'ready' && detail.questions.all).toHaveLength(5)

    const pm = host.loadRole('role-pm')
    clock.advance(MOCK_DELAYS.role)
    expect((await pm).questions).toEqual({ type: 'none' })
  })

  it('settles the questions at Prepare: generate writes the templates, keep needs saved ones, an upload for another role is refused', async () => {
    const { clock, host } = run({})
    const seen: PrepReport[] = []
    host.prepareInterview({ ...REQUEST, form: { ...REQUEST.form, roleFocus: 'role-pm', questions: { type: 'keep' } } }, (p) => seen.push(p))
    clock.advance(10)
    expect(seen).toEqual([{ progress: 'diagnosing', stepsDone: 0 }])

    host.prepareInterview({ ...REQUEST, form: { ...REQUEST.form, roleFocus: 'role-pm' } }, () => undefined)
    const pm = host.loadRole('role-pm')
    clock.advance(MOCK_DELAYS.role)
    const written = (await pm).questions
    expect(written.type === 'ready' && written.all.map(([, text]) => text)[0]).toBe('What draws you to working as a Product Manager?')

    const pasted = host.pasteQuestions('role-TEC-02', { displayName: 'Mine', text: 'One?\nTwo?' })
    clock.advance(MOCK_DELAYS.upload)
    const set = await pasted
    const wrong: PrepReport[] = []
    host.prepareInterview({ ...REQUEST, form: { ...REQUEST.form, roleFocus: 'role-pm', questions: { type: 'uploaded', questionSetId: set.questionSetId } } }, (p) => wrong.push(p))
    clock.advance(10)
    expect(wrong).toEqual([{ progress: 'diagnosing', stepsDone: 0 }])
  })

  it('rejects a hardware check the harness set to errored', async () => {
    const { clock, host } = run({ audio: 'errored' })
    const p = host.verifyHardware('audio')
    clock.advance(MOCK_DELAYS.verify)
    await expect(p).rejects.toThrow()
  })
})

describe('MockSetupHost transcript', () => {
  it('says its scripted answer as partials, finals that replace them, then the large model’s reading', () => {
    const { clock, host } = run({})
    const seen: string[] = []
    host.watchTranscript('s1', {
      snapshot: (s) => seen.push(`snapshot:${s.segments.length}`),
      segment: (s) => seen.push(`${s.source}:${s.final ? 'final' : 'partial'}:${s.replaces.join(',') || '-'}`),
      failed: (f) => seen.push(`failed:${f.source}`),
      error: (m) => seen.push(`error:${m}`),
    })
    clock.advance(60_000)
    expect(seen).toEqual([
      'snapshot:0',
      'real-time:partial:-',
      'real-time:partial:rt-1',
      'real-time:final:rt-2',
      'real-time:partial:-',
      'real-time:final:rt-4',
      'post-question:final:-',
    ])
  })

  it('reports both passes unavailable when the harness says so, and says nothing once stopped', () => {
    const { clock, host } = run({ transcription: 'unavailable' })
    const failed: string[] = []
    host.watchTranscript('s1', { snapshot: () => undefined, segment: () => undefined, failed: (f) => failed.push(f.source), error: () => undefined })
    clock.advance(60_000)
    expect(failed).toEqual(['real-time', 'post-question'])

    const stopped: string[] = []
    const stop = run({}).host.watchTranscript('s1', { snapshot: () => undefined, segment: (s) => stopped.push(s.id), failed: () => undefined, error: () => undefined })
    stop()
    clock.advance(60_000)
    expect(stopped).toEqual([])
  })
})
