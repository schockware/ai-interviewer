// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// One behavior suite for every SetupHost. The mock runs it in `npm test`; the real API runs it in
// `npm run test:integration`. If the mock passes and the real one fails, the mock is lying
// (docs/decisions/0004). Not a spec file itself: callers register it.
import { describe, expect, it } from 'vitest'
import type { ApplicationSetupForm, PrepReport, ResumeUploadProgress } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'

export interface HostRig {
  host: SetupHost
  /** Lets a call finish. The mock advances its clock; the real host is already on its way. */
  run<T>(pending: Promise<T>): Promise<T>
  /** Waits until `done` holds: the mock advances its clock, the real host is polled for a few seconds. */
  until(done: () => boolean): Promise<void>
}

const textFile = (text: string) => new TextEncoder().encode(text)

/** A cold interview with every default, for a role each test adds. */
const FORM: ApplicationSetupForm = {
  ai: { listener: 'default', transcriber: 'default', followUp: 'interviewer', interviewer: 'default', evaluator: 'interviewer', speaker: 'default' },
  interviewType: { type: 'cold' },
  roleFocus: 'unanswered',
  questions: { type: 'generate' },
}

export function describeSetupHostContract(name: string, makeRig: () => HostRig): void {
  describe(`SetupHost contract: ${name}`, () => {
    it('loads the application setup page in a state the page knows', async () => {
      const { host, run } = makeRig()
      const page = await run(host.loadPage())
      expect(page.type).toBe('ready')
      if (page.type !== 'ready') return
      expect(page.form.interviewType).toEqual({ type: 'cold' })
      expect(page.form.roleFocus).toBe('unanswered')
      expect(page.form.questions).toEqual({ type: 'generate' })
      expect(page.form.ai.listener).toBe('default')
    })

    it('describes a role it just added: its description, and no questions yet', async () => {
      const { host, run } = makeRig()
      const added = await run(host.pasteJobDescription({ displayName: 'Described role', text: 'Build things. Test things.' }))
      const role = await run(host.loadRole(added.roleId))
      expect(role.roleId).toBe(added.roleId)
      expect(role.displayName).toBe('Described role')
      expect(role.description).toContain('Build things')
      expect(role.questions).toEqual({ type: 'none' })
    })

    it('rejects a role it does not have, naming it', async () => {
      const { host, run } = makeRig()
      await expect(run(host.loadRole('never-added'))).rejects.toThrow(/never-added/)
    })

    it('keeps pasted questions aside until the interview is prepared with them; then they are the role’s questions', async () => {
      const { host, run, until } = makeRig()
      const role = await run(host.pasteJobDescription({ displayName: 'Questioned role', text: 'Lead the team.' }))
      const processed = await run(host.pasteQuestions(role.roleId, { displayName: 'Mine', text: '# Mine\n- One?\n2. Two?\n' }))
      expect(processed.count).toBe(2)
      expect(processed.displayName).toBe('Mine')
      expect((await run(host.loadRole(role.roleId))).questions).toEqual({ type: 'none' })

      const progress: PrepReport[] = []
      host.prepareInterview({ sessionId: `contract-q-${Math.random().toString(36).slice(2, 10)}`, form: { ...FORM, roleFocus: role.roleId, questions: { type: 'uploaded', questionSetId: processed.questionSetId } } }, (p) => progress.push(p))
      await until(() => progress.at(-1)?.progress === 'ready' || progress.at(-1)?.progress === 'diagnosing')
      expect(progress.at(-1)?.progress).toBe('ready')
      const after = await run(host.loadRole(role.roleId))
      expect(after.questions.type === 'ready' && after.questions.all.map(([, text]) => text)).toEqual(['One?', 'Two?'])
    })

    it('refuses to keep questions a role does not have, and refuses an empty questions paste with a reason', async () => {
      const { host, run, until } = makeRig()
      const role = await run(host.pasteJobDescription({ displayName: 'Bare role', text: 'No questions yet.' }))
      await expect(run(host.pasteQuestions(role.roleId, { displayName: 'Nothing', text: '# only a heading' }))).rejects.toThrow(/No questions were found/)
      const progress: PrepReport[] = []
      host.prepareInterview({ sessionId: `contract-k-${Math.random().toString(36).slice(2, 10)}`, form: { ...FORM, roleFocus: role.roleId, questions: { type: 'keep' } } }, (p) => progress.push(p))
      await until(() => progress.at(-1)?.progress === 'ready' || progress.at(-1)?.progress === 'diagnosing')
      expect(progress.at(-1)?.progress).toBe('diagnosing')
    })

    it('processes a pasted job description and then lists it as a saved role', async () => {
      const { host, run } = makeRig()
      const name = `Contract role ${Math.random().toString(36).slice(2, 8)}`
      const processed = await run(host.pasteJobDescription({ displayName: name, text: 'Build things. Test things.' }))
      expect(processed.displayName).toBe(name)
      expect(processed.roleId).not.toBe('')
      const page = await run(host.loadPage())
      if (page.type !== 'ready') throw new Error('page not ready')
      expect(page.roles.type === 'ready' && page.roles.all.some(([id]) => id === processed.roleId)).toBe(true)
    })

    it('processes an uploaded resume and returns its id and name', async () => {
      const { host, run } = makeRig()
      const processed = await run(host.uploadResume({ displayName: 'Contract resume', fileName: 'cv.txt', payload: textFile('Ten years of building.') }))
      expect(processed.displayName).toBe('Contract resume')
      expect(processed.resumeId).not.toBe('')
    })

    it('reports the processing of an uploaded resume, step by step, until every step is done', async () => {
      const { host, run, until } = makeRig()
      const processed = await run(host.uploadResume({ displayName: 'Watched resume', fileName: 'cv.txt', payload: textFile('Ten years of building.') }))
      const seen: ResumeUploadProgress[] = []
      const errors: string[] = []
      const stop = host.watchResumeUpload(processed.resumeId, (p) => seen.push(p), (m) => errors.push(m))
      await until(() => seen.at(-1)?.status === 'done' || errors.length > 0)
      stop()
      expect(errors).toEqual([])
      const last = seen.at(-1)
      if (!last) throw new Error('no progress was reported')
      expect(last.resumeId).toBe(processed.resumeId)
      expect(last.displayName).toBe('Watched resume')
      expect(last.steps.length).toBeGreaterThan(0)
      expect(last.steps.every((s) => s.status === 'done' && s.name.length > 0)).toBe(true)
    })

    it('refuses to watch a resume it never processed, with a message', async () => {
      const { host, until } = makeRig()
      const errors: string[] = []
      const stop = host.watchResumeUpload('never-uploaded', () => undefined, (m) => errors.push(m))
      await until(() => errors.length > 0)
      stop()
      expect(errors[0]).toMatch(/never-uploaded/)
    })

    it('prepares an interview, reaches ready, and then starts it with cue settings', async () => {
      const { host, run, until } = makeRig()
      const role = await run(host.pasteJobDescription({ displayName: 'Prepared role', text: 'Lead the team.' }))
      const sessionId = `contract-${Math.random().toString(36).slice(2, 10)}`
      const progress: PrepReport[] = []
      host.prepareInterview({ sessionId, form: { ...FORM, roleFocus: role.roleId } }, (p) => progress.push(p))
      await until(() => progress.at(-1)?.progress === 'ready')
      expect(progress[0]).toEqual({ progress: 'preparing', stepsDone: 0 })
      // Steps only ever count up, and a ready host has finished every one.
      for (let i = 1; i < progress.length; i++) expect(progress[i].stepsDone).toBeGreaterThanOrEqual(progress[i - 1].stepsDone)
      expect(progress.at(-1)?.stepsDone).toBeGreaterThan(0)

      const settings = await run(
        host.startInterview({
          sessionId,
          form: { audio: { status: 'verified', quality: 'clear' }, video: { status: 'skipped', quality: 'skipped' }, training: { captions: 'disabled' } },
        }),
      )
      expect(settings.emulation.cadences.variances.floor).toBeLessThanOrEqual(settings.emulation.cadences.variances.ceiling)
      expect(settings.emulation.latencies.audioRamp).toMatch(/^clipped-(beginning|ending)$|^both$/)
    })
  })
}
