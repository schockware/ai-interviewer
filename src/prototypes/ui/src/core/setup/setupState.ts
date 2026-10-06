// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type {
  ApplicationSetupForm,
  ApplicationSetupPage,
  AiSlot,
  DisplayName,
  InterviewType,
  JobDescriptionProcessed,
  JobDescriptionValidation,
  ResumeId,
  ResumeProcessed,
  Saved,
  RoleId,
} from '../contract/pageFlow.ts'

/**
 * Local state of the Application setup page. The contract's ResumeValidation and
 * JobDescriptionValidation are "stored as local state until the upload returns", so they are
 * derived from this, never stored twice.
 */
export interface SetupState {
  wants: 'cold' | 'hot'
  resumes: Saved
  resumeId: ResumeId | null
  /** The file being processed, or null. */
  resumeProcessing: string | null
  roles: Saved
  roleId: RoleId | null
  jdProcessing: boolean
  ai: Record<AiSlot, string>
}

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
  | { type: 'ai'; slot: AiSlot; choice: string }

/** From a ready page. Resumes are newest first, and the first is the one picked last (the mock server has no separate "last picked"). */
export function initialSetup(page: Extract<ApplicationSetupPage, { type: 'ready' }>): SetupState {
  const resumes = page.resumes.type === 'ready' ? page.resumes.all : []
  const roles = page.roles.type === 'ready' ? page.roles.all : []
  return {
    wants: page.form.interviewType.type === 'cold' ? 'cold' : 'hot',
    resumes,
    resumeId: resumes[0]?.[0] ?? null,
    resumeProcessing: null,
    roles,
    roleId: null,
    jdProcessing: false,
    ai: page.form.ai,
  }
}

export function setupReducer(s: SetupState, a: SetupAction): SetupState {
  switch (a.type) {
    case 'wants':
      return { ...s, wants: a.wants }
    case 'pickResume':
      return { ...s, resumeId: a.resumeId }
    case 'resumeProcessing':
      return { ...s, resumeProcessing: a.fileName }
    case 'resumeProcessed':
      // The new resume is newest, and selected at once.
      return {
        ...s,
        resumeProcessing: null,
        resumes: [[a.processed.resumeId, a.processed.displayName], ...s.resumes],
        resumeId: a.processed.resumeId,
      }
    case 'resumeFailed':
      return { ...s, resumeProcessing: null }
    case 'pickRole':
      return { ...s, roleId: a.roleId }
    case 'jdProcessing':
      return { ...s, jdProcessing: true }
    case 'jdProcessed':
      return {
        ...s,
        jdProcessing: false,
        roles: [...s.roles, [a.processed.roleId, a.processed.displayName]],
        roleId: a.processed.roleId,
      }
    case 'jdFailed':
      return { ...s, jdProcessing: false }
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

/** Why Prepare interview is not available yet, in the Setup board's words. Empty means ready. */
export function blockers(s: SetupState): string[] {
  const out: string[] = []
  if (s.wants === 'hot') {
    if (s.resumeProcessing !== null) out.push('Wait for your resume to finish processing.')
    else if (s.resumeId === null) out.push('Pick or load a resume, or switch to a cold interview.')
  }
  const role = roleValidation(s).type
  if (role === 'unanswered') out.push('Choose a role focus.')
  if (role === 'loading') out.push('Wait for the job description to finish processing.')
  if (role === 'required') out.push('Add a job description. No roles are saved yet.')
  return out
}

/** The form the server receives. Only call when `blockers` is empty: the server rejects anything else. */
export function toForm(s: SetupState): ApplicationSetupForm {
  return { ai: s.ai, interviewType: interviewTypeOf(s), roleFocus: s.roleId ?? 'unanswered' }
}

export const displayNameOf = (list: Saved, id: string | null): DisplayName | null => list.find(([i]) => i === id)?.[1] ?? null
