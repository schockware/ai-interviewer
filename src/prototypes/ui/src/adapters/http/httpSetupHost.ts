// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { HubConnectionBuilder } from '@microsoft/signalr'
import type { SetupHost, TranscriptListener } from '../../core/ports.ts'
import { PREP_STEP_TOTAL } from '../../core/setup/waitingRoom.ts'
import type {
  ApplicationSetupPage,
  CueSettings,
  JobDescriptionPaste,
  JobDescriptionProcessed,
  JobDescriptionUpload,
  PrepareInterview,
  PrepReport,
  ResumeId,
  ResumeProcessed,
  ResumeUploadProgress,
  SessionId,
  StartInterview,
  TranscriptFailure,
  TranscriptSegment,
  TranscriptSnapshot,
  UploadResume,
} from '../../core/contract/pageFlow.ts'

/** The slice of a SignalR connection this adapter uses, so a test can stand in for the hub. */
export interface HubLink {
  on(method: string, handler: (payload: unknown) => void): void
  start(): Promise<void>
  invoke<T>(method: string, ...args: unknown[]): Promise<T>
  stop(): Promise<void>
}
export type HubConnect = (url: string) => HubLink

const signalRConnect: HubConnect = (url) => new HubConnectionBuilder().withUrl(url).build()

/** The InterviewHub, as the API prototype maps it (src/prototypes/api README, Real-time). */
export const INTERVIEW_HUB_PATH = '/hubs/interview'
const RESUME_UPLOAD_PROGRESS = 'resumeUploadProgress'
const TRANSCRIPT_SEGMENT = 'transcriptSegment'
const TRANSCRIPT_FAILED = 'transcriptFailed'

/**
 * The real server: the API prototype's page-flow endpoints (src/prototypes/api README). It
 * implements every SetupHost method except `verifyHardware`, which the API does not have yet.
 * Bytes travel as base64, as the OpenAPI draft's `format: byte` says. Resume processing progress
 * comes over the InterviewHub (SignalR), through the same base URL.
 *
 * Takes `fetch` and the hub connector as parameters so a test can stand in for the network, and
 * `headers`, read on every request, for the test drawer's server-side settings (composition/testMode.ts).
 * No credentials: the browser holds no secrets, and the API's own configuration is the
 * server's business (decision 0004).
 */
export class HttpSetupHost implements Omit<SetupHost, 'verifyHardware'> {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch
  private readonly connect: HubConnect
  private readonly headers: () => Record<string, string>

  constructor(
    baseUrl: string,
    fetchFn: typeof fetch = (...args) => fetch(...args),
    connect: HubConnect = signalRConnect,
    headers: () => Record<string, string> = () => ({}),
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.fetchFn = fetchFn
    this.connect = connect
    this.headers = headers
  }

  private async send(path: string, body?: unknown): Promise<Response> {
    const extra = this.headers()
    let response: Response
    try {
      response =
        body === undefined
          ? await this.fetchFn(`${this.baseUrl}${path}`, Object.keys(extra).length ? { headers: extra } : undefined)
          : await this.fetchFn(`${this.baseUrl}${path}`, {
              method: 'POST',
              headers: { ...extra, 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
    } catch {
      throw new Error(`Could not reach the API at ${this.baseUrl}. Is it running?`)
    }
    if (response.ok) return response
    // The API answers every failure with { message }. Anything else is reported plainly.
    const message = await response
      .json()
      .then((j: unknown) => (typeof (j as { message?: unknown }).message === 'string' ? (j as { message: string }).message : null))
      .catch(() => null)
    throw new Error(message ?? `The API answered ${response.status} ${response.statusText}.`)
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return (await (await this.send(path, body)).json()) as T
  }

  async loadPage(): Promise<ApplicationSetupPage> {
    const page = (await (await this.send('/application-setup')).json()) as ApplicationSetupPage
    if (!['loading', 'error', 'ready'].includes(page.type)) throw new Error('The API sent a setup page this UI does not know.')
    return page
  }

  uploadResume(request: UploadResume): Promise<ResumeProcessed> {
    return this.post('/resumes', { ...request, payload: toBase64(request.payload) })
  }

  uploadJobDescription(request: JobDescriptionUpload): Promise<JobDescriptionProcessed> {
    return this.post('/job-descriptions/uploads', { ...request, payload: toBase64(request.payload) })
  }

  pasteJobDescription(request: JobDescriptionPaste): Promise<JobDescriptionProcessed> {
    return this.post('/job-descriptions/pastes', request)
  }

  /**
   * The API answers 202 and the stub preparer finishes at once, so 202 is reported as `ready` with
   * every step done. PROPOSAL / GUESS: how the real server reports InterviewPrepared and its steps
   * (push or poll) is undecided, and `retrying` never happens here. A refusal is shown as `diagnosing`.
   */
  prepareInterview(request: PrepareInterview, onProgress: (report: PrepReport) => void): () => void {
    let live = true
    onProgress({ progress: 'preparing', stepsDone: 0 })
    this.send('/interviews/prepare', request).then(
      () => live && onProgress({ progress: 'ready', stepsDone: PREP_STEP_TOTAL }),
      () => live && onProgress({ progress: 'diagnosing', stepsDone: 0 }),
    )
    return () => {
      live = false
    }
  }

  startInterview(request: StartInterview): Promise<CueSettings> {
    return this.post('/interviews/start', request)
  }

  /**
   * One hub connection per watched resume: the hub's WatchResumeUpload joins the caller to that
   * resume and answers with what is known now, so nothing is lost between the upload finishing
   * and the watch starting. Every later snapshot arrives on the client method. Pushes for any
   * other resume on the same connection are ignored.
   */
  watchResumeUpload(resumeId: ResumeId, onProgress: (progress: ResumeUploadProgress) => void, onError: (message: string) => void): () => void {
    const hub = this.connect(`${this.baseUrl}${INTERVIEW_HUB_PATH}`)
    let live = true
    hub.on(RESUME_UPLOAD_PROGRESS, (payload) => {
      const progress = payload as ResumeUploadProgress
      if (live && progress.resumeId === resumeId) onProgress(progress)
    })
    hub
      .start()
      .then(() => hub.invoke<ResumeUploadProgress>('WatchResumeUpload', resumeId))
      .then(
        (snapshot) => live && onProgress(snapshot),
        (e: unknown) => live && onError(e instanceof Error && e.message ? e.message : `Could not reach the API at ${this.baseUrl} for upload progress.`),
      )
    return () => {
      live = false
      void hub.stop().catch(() => undefined)
    }
  }

  /** The hub's WatchTranscript answers with what was said so far; each later piece and failure arrives on its own method. */
  watchTranscript(sessionId: SessionId, listener: TranscriptListener): () => void {
    const hub = this.connect(`${this.baseUrl}${INTERVIEW_HUB_PATH}`)
    let live = true
    hub.on(TRANSCRIPT_SEGMENT, (payload) => {
      const segment = payload as TranscriptSegment
      if (live && segment.sessionId === sessionId) listener.segment(segment)
    })
    hub.on(TRANSCRIPT_FAILED, (payload) => {
      const failure = payload as TranscriptFailure
      if (live && failure.sessionId === sessionId) listener.failed(failure)
    })
    hub
      .start()
      .then(() => hub.invoke<TranscriptSnapshot>('WatchTranscript', sessionId))
      .then(
        (snapshot) => live && listener.snapshot(snapshot),
        (e: unknown) => live && listener.error(e instanceof Error && e.message ? e.message : `Could not reach the API at ${this.baseUrl} for the transcript.`),
      )
    return () => {
      live = false
      void hub.stop().catch(() => undefined)
    }
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
