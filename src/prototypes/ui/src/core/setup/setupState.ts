// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type {
  ApplicationSetupForm,
  ApplicationSetupPage,
  AiSlot,
  DisplayName,
  InterviewType,
  JobDescriptionProcessed,
  JobDescriptionValidation,
  QuestionPlan,
  QuestionsProcessed,
  ResumeId,
  ResumeProcessed,
  RoleDetail,
  Saved,
  RoleId,
  SlotChoice,
} from '../contract/pageFlow.ts'
import type { Materials } from './waitingRoom.ts'

/**
 * Local state of the two setup pages, Application setup and Role set up (specs/page-flow.md,
 * sections 1 and 2). The contract's ResumeValidation and JobDescriptionValidation are "stored as
 * local state until the upload returns", so they are derived from this, never stored twice.
 */
export interface SetupState {
  wants: 'cold' | 'hot'
  resumes: Saved
  resumeId: ResumeId | null
  /** The file being sent, or null. Once the server answers, processing goes on and the uploads context follows it. */
  resumeProcessing: string | null
  /** The resume this session just loaded, so the page can say so. Cleared when the user picks another. */
  loadedResumeId: ResumeId | null
  roles: Saved
  roleId: RoleId | null
  /** The role this session just added from a job description. */
  addedRoleId: RoleId | null
  jdProcessing: boolean
  /** What the host said about the chosen role: its description and saved questions. */
  roleDetail: RoleDetailState
  /** Whether the user opened the questions panel with the Setup questions button. A new role's panel is open regardless. */
  questionsOpen: boolean
  /** For a role with saved questions: keep them (the default) or purge them at Prepare interview. */
  existing: 'keep' | 'purge'
  /** Where new questions come from: the AI (the default) or the user's own file. */
  source: 'generate' | 'upload'
  questionUpload: QuestionUploadState
  ai: Record<AiSlot, SlotChoice>
}

export type RoleDetailState =
  | { type: 'none' }
  | { type: 'loading'; roleId: RoleId }
  | { type: 'ready'; detail: RoleDetail }
  | { type: 'failed'; roleId: RoleId; message: string }

export type QuestionUploadState = { type: 'none' } | { type: 'processing'; fileName: string } | { type: 'ready'; processed: QuestionsProcessed }

export type SetupAction =
  | { type: 'wants'; wants: 'cold' | 'hot' }
  | { type: 'pickResume'; resumeId: ResumeId }
  | { type: 'resumeProcessing'; fileName: string }
  | { type: 'resumeProcessed'; processed: ResumeProcessed }
  | { type: 'resumeFailed' }
  | { type: 'pickRole'; roleId: RoleId }
  | { type: 'jdProcessing' }
  | { type: 'jdProcessed'; processed: JobDescriptionProcessed }
  | { type: 'jdFailed' }
  | { type: 'roleLoaded'; detail: RoleDetail }
  | { type: 'roleFailed'; roleId: RoleId; message: string }
  | { type: 'roleRetry' }
  | { type: 'toggleQuestions' }
  | { type: 'existing'; existing: 'keep' | 'purge' }
  | { type: 'source'; source: 'generate' | 'upload' }
  | { type: 'questionsProcessing'; fileName: string }
  | { type: 'questionsProcessed'; processed: QuestionsProcessed }
  | { type: 'questionsFailed' }
  | { type: 'ai'; slot: AiSlot; choice: SlotChoice }

/** From a ready page. Resumes are newest first, and the first is the one picked last (the mock server has no separate "last picked"). */
export function initialSetup(page: Extract<ApplicationSetupPage, { type: 'ready' }>): SetupState {
  const resumes = page.resumes.type === 'ready' ? page.resumes.all : []
  const roles = page.roles.type === 'ready' ? page.roles.all : []
  return {
    wants: page.form.interviewType.type === 'cold' ? 'cold' : 'hot',
    resumes,
    resumeId: resumes[0]?.[0] ?? null,
    resumeProcessing: null,
    loadedResumeId: null,
    roles,
    roleId: null,
    addedRoleId: null,
    jdProcessing: false,
    roleDetail: { type: 'none' },
    questionsOpen: false,
    existing: 'keep',
    source: 'generate',
    questionUpload: { type: 'none' },
    ai: page.form.ai,
  }
}

/** A newly chosen role starts over: its detail is loaded, and the questions choices go back to their defaults. */
const freshRole = (s: SetupState, roleId: RoleId, added: RoleId | null): SetupState => ({
  ...s,
  roleId,
  addedRoleId: added,
  roleDetail: { type: 'loading', roleId },
  questionsOpen: false,
  existing: 'keep',
  source: 'generate',
  questionUpload: { type: 'none' },
})

export function setupReducer(s: SetupState, a: SetupAction): SetupState {
  switch (a.type) {
    case 'wants':
      return { ...s, wants: a.wants }
    case 'pickResume':
      return { ...s, resumeId: a.resumeId, loadedResumeId: null }
    case 'resumeProcessing':
      return { ...s, resumeProcessing: a.fileName }
    case 'resumeProcessed':
      // The new resume is newest, and selected at once.
      return {
        ...s,
        resumeProcessing: null,
        resumes: [[a.processed.resumeId, a.processed.displayName], ...s.resumes],
        resumeId: a.processed.resumeId,
        loadedResumeId: a.processed.resumeId,
      }
    case 'resumeFailed':
      return { ...s, resumeProcessing: null }
    case 'pickRole':
      return a.roleId === s.roleId ? s : freshRole(s, a.roleId, null)
    case 'jdProcessing':
      return { ...s, jdProcessing: true }
    case 'jdProcessed':
      return freshRole({ ...s, jdProcessing: false, roles: [...s.roles, [a.processed.roleId, a.processed.displayName]] }, a.processed.roleId, a.processed.roleId)
    case 'jdFailed':
      return { ...s, jdProcessing: false }
    case 'roleLoaded':
      // An answer for a role the user has moved on from is dropped.
      return a.detail.roleId === s.roleId ? { ...s, roleDetail: { type: 'ready', detail: a.detail } } : s
    case 'roleFailed':
      return a.roleId === s.roleId ? { ...s, roleDetail: { type: 'failed', roleId: a.roleId, message: a.message } } : s
    case 'roleRetry':
      return s.roleId === null ? s : { ...s, roleDetail: { type: 'loading', roleId: s.roleId } }
    case 'toggleQuestions':
      return { ...s, questionsOpen: !s.questionsOpen }
    case 'existing':
      return { ...s, existing: a.existing }
    case 'source':
      return { ...s, source: a.source }
    case 'questionsProcessing':
      return { ...s, questionUpload: { type: 'processing', fileName: a.fileName } }
    case 'questionsProcessed':
      return { ...s, questionUpload: { type: 'ready', processed: a.processed } }
    case 'questionsFailed':
      return { ...s, questionUpload: { type: 'none' } }
    case 'ai':
      return { ...s, ai: { ...s.ai, [a.slot]: a.choice } }
  }
}

/** The contract's interviewType. Hot without a settled resume is `hot-incomplete=>cold`: the server would run it cold. */
export function interviewTypeOf(s: SetupState): InterviewType {
  if (s.wants === 'cold') return { type: 'cold' }
  if (s.resumeProcessing !== null || s.resumeId === null) return { type: 'hot-incomplete=>cold' }
  return { type: 'hot', resumeId: s.resumeId }
}

/** The contract's JobDescriptionValidation. `required` only when the server had no roles. */
export function roleValidation(s: SetupState): JobDescriptionValidation {
  if (s.jdProcessing) return { type: 'loading' }
  if (s.roleId !== null) return { type: 'ready', roleId: s.roleId }
  return { type: s.roles.length === 0 ? 'required' : 'unanswered' }
}

/**
 * Why the Role set up button on Application setup is not available: only while a hot interview
 * has no resume at all. A resume that is uploading counts (specs/page-flow.md, section 1).
 */
export function setupBlockers(s: SetupState): string[] {
  return s.wants === 'hot' && s.resumeId === null && s.resumeProcessing === null ? ['Pick or load a resume, or switch to a cold interview.'] : []
}

// ---- The role's questions (design/mockups/ui/RoleSetup.dc.html and RoleQuestions.dc.html) ----

/** The three starting cases of the questions panel, once the role's detail is known. */
export type RoleCase = 'new' | 'existing-missing' | 'existing-has'

export function roleCase(s: SetupState): RoleCase | null {
  if (s.roleId === null || s.roleDetail.type !== 'ready') return null
  if (s.addedRoleId === s.roleId) return 'new'
  return s.roleDetail.detail.questions.type === 'ready' ? 'existing-has' : 'existing-missing'
}

export const savedQuestionCount = (s: SetupState): number => (s.roleDetail.type === 'ready' && s.roleDetail.detail.questions.type === 'ready' ? s.roleDetail.detail.questions.all.length : 0)

/** While the host looks the role up: the Setup questions button is disabled and Prepare waits. */
export const questionsChecking = (s: SetupState): boolean => s.roleId !== null && s.roleDetail.type === 'loading'

/** The Setup questions button exists for an existing role; a new role's panel opens by itself. */
export const showSetupButton = (s: SetupState): boolean => s.roleId !== null && s.addedRoleId !== s.roleId && !s.jdProcessing

export const purging = (s: SetupState): boolean => roleCase(s) === 'existing-has' && s.existing === 'purge'

export const panelOpen = (s: SetupState): boolean => roleCase(s) === 'new' || (s.questionsOpen && roleCase(s) !== null)

/** Whether the generate-or-upload choice shows: always, unless saved questions are being kept. */
export const showSource = (s: SetupState): boolean => roleCase(s) !== 'existing-has' || purging(s)

/** What goes to the server. Upload chosen with no file never gets here: roleBlockers stops Prepare. */
export function questionPlan(s: SetupState): QuestionPlan {
  if (roleCase(s) === 'existing-has' && s.existing === 'keep') return { type: 'keep' }
  if (s.source === 'upload' && s.questionUpload.type === 'ready') return { type: 'uploaded', questionSetId: s.questionUpload.processed.questionSetId }
  return { type: 'generate' }
}

/** Why Prepare interview is not available yet, in the Role set up board's words. Empty means ready. Uploads never block. */
export function roleBlockers(s: SetupState): string[] {
  const out: string[] = []
  const role = roleValidation(s).type
  if (role === 'unanswered') out.push('Choose a role focus.')
  if (role === 'required') out.push('Add a job description. No roles are saved yet.')
  if (questionsChecking(s)) out.push('Wait while we check whether this role has questions.')
  if (s.roleDetail.type === 'failed') out.push(`We could not check this role's questions. ${s.roleDetail.message}`)
  if (panelOpen(s) && showSource(s) && s.source === 'upload' && s.questionUpload.type !== 'ready') out.push('Choose your questions file, or let the AI write them.')
  return out
}

/** The note beside the Setup questions button: the default, the loaded questions, or the user's own file. */
export function questionsNote(s: SetupState): { lead: string; note: string } {
  const title = displayNameOf(s.roles, s.roleId) ?? 'this role'
  const count = savedQuestionCount(s)
  if (questionsChecking(s)) return { lead: 'Checking.', note: `Looking for saved questions for ${title}…` }
  if (roleCase(s) === 'existing-has') {
    return purging(s)
      ? { lead: 'Purge chosen.', note: `The ${count} saved questions are purged when you prepare the interview.` }
      : { lead: 'Already loaded.', note: `${count} questions are saved for ${title}. They are kept unless you change them.` }
  }
  if (s.source === 'upload' && panelOpen(s)) return { lead: 'Your own questions.', note: uploadWords(s) }
  return { lead: 'Default.', note: 'The AI will write the questions.' }
}

const uploadWords = (s: SetupState): string =>
  s.questionUpload.type === 'ready' ? s.questionUpload.processed.displayName : s.questionUpload.type === 'processing' ? `Uploading ${s.questionUpload.fileName}…` : 'Choose a file.'

/** The Questions line of "Your setup so far". */
export function questionsSummary(s: SetupState): string {
  if (s.roleId === null) return 'After you choose a role'
  if (questionsChecking(s)) return 'Checking…'
  if (roleCase(s) === 'existing-has' && s.existing === 'keep') return `${savedQuestionCount(s)} saved questions, kept`
  if (s.source === 'upload' && panelOpen(s)) {
    return s.questionUpload.type === 'ready' ? s.questionUpload.processed.displayName : s.questionUpload.type === 'processing' ? 'Uploading…' : 'Choose a file'
  }
  return 'The AI writes them (default)'
}

/** The form the server receives. Only call when `roleBlockers` is empty: the server rejects anything else. */
export function toForm(s: SetupState): ApplicationSetupForm {
  return { ai: s.ai, interviewType: interviewTypeOf(s), roleFocus: s.roleId ?? 'unanswered', questions: questionPlan(s) }
}

/** What the Waiting room needs to know about where the materials came from. */
export function materialsOf(s: SetupState): Materials {
  const plan = questionPlan(s).type
  return {
    hot: interviewTypeOf(s).type === 'hot',
    roleSource: s.addedRoleId !== null && s.addedRoleId === s.roleId ? 'uploaded' : 'saved',
    questions: plan === 'keep' ? 'kept' : plan === 'uploaded' ? 'uploaded' : 'generate',
  }
}

export const displayNameOf = (list: Saved, id: string | null): DisplayName | null => list.find(([i]) => i === id)?.[1] ?? null
