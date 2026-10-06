// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { Clock, SetupHost } from '../../core/ports.ts'
import type {
  ApplicationSetupPage,
  HardwareKind,
  HardwareQuality,
  JobDescriptionProcessed,
  PrepProgress,
} from '../../core/contract/pageFlow.ts'
import { defaultAi } from '../../core/setup/slots.ts'

/** What the scripted host does. The prototype's harness card edits this. */
export interface MockHostConfig {
  saved: 'some' | 'none'
  load: 'works' | 'fails'
  preparation: 'succeeds' | 'retries-then-succeeds' | 'fails'
  audio: Exclude<HardwareQuality, 'pending' | 'skipped'> | 'errored'
  video: Exclude<HardwareQuality, 'pending' | 'skipped'> | 'errored'
}

export const defaultMockConfig: MockHostConfig = {
  saved: 'some',
  load: 'works',
  preparation: 'succeeds',
  audio: 'clear',
  video: 'clear',
}

/** Delays in the clock's milliseconds. Long enough to see each state; short enough not to wait. */
export const MOCK_DELAYS = { load: 700, upload: 1500, preparing: 5000, retrying: 3000, verify: 2000 } as const

const SAVED_RESUMES = [
  ['res-2', 'Resume, 2026 (PDF)'],
  ['res-1', 'Resume, 2024 (PDF)'],
] as const
const SAVED_ROLES = [
  ['role-1', 'Software Engineer'],
  ['role-2', 'Product Manager'],
] as const

/** A scripted stand-in for the server. No network, no models. */
export class MockSetupHost implements SetupHost {
  private readonly clock: Clock
  private readonly config: () => MockHostConfig
  private counter = 0

  constructor(clock: Clock, config: () => MockHostConfig = () => defaultMockConfig) {
    this.clock = clock
    this.config = config
  }

  private after<T>(delayMs: number, make: () => T): Promise<T> {
    return new Promise((resolve, reject) =>
      this.clock.schedule(delayMs, () => {
        try {
          resolve(make())
        } catch (e) {
          reject(e)
        }
      }),
    )
  }

  loadPage(): Promise<ApplicationSetupPage> {
    return this.after(MOCK_DELAYS.load, (): ApplicationSetupPage => {
      const c = this.config()
      if (c.load === 'fails') return { type: 'error', message: 'The mock server is set to fail loading.' }
      return {
        type: 'ready',
        form: { ai: defaultAi(), interviewType: { type: 'cold' }, roleFocus: 'unanswered' },
        resumes: c.saved === 'some' ? { type: 'ready', all: SAVED_RESUMES } : { type: 'none' },
        roles: c.saved === 'some' ? { type: 'ready', all: SAVED_ROLES } : { type: 'none' },
      }
    })
  }

  uploadResume(request: { displayName: string }) {
    return this.after(MOCK_DELAYS.upload, () => ({ resumeId: `res-new-${++this.counter}`, displayName: request.displayName }))
  }

  uploadJobDescription(request: { displayName: string }): Promise<JobDescriptionProcessed> {
    return this.after(MOCK_DELAYS.upload, () => ({ roleId: `role-new-${++this.counter}`, displayName: request.displayName }))
  }

  pasteJobDescription(request: { displayName: string }): Promise<JobDescriptionProcessed> {
    return this.uploadJobDescription(request)
  }

  prepareInterview(_request: unknown, onProgress: (progress: PrepProgress) => void): () => void {
    const plan = this.config().preparation
    const steps: Array<[number, PrepProgress]> =
      plan === 'succeeds'
        ? [[MOCK_DELAYS.preparing, 'ready']]
        : [
            [MOCK_DELAYS.preparing, 'retrying'],
            [MOCK_DELAYS.retrying, plan === 'fails' ? 'diagnosing' : 'ready'],
          ]
    onProgress('preparing')
    const cancels: Array<() => void> = []
    let at = 0
    for (const [delay, progress] of steps) {
      at += delay
      cancels.push(this.clock.schedule(at, () => onProgress(progress)))
    }
    return () => cancels.forEach((cancel) => cancel())
  }

  verifyHardware(kind: HardwareKind) {
    return this.after(MOCK_DELAYS.verify, () => {
      const result = this.config()[kind]
      if (result === 'errored') throw new Error('Could not reach the device.')
      return result
    })
  }
}
