// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { Clock, SetupHost, TranscriptListener } from '../../core/ports.ts'
import type {
  ApplicationSetupPage,
  CueSettings,
  StartInterview,
  HardwareKind,
  HardwareQuality,
  JobDescriptionProcessed,
  PrepReport,
  ResumeId,
  ResumeUploadProgress,
  ResumeUploadStep,
  Saved,
  SessionId,
  TranscriptSegment,
} from '../../core/contract/pageFlow.ts'
import { defaultAi } from '../../core/setup/slots.ts'
import { PREP_STEP_TOTAL } from '../../core/setup/waitingRoom.ts'

/** What the scripted host does. The prototype's harness card edits this. */
export interface MockHostConfig {
  saved: 'some' | 'none'
  load: 'works' | 'fails'
  preparation: 'succeeds' | 'retries-then-succeeds' | 'fails'
  audio: Exclude<HardwareQuality, 'pending' | 'skipped'> | 'errored'
  video: Exclude<HardwareQuality, 'pending' | 'skipped'> | 'errored'
  /** What processing a loaded resume does after the upload answers (the steps are random either way). */
  upload: 'succeeds' | 'fails'
  /** Whether the scripted transcriber answers, or reports both passes as unavailable. */
  transcription: 'works' | 'unavailable'
}

export const defaultMockConfig: MockHostConfig = {
  saved: 'some',
  load: 'works',
  preparation: 'succeeds',
  audio: 'clear',
  video: 'clear',
  upload: 'succeeds',
  transcription: 'works',
}

/** Where a retrying or failing preparation stalls, counted in steps done. */
export const MOCK_STALL_STEP = 4

/** Delays in the clock's milliseconds. Long enough to see each state; short enough not to wait. */
export const MOCK_DELAYS = { load: 700, upload: 1500, preparing: 5000, retrying: 3000, verify: 2000, uploadStep: 900 } as const

/** A scripted answer, said the way the two passes say it: partials, then finals that replace them, then the large model's reading. */
const TRANSCRIPT_SCRIPT: ReadonlyArray<[number, Omit<TranscriptSegment, 'sessionId' | 'questionId'>]> = [
  [1500, { id: 'rt-1', startSeconds: 0, endSeconds: 1.4, text: 'I led the', final: false, replaces: [], source: 'real-time', model: 'realtime:mock', device: 'none' }],
  [3000, { id: 'rt-2', startSeconds: 0, endSeconds: 2.8, text: 'I led the migration of the billing', final: false, replaces: ['rt-1'], source: 'real-time', model: 'realtime:mock', device: 'none' }],
  [4500, { id: 'rt-3', startSeconds: 0, endSeconds: 4.1, text: 'I led the migration of the billing system to the cloud,', final: true, replaces: ['rt-2'], source: 'real-time', model: 'realtime:mock', device: 'none' }],
  [6500, { id: 'rt-4', startSeconds: 4.1, endSeconds: 6.2, text: 'which cut our', final: false, replaces: [], source: 'real-time', model: 'realtime:mock', device: 'none' }],
  [8000, { id: 'rt-5', startSeconds: 4.1, endSeconds: 7.6, text: 'which cut our monthly costs by a third.', final: true, replaces: ['rt-4'], source: 'real-time', model: 'realtime:mock', device: 'none' }],
  [10000, { id: 'pq-1', startSeconds: 0, endSeconds: 7.6, text: 'I led the migration of the billing system to the cloud, which cut our monthly costs by a third.', final: true, replaces: [], source: 'post-question', model: 'post:mock', device: 'none' }],
]

/** The same pool the API prototype's mock uploader draws from, so the two look alike. */
const UPLOAD_STEPS = [
  'Receiving the file',
  'Scanning for text',
  'Finding sections',
  'Extracting work history',
  'Extracting skills',
  'Summarizing experience',
  'Indexing for the interviewer',
] as const

const SAVED_RESUMES: Saved = [
  ['res-2', 'Resume, 2026 (PDF)'],
  ['res-1', 'Resume, 2024 (PDF)'],
]
const SAVED_ROLES: Saved = [
  ['role-1', 'Software Engineer'],
  ['role-2', 'Product Manager'],
]

const documents = (all: Saved): { type: 'none' } | { type: 'ready'; all: Saved } => (all.length === 0 ? { type: 'none' } : { type: 'ready', all })

/** A scripted stand-in for the server. No network, no models. */
export class MockSetupHost implements SetupHost {
  private readonly clock: Clock
  private readonly config: () => MockHostConfig
  private counter = 0
  /** What the user has uploaded this session, newest first for resumes. A real server keeps these, and the contract suite checks it. */
  private addedResumes: Array<[string, string]> = []
  private addedRoles: Array<[string, string]> = []

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
        resumes: documents([...this.addedResumes, ...(c.saved === 'some' ? SAVED_RESUMES : [])]),
        roles: documents([...(c.saved === 'some' ? SAVED_ROLES : []), ...this.addedRoles]),
      }
    })
  }

  uploadResume(request: { displayName: string }) {
    return this.after(MOCK_DELAYS.upload, () => {
      const processed = { resumeId: `res-new-${++this.counter}`, displayName: request.displayName }
      this.addedResumes.unshift([processed.resumeId, processed.displayName])
      return processed
    })
  }

  uploadJobDescription(request: { displayName: string }): Promise<JobDescriptionProcessed> {
    return this.after(MOCK_DELAYS.upload, () => {
      const processed = { roleId: `role-new-${++this.counter}`, displayName: request.displayName }
      this.addedRoles.push([processed.roleId, processed.displayName])
      return processed
    })
  }

  pasteJobDescription(request: { displayName: string }): Promise<JobDescriptionProcessed> {
    return this.uploadJobDescription(request)
  }

  /**
   * Steps land evenly across the preparing window, so the Waiting room has something to show.
   * A retry stalls at the fifth step and then finishes; a failure stalls there and is diagnosed.
   */
  prepareInterview(_request: unknown, onProgress: (report: PrepReport) => void): () => void {
    const plan = this.config().preparation
    const cancels: Array<() => void> = []
    const at = (delay: number, report: PrepReport) => cancels.push(this.clock.schedule(delay, () => onProgress(report)))
    onProgress({ progress: 'preparing', stepsDone: 0 })
    const stall = plan === 'succeeds' ? PREP_STEP_TOTAL : MOCK_STALL_STEP
    const slice = MOCK_DELAYS.preparing / PREP_STEP_TOTAL
    for (let step = 1; step <= stall && step < PREP_STEP_TOTAL; step++) at(Math.round(step * slice), { progress: 'preparing', stepsDone: step })
    if (plan === 'succeeds') at(MOCK_DELAYS.preparing, { progress: 'ready', stepsDone: PREP_STEP_TOTAL })
    else {
      at(MOCK_DELAYS.preparing, { progress: 'retrying', stepsDone: stall })
      at(MOCK_DELAYS.preparing + MOCK_DELAYS.retrying, plan === 'fails' ? { progress: 'diagnosing', stepsDone: stall } : { progress: 'ready', stepsDone: PREP_STEP_TOTAL })
    }
    return () => cancels.forEach((cancel) => cancel())
  }

  /** A clean call, as placeholders: the same values as the API prototype's `CleanCallProposal`. */
  startInterview(_request: StartInterview): Promise<CueSettings> {
    return this.after(0, () => ({
      emulation: {
        cadences: { speaking: 0, listening: 0, thinking: 0, variances: { floor: 1, ceiling: 1 } },
        latencies: { network: 0, packetLossVariancePerSecond: 0, audioRamp: 'clipped-ending' },
      },
    }))
  }

  verifyHardware(kind: HardwareKind) {
    return this.after(MOCK_DELAYS.verify, () => {
      const result = this.config()[kind]
      if (result === 'errored') throw new Error('Could not reach the device.')
      return result
    })
  }

  /** The scripted answer above, on the clock. With `transcription: 'unavailable'` both passes fail at once, as when the worker is down. */
  watchTranscript(sessionId: SessionId, listener: TranscriptListener): () => void {
    const cancels: Array<() => void> = []
    cancels.push(this.clock.schedule(0, () => listener.snapshot({ segments: [], failures: [] })))
    if (this.config().transcription === 'unavailable') {
      cancels.push(
        this.clock.schedule(500, () => {
          listener.failed({ sessionId, questionId: 'q1', source: 'real-time', message: 'The transcriber is not running at the configured address (mock).' })
          listener.failed({ sessionId, questionId: 'q1', source: 'post-question', message: 'The transcriber is not running at the configured address (mock).' })
        }),
      )
    } else {
      for (const [at, piece] of TRANSCRIPT_SCRIPT) cancels.push(this.clock.schedule(at, () => listener.segment({ ...piece, sessionId, questionId: 'q1' })))
    }
    return () => cancels.forEach((cancel) => cancel())
  }

  /**
   * Three to five random steps from the pool, one after another. Only a resume uploaded this
   * session can be watched, as on the real server. With `upload: 'fails'` the last step fails.
   */
  watchResumeUpload(resumeId: ResumeId, onProgress: (progress: ResumeUploadProgress) => void, onError: (message: string) => void): () => void {
    const cancels: Array<() => void> = []
    const stop = () => cancels.forEach((cancel) => cancel())
    const known = this.addedResumes.find(([id]) => id === resumeId)
    if (!known) {
      cancels.push(this.clock.schedule(0, () => onError(`No resume upload is known for "${resumeId}".`)))
      return stop
    }
    const displayName = known[1]
    const count = 3 + Math.floor(Math.random() * 3)
    const chosen = [...UPLOAD_STEPS].sort(() => Math.random() - 0.5).slice(0, count)
    const steps: ResumeUploadStep[] = UPLOAD_STEPS.filter((name) => chosen.includes(name)).map((name) => ({ name, status: 'pending' }))
    const failing = this.config().upload === 'fails'
    const snapshot = (status: ResumeUploadProgress['status']): ResumeUploadProgress => ({ resumeId, displayName, status, steps: steps.map((s) => ({ ...s })) })

    cancels.push(this.clock.schedule(0, () => onProgress(snapshot('running'))))
    let at = 0
    steps.forEach((step, i) => {
      const last = i === steps.length - 1
      cancels.push(
        this.clock.schedule(at, () => {
          step.status = 'running'
          onProgress(snapshot('running'))
        }),
      )
      at += MOCK_DELAYS.uploadStep
      cancels.push(
        this.clock.schedule(at, () => {
          if (last && failing) {
            step.status = 'failed'
            onProgress(snapshot('failed'))
          } else {
            step.status = 'done'
            onProgress(snapshot(last ? 'done' : 'running'))
          }
        }),
      )
    })
    return stop
  }
}
