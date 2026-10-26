// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Types transcribed from contracts/page-flow.md (Steven's draft). Pure types, no framework or transport.
// Where the contract leaves a shape open ({custom-local}, {cloud}) the shapes here are the API prototype's proposal.

export type SessionId = string
export type ResumeId = string
export type RoleId = string
export type DisplayName = string

export const AI_SLOTS = ['listener', 'transcriber', 'followUp', 'interviewer', 'evaluator', 'speaker'] as const
export type AiSlot = (typeof AI_SLOTS)[number]

export type InterviewType = { type: 'cold' } | { type: 'hot-incomplete=>cold' } | { type: 'hot'; resumeId: ResumeId }

/**
 * A named option is its contract string ("default", "whisper.cpp", "interviewer").
 * PROPOSAL, from the API prototype: `{custom-local}` and `{cloud}` are these two objects.
 */
export type SlotChoice = string | { type: 'custom-local' } | { type: 'cloud' }

export interface ApplicationSetupForm {
  ai: Record<AiSlot, SlotChoice>
  interviewType: InterviewType
  roleFocus: 'unanswered' | RoleId
}

export type Saved = ReadonlyArray<readonly [id: string, displayName: DisplayName]>
export type LoadedResumes = { type: 'none' } | { type: 'ready'; all: Saved }
export type LoadedRoles = { type: 'none' } | { type: 'ready'; all: Saved }

export type ApplicationSetupPage =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'ready'; form: ApplicationSetupForm; resumes: LoadedResumes; roles: LoadedRoles }

export type ResumeValidation = { type: 'hot-incomplete=>cold' } | { type: 'hot'; resumeId: ResumeId }
export type JobDescriptionValidation = { type: 'required' | 'unanswered' | 'loading' } | { type: 'ready'; roleId: RoleId }

export interface UploadResume {
  displayName: DisplayName
  fileName: string
  payload: Uint8Array
}
export interface ResumeProcessed {
  resumeId: ResumeId
  displayName: DisplayName
}
export interface JobDescriptionUpload {
  displayName: DisplayName
  fileName: string
  payload: Uint8Array
}
export interface JobDescriptionPaste {
  displayName: DisplayName
  text: string
}
export interface JobDescriptionProcessed {
  roleId: RoleId
  displayName: DisplayName
}
export interface PrepareInterview {
  form: ApplicationSetupForm
  sessionId: SessionId
}

export type HardwareStatus = 'pending' | 'skipped' | 'verified' | 'errored'
export type HardwareQuality = 'pending' | 'skipped' | 'clear' | 'intermittent' | 'readable' | 'unreadable'
export interface HardwareCheck {
  status: HardwareStatus
  quality: HardwareQuality
}
export interface AdvancedTrainingOptions {
  captions: 'disabled' | 'enabled'
}
export interface HardwareSetupForm {
  audio: HardwareCheck
  video: HardwareCheck
  training: AdvancedTrainingOptions
}
export interface StartInterview {
  form: HardwareSetupForm
  sessionId: SessionId
}
export type HardwareKind = 'audio' | 'video'

/**
 * What the Hardware board shows about preparation. The contract's InterviewPrepared only says
 * ok or error; `retrying` and `diagnosing` are the board's states for what the server does after
 * an error (retry quietly, then CheckErroredInterview). PROPOSAL: the server reports these.
 */
export type PrepProgress = 'preparing' | 'retrying' | 'diagnosing' | 'ready'

/**
 * One preparation report. PROPOSAL: `stepsDone` counts the preparation steps the server has
 * finished, out of the Waiting room's list (core/setup/waitingRoom.ts, PREP_STEP_TOTAL), so the
 * room can show each one. The contract's InterviewPrepared has no steps; a real server would
 * report them itself, and how it delivers them is undecided.
 */
export interface PrepReport {
  progress: PrepProgress
  stepsDone: number
}

/** What the server sends back when the interview starts (contracts/page-flow.md, CueSettings). */
export interface CueSettings {
  emulation: {
    cadences: { speaking: number; listening: number; thinking: number; variances: { floor: number; ceiling: number } }
    latencies: { network: number; packetLossVariancePerSecond: number; audioRamp: 'clipped-beginning' | 'clipped-ending' | 'both' }
  }
}

/**
 * PROPOSAL (API prototype): the processing of an uploaded resume, reported step by step over the
 * InterviewHub after POST /resumes has answered. Every report is a whole snapshot, so a late
 * listener needs only the latest one. The contract has no shape for this yet.
 */
export type UploadStepStatus = 'pending' | 'running' | 'done' | 'failed'
export interface ResumeUploadStep {
  name: string
  status: UploadStepStatus
}
export type ResumeUploadStatus = 'running' | 'done' | 'failed'
export interface ResumeUploadProgress {
  resumeId: ResumeId
  displayName: DisplayName
  status: ResumeUploadStatus
  steps: ResumeUploadStep[]
}
