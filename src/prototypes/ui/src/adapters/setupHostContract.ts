// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// One behavior suite for every SetupHost. The mock runs it in `npm test`; the real API runs it in
// `npm run test:integration`. If the mock passes and the real one fails, the mock is lying
// (docs/decisions/0004). Not a spec file itself: callers register it.
import { describe, expect, it } from 'vitest'
import type { PrepProgress } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'

export interface HostRig {
  host: SetupHost
  /** Lets a call finish. The mock advances its clock; the real host is already on its way. */
  run<T>(pending: Promise<T>): Promise<T>
  /** Waits until `done` holds: the mock advances its clock, the real host is polled for a few seconds. */
  until(done: () => boolean): Promise<void>
}

const textFile = (text: string) => new TextEncoder().encode(text)

export function describeSetupHostContract(name: string, makeRig: () => HostRig): void {
  describe(`SetupHost contract: ${name}`, () => {
    it('loads the application setup page in a state the page knows', async () => {
      const { host, run } = makeRig()
      const page = await run(host.loadPage())
      expect(page.type).toBe('ready')
      if (page.type !== 'ready') return
      expect(page.form.interviewType).toEqual({ type: 'cold' })
      expect(page.form.roleFocus).toBe('unanswered')
      expect(page.form.ai.listener).toBe('default')
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

    it('prepares an interview, reaches ready, and then starts it with cue settings', async () => {
      const { host, run, until } = makeRig()
      const role = await run(host.pasteJobDescription({ displayName: 'Prepared role', text: 'Lead the team.' }))
      const sessionId = `contract-${Math.random().toString(36).slice(2, 10)}`
      const progress: PrepProgress[] = []
      host.prepareInterview(
        {
          sessionId,
          form: {
            ai: { listener: 'default', transcriber: 'default', followUp: 'interviewer', interviewer: 'default', evaluator: 'interviewer', speaker: 'default' },
            interviewType: { type: 'cold' },
            roleFocus: role.roleId,
          },
        },
        (p) => progress.push(p),
      )
      await until(() => progress.at(-1) === 'ready')
      expect(progress[0]).toBe('preparing')

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
