// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { PrepReport } from '../contract/pageFlow.ts'
import type { Tone } from './hardware.ts'
import type { TrackedUpload } from './resumeUpload.ts'

// The Waiting room (specs/page-flow.md, section 3; design/mockups/ui/Waiting.dc.html): every step of
// getting the interview ready, from three sources. The upload steps come from this session's resume
// processing reports and the synchronous uploads; the rest come from the host's PrepReport, which
// counts the steps the server has finished. PROPOSAL: the step list, the count and the order are the
// UI's; a server would report each step itself. A saved resume, not loaded this session, counts as
// read in an earlier session.

export type StepGroup = 'materials' | 'scripts' | 'connection'
export type StepStatus = 'done' | 'running' | 'slow' | 'failed' | 'pending'
type StepSource = 'upload-resume' | 'reading-resume' | 'upload-role' | 'upload-questions' | 'prep'

export interface Step {
  id: string
  group: StepGroup
  label: string
  /** Which model does it, or empty. */
  who: string
  source: StepSource
}

export interface StepView extends Step {
  status: StepStatus
}

/** What the setup pages knew when they asked for the interview, which decides which steps exist. */
export interface Materials {
  hot: boolean
  roleSource: 'uploaded' | 'saved'
  /** Where the questions come from: the AI writes them, the user's upload, or the role's saved ones kept. */
  questions: 'generate' | 'uploaded' | 'kept'
}

/** How many steps the host reports on (PrepReport.stepsDone counts up to this). */
export const PREP_STEP_TOTAL = 9

export const GROUPS: Record<StepGroup, { title: string; note: string }> = {
  materials: { title: 'Your materials', note: 'Your resume and role are uploaded and read so the interviewer can use them.' },
  scripts: { title: 'Interview scripts', note: 'The AI writes these for your interview. You do not need to do anything.' },
  connection: { title: 'Voice and connection', note: 'The last steps before you join.' },
}

export function stepList(m: Materials): Step[] {
  const steps: Step[] = []
  if (m.hot) {
    steps.push({ id: 'upload-resume', group: 'materials', label: 'Uploading your resume', who: '', source: 'upload-resume' })
    steps.push({ id: 'read-resume', group: 'materials', label: 'Reading your resume', who: 'Interviewer model', source: 'reading-resume' })
  }
  if (m.roleSource === 'uploaded') steps.push({ id: 'upload-role', group: 'materials', label: 'Uploading your job description', who: '', source: 'upload-role' })
  // One of the three question steps is the host's, so the host always counts to PREP_STEP_TOTAL.
  const questionStep: [string, StepGroup, string, string] =
    m.questions === 'uploaded'
      ? ['read-questions', 'materials', 'Reading your questions', 'Interviewer model']
      : m.questions === 'kept'
        ? ['load-questions', 'materials', 'Loading the saved questions', '']
        : ['write-questions', 'scripts', 'Writing the questions', 'Interviewer model']
  const prep: Array<[string, StepGroup, string, string]> = [
    ['read-role', 'materials', m.roleSource === 'uploaded' ? 'Reading the role and job description' : 'Looking up the role', 'Interviewer model'],
    ['role-review', 'materials', 'Preparing your role review', 'Interviewer model'],
    questionStep,
    ['opening', 'scripts', 'Writing the opening script', 'Interviewer model'],
    ['follow-ups', 'scripts', 'Preparing the follow-up questions', 'Follow-up model'],
    ['scoring', 'scripts', 'Preparing the scoring guide', 'Evaluator model'],
    ['closing', 'scripts', 'Writing the closing script', 'Interviewer model'],
    ['voice', 'connection', 'Warming up the interviewer’s voice', 'Speaker model'],
    ['room', 'connection', 'Connecting to the interview room', ''],
  ]
  for (const [id, group, label, who] of prep) {
    if (id === 'read-questions') steps.push({ id: 'upload-questions', group: 'materials', label: 'Uploading your questions', who: '', source: 'upload-questions' })
    steps.push({ id, group, label, who, source: 'prep' })
  }
  return steps
}

export interface StepInput {
  report: PrepReport | null
  /** The hot interview's resume as this session tracks it, or null. */
  resumeUpload: TrackedUpload | null
}

export function stepViews(steps: Step[], input: StepInput): StepView[] {
  let prepIndex = 0
  return steps.map((step) => {
    switch (step.source) {
      case 'upload-resume':
      case 'upload-role':
      case 'upload-questions':
        return { ...step, status: 'done' } // the upload answered before the user could leave the setup pages
      case 'reading-resume':
        return { ...step, status: readingStatus(input.resumeUpload) }
      case 'prep':
        return { ...step, status: prepStatus(input.report, prepIndex++) }
    }
  })
}

const readingStatus = (upload: TrackedUpload | null): StepStatus => {
  if (!upload) return 'done'
  if (upload.error) return 'failed'
  if (!upload.progress) return 'running'
  return upload.progress.status === 'done' ? 'done' : upload.progress.status === 'failed' ? 'failed' : 'running'
}

const prepStatus = (report: PrepReport | null, index: number): StepStatus => {
  if (!report) return 'pending'
  if (report.progress === 'ready' || index < report.stepsDone) return 'done'
  if (index > report.stepsDone) return 'pending'
  return report.progress === 'retrying' ? 'slow' : report.progress === 'diagnosing' ? 'failed' : 'running'
}

export const STEP_LOOK: Record<StepStatus, { mark: string; word: string; tone: Tone }> = {
  done: { mark: '✓', word: 'Done', tone: 'ok' },
  running: { mark: '…', word: 'In progress', tone: 'warn' },
  slow: { mark: '!', word: 'Taking longer, retrying', tone: 'warn' },
  failed: { mark: '✕', word: 'Needs attention', tone: 'bad' },
  pending: { mark: '○', word: 'Waiting', tone: 'neutral' },
}

const active = (v: StepView) => v.status === 'running' || v.status === 'slow' || v.status === 'failed'

/** The "Now" line: the first step that is in progress, slow or failed. */
export const nowText = (views: StepView[]): string => views.find(active)?.label ?? 'Your interview is ready'

export const doneCount = (views: StepView[]): number => views.filter((v) => v.status === 'done').length

export const percentDone = (views: StepView[]): number => (views.length === 0 ? 0 : Math.round((100 * doneCount(views)) / views.length))

export type RoomState = 'ready' | 'waiting' | 'blocked'

/** Ready when every step is done. Blocked when one failed: a resume that could not be read, or a preparation being diagnosed. */
export const roomState = (views: StepView[]): RoomState =>
  views.some((v) => v.status === 'failed') ? 'blocked' : views.every((v) => v.status === 'done') ? 'ready' : 'waiting'

/** PROPOSAL: the design shows [N]. Short, so the room is not a wait in itself. */
export const COUNTDOWN_SECONDS = 5
