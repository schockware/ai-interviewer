// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { SetupHost } from '../../core/ports.ts'
import type {
  ApplicationSetupPage,
  CueSettings,
  JobDescriptionPaste,
  JobDescriptionProcessed,
  JobDescriptionUpload,
  PrepareInterview,
  PrepProgress,
  ResumeProcessed,
  StartInterview,
  UploadResume,
} from '../../core/contract/pageFlow.ts'

/**
 * The real server: the API prototype's page-flow endpoints (src/prototypes/api README). It
 * implements every SetupHost method except `verifyHardware`, which the API does not have yet.
 * Bytes travel as base64, as the OpenAPI draft's `format: byte` says.
 *
 * Takes `fetch` as a parameter so a test can stand in for the network. No credentials: the
 * browser holds no secrets, and the API's own configuration is the server's business (decision 0004).
 */
export class HttpSetupHost implements Omit<SetupHost, 'verifyHardware'> {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(baseUrl: string, fetchFn: typeof fetch = (...args) => fetch(...args)) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.fetchFn = fetchFn
  }

  private async send(path: string, body?: unknown): Promise<Response> {
    let response: Response
    try {
      response =
        body === undefined
          ? await this.fetchFn(`${this.baseUrl}${path}`)
          : await this.fetchFn(`${this.baseUrl}${path}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
   * The API answers 202 and the stub preparer finishes at once, so 202 is reported as `ready`.
   * PROPOSAL / GUESS: how the real server reports InterviewPrepared (push or poll) is undecided,
   * and `retrying` never happens here. A refusal is shown as `diagnosing`.
   */
  prepareInterview(request: PrepareInterview, onProgress: (progress: PrepProgress) => void): () => void {
    let live = true
    onProgress('preparing')
    this.send('/interviews/prepare', request).then(
      () => live && onProgress('ready'),
      () => live && onProgress('diagnosing'),
    )
    return () => {
      live = false
    }
  }

  startInterview(request: StartInterview): Promise<CueSettings> {
    return this.post('/interviews/start', request)
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
