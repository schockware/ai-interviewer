// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { Clock, SetupHost, TranscriptListener } from '../../core/ports.ts'
import type {
  ApplicationSetupPage,
  CueSettings,
  StartInterview,
  HardwareKind,
  HardwareQuality,
  JobDescriptionProcessed,
  JobDescriptionUpload,
  PasteQuestions,
  PrepareInterview,
  PrepReport,
  QuestionsProcessed,
  ResumeId,
  ResumeUploadProgress,
  ResumeUploadStep,
  RoleDetail,
  RoleId,
  Saved,
  SessionId,
  TranscriptSegment,
  UploadQuestions,
} from '../../core/contract/pageFlow.ts'
import { parseQuestions } from '../../core/setup/questions.ts'
import { defaultAi } from '../../core/setup/slots.ts'
import { PREP_STEP_TOTAL } from '../../core/setup/waitingRoom.ts'
import { SAMPLE_PERSONAS } from './samplePersonas.ts'

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
export const MOCK_DELAYS = { load: 700, upload: 1500, role: 600, preparing: 5000, retrying: 3000, verify: 2000, uploadStep: 900 } as const

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

/** A role with a description but no questions, so the "existing role, no questions" case is reachable. */
const ROLE_WITHOUT_QUESTIONS = {
  id: 'role-pm',
  title: 'Product Manager',
  description: '# Product Manager\n\nOwns the roadmap for one product line, from discovery to launch. Works with design and engineering every day and with sales and support every week.',
}

/** The sample personas' roles (mocked-samples/ai-interviewer-test-personas), as the API loads them, plus the one without questions. */
const SAVED_ROLES: Saved = [...SAMPLE_PERSONAS.map((p): [string, string] => [`role-${p.id}`, p.role]), [ROLE_WITHOUT_QUESTIONS.id, ROLE_WITHOUT_QUESTIONS.title]]
const SAVED_DESCRIPTIONS = new Map<string, string>([...SAMPLE_PERSONAS.map((p): [string, string] => [`role-${p.id}`, p.description]), [ROLE_WITHOUT_QUESTIONS.id, ROLE_WITHOUT_QUESTIONS.description]])
const SAVED_QUESTIONS = new Map<string, readonly string[]>(SAMPLE_PERSONAS.map((p) => [`role-${p.id}`, p.questions]))

/** The same five templates as the API prototype's TemplateQuestionWriter, the stand-in for the AI writing them. */
const templateQuestions = (title: string): string[] => [
  `What draws you to working as a ${title}?`,
  `Tell me about a time your work as a ${title}, or on the way to becoming one, went especially well.`,
  'Tell me about a time you had to learn something new quickly, at work, at school, or anywhere else.',
  'Suppose you are given more work than you can finish in a day. What would you do?',
  `Which part of the ${title} role do you know least, and how would you get up to speed on it?`,
]

const READABLE = ['.txt', '.md', '.json']
const decodeText = (fileName: string, payload: Uint8Array): string | null =>
  READABLE.some((ext) => fileName.toLowerCase().endsWith(ext)) ? new TextDecoder().decode(payload) : null

const documents = (all: Saved): { type: 'none' } | { type: 'ready'; all: Saved } => (all.length === 0 ? { type: 'none' } : { type: 'ready', all })

/** A scripted stand-in for the server. No network, no models. */
export class MockSetupHost implements SetupHost {
  private readonly clock: Clock
  private readonly config: () => MockHostConfig
  private counter = 0
  /** What the user has uploaded this session, newest first for resumes. A real server keeps these, and the contract suite checks it. */
  private addedResumes: Array<[string, string]> = []
  private addedRoles: Array<[string, string]> = []
  private readonly addedDescriptions = new Map<string, string>()
  /** Each role's current questions; the saved roles start with the samples'. Changed only by Prepare interview, as on the server. */
  private readonly activeQuestions = new Map<string, readonly string[]>(SAVED_QUESTIONS)
  /** Uploaded sets waiting for Prepare interview. */
  private readonly pendingSets = new Map<string, { roleId: string; texts: string[] }>()

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

  private roles(): Saved {
    return [...(this.config().saved === 'some' ? SAVED_ROLES : []), ...this.addedRoles]
  }

  loadPage(): Promise<ApplicationSetupPage> {
    return this.after(MOCK_DELAYS.load, (): ApplicationSetupPage => {
      const c = this.config()
      if (c.load === 'fails') return { type: 'error', message: 'The mock server is set to fail loading.' }
      return {
        type: 'ready',
        form: { ai: defaultAi(), interviewType: { type: 'cold' }, roleFocus: 'unanswered', questions: { type: 'generate' } },
        resumes: documents([...this.addedResumes, ...(c.saved === 'some' ? SAVED_RESUMES : [])]),
        roles: documents(this.roles()),
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

  uploadJobDescription(request: JobDescriptionUpload): Promise<JobDescriptionProcessed> {
    return this.addRole(request.displayName, decodeText(request.fileName, request.payload) ?? `[The description of ${request.displayName} appears here once the server can read ${request.fileName}.]`)
  }

  pasteJobDescription(request: { displayName: string; text: string }): Promise<JobDescriptionProcessed> {
    return this.addRole(request.displayName, request.text)
  }

  private addRole(displayName: string, description: string): Promise<JobDescriptionProcessed> {
    return this.after(MOCK_DELAYS.upload, () => {
      const processed = { roleId: `role-new-${++this.counter}`, displayName }
      this.addedRoles.push([processed.roleId, processed.displayName])
      this.addedDescriptions.set(processed.roleId, description)
      return processed
    })
  }

  /** The role's description and its current questions, after a short look-up so the "checking" state shows. */
  loadRole(roleId: RoleId): Promise<RoleDetail> {
    return this.after(MOCK_DELAYS.role, (): RoleDetail => {
      const found = this.roles().find(([id]) => id === roleId)
      if (!found) throw new Error(`No role "${roleId}" is saved.`)
      const questions = this.activeQuestions.get(roleId) ?? []
      return {
        roleId,
        displayName: found[1],
        description: SAVED_DESCRIPTIONS.get(roleId) ?? this.addedDescriptions.get(roleId) ?? '',
        questions: questions.length === 0 ? { type: 'none' } : { type: 'ready', all: questions.map((text, i) => [`${roleId}-q${i + 1}`, text] as const) },
      }
    })
  }

  uploadQuestions(roleId: RoleId, request: UploadQuestions): Promise<QuestionsProcessed> {
    return this.after(MOCK_DELAYS.upload, () => {
      const text = decodeText(request.fileName, request.payload)
      if (text === null) throw new Error(`"${request.fileName}" cannot be read yet. Supported: ${READABLE.join(', ')}.`)
      return this.storeQuestions(roleId, request.displayName, text)
    })
  }

  pasteQuestions(roleId: RoleId, request: PasteQuestions): Promise<QuestionsProcessed> {
    return this.after(MOCK_DELAYS.upload, () => this.storeQuestions(roleId, request.displayName, request.text))
  }

  private storeQuestions(roleId: string, displayName: string, text: string): QuestionsProcessed {
    if (!this.roles().some(([id]) => id === roleId)) throw new Error(`No role "${roleId}" is saved.`)
    const parsed = parseQuestions(text)
    if (parsed.type === 'failed') throw new Error(parsed.message)
    const questionSetId = `qs-${++this.counter}`
    this.pendingSets.set(questionSetId, { roleId, texts: parsed.questions })
    return { questionSetId, displayName, count: parsed.questions.length }
  }

  /**
   * Settles the role's questions as the plan says, then steps land evenly across the preparing
   * window, so the Waiting room has something to show. A retry stalls at the fifth step and then
   * finishes; a failure stalls there and is diagnosed. A plan the server would refuse (keeping
   * questions the role does not have, an upload for another role) is diagnosed at once.
   */
  prepareInterview(request: PrepareInterview, onProgress: (report: PrepReport) => void): () => void {
    const refused = this.applyQuestions(request)
    if (refused) {
      const cancel = this.clock.schedule(0, () => onProgress({ progress: 'diagnosing', stepsDone: 0 }))
      return cancel
    }
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

  /** The server's rule for the question plan. Returns why it is refused, or null once applied. */
  private applyQuestions(request: PrepareInterview): string | null {
    const roleId = request.form.roleFocus
    if (roleId === 'unanswered') return 'Role focus is required.'
    const plan = request.form.questions
    switch (plan.type) {
      case 'keep':
        return (this.activeQuestions.get(roleId) ?? []).length === 0 ? 'The role has no saved questions to keep.' : null
      case 'uploaded': {
        const set = this.pendingSets.get(plan.questionSetId)
        if (!set) return `Questions "${plan.questionSetId}" were not found.`
        if (set.roleId !== roleId) return `Questions "${plan.questionSetId}" belong to another role.`
        this.activeQuestions.set(roleId, set.texts)
        this.pendingSets.delete(plan.questionSetId)
        return null
      }
      case 'generate':
        this.activeQuestions.set(roleId, templateQuestions(this.roles().find(([id]) => id === roleId)?.[1] ?? 'this role'))
        return null
    }
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
