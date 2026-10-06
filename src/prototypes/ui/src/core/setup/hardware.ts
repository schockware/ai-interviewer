// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { HardwareCheck, HardwareKind, HardwareQuality, HardwareSetupForm, PrepProgress } from '../contract/pageFlow.ts'

/** Where one check is. `checking` is page-local; the contract has no such status. */
export type CheckPhase = { type: 'pending' | 'skipped' | 'checking' | 'errored' } | { type: 'done'; quality: Exclude<HardwareQuality, 'pending' | 'skipped'> }

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

export interface CheckView {
  chip: string
  tone: Tone
  detail: string
  action: string
}

const SAMPLE = '[SAMPLE SENTENCE]'
export const audioPrompt = (phase: CheckPhase): string =>
  phase.type === 'errored'
    ? 'We could not reach this device.'
    : phase.type === 'checking'
      ? `Keep reading: ${SAMPLE}`
      : `Read this sentence aloud when you start: ${SAMPLE}`

/** Words for one check, from the Hardware board. `kind` only changes the first-use wording. */
export function checkView(phase: CheckPhase, kind: HardwareKind): CheckView {
  const camera = kind === 'video'
  switch (phase.type) {
    case 'pending':
      return {
        chip: 'Not checked yet',
        tone: 'neutral',
        detail: camera ? 'Start the check to see how you look on camera.' : 'Start the check to see how your voice comes through.',
        action: camera ? 'Start camera check' : 'Start audio check',
      }
    case 'skipped':
      return { chip: 'Skipped', tone: 'neutral', detail: 'You are not using video. You can still run the interview.', action: 'Check camera' }
    case 'checking':
      return {
        chip: 'Checking',
        tone: 'warn',
        detail: camera ? 'Looking at your camera feed.' : 'Listening to your voice. This takes a few seconds.',
        action: 'Checking…',
      }
    case 'errored':
      return {
        chip: 'Could not check',
        tone: 'bad',
        detail: 'Check that it is plugged in and allowed in your browser, then try again.',
        action: 'Try again',
      }
    case 'done':
      return { ...qualityViews[phase.quality], action: 'Check again' }
  }
}

const qualityViews: Record<Exclude<HardwareQuality, 'pending' | 'skipped'>, Omit<CheckView, 'action'>> = {
  clear: { chip: 'Clear', tone: 'ok', detail: 'Your voice is coming through clearly.' },
  intermittent: {
    chip: 'Intermittent',
    tone: 'warn',
    detail: 'Parts of your voice drop out. You can continue, and the interviewer may ask you to repeat yourself.',
  },
  readable: { chip: 'Readable', tone: 'warn', detail: 'You can be understood, with some noise. You can continue.' },
  unreadable: {
    chip: 'Unreadable',
    tone: 'bad',
    detail: 'The interviewer cannot understand you yet. Move closer to the microphone, or pick another one, then check again.',
  },
}

/** Audio is required, and good enough to continue unless it is unreadable or errored. */
export const audioPasses = (phase: CheckPhase): boolean =>
  phase.type === 'done' && phase.quality !== 'unreadable'

export const canStart = (prep: PrepProgress, audio: CheckPhase): boolean => prep === 'ready' && audioPasses(audio)

export interface HostView {
  title: string
  body: string
  tone: Tone
  busy: boolean
}

export const hostView: Record<PrepProgress, HostView> = {
  preparing: { title: 'Waiting for host…', body: 'The interviewer is building your interview. You can set up your hardware while you wait.', tone: 'warn', busy: true },
  retrying: { title: 'Waiting for host…', body: 'This is taking a little longer than usual. We are retrying quietly, and you can keep going.', tone: 'warn', busy: true },
  diagnosing: { title: 'The host ran into a problem', body: 'We tried again and it did not work. The interviewer is checking what went wrong.', tone: 'bad', busy: false },
  ready: { title: 'The host is ready', body: 'Your interview is prepared. Finish the audio check to start.', tone: 'ok', busy: false },
}

export interface BarView {
  label: string
  note: string
  /** null is indeterminate: no value is claimed (ARIA progressbar without aria-valuenow). */
  now: number | null
  tone: Tone
}

/** The percentages are the board's illustration. The real server reports no percentage (open item). */
export const barView: Record<PrepProgress, BarView> = {
  preparing: { label: 'Preparing your interview', note: 'Setting up the interviewer', now: 45, tone: 'ok' },
  retrying: { label: 'Preparing your interview', note: 'Taking longer than usual. Retrying', now: 62, tone: 'warn' },
  diagnosing: { label: 'Preparing your interview', note: 'Checking what went wrong', now: null, tone: 'warn' },
  ready: { label: 'Your interview is ready', note: '', now: 100, tone: 'ok' },
}

export interface ChecklistItem {
  name: string
  state: string
  tone: Tone
}

/** The list under Start interview, so a disabled button is always explained. */
export function checklist(prep: PrepProgress, audio: CheckPhase, video: CheckPhase): ChecklistItem[] {
  const audioView = checkView(audio, 'audio')
  return [
    {
      name: 'Interview prepared',
      state: prep === 'ready' ? 'done' : prep === 'diagnosing' ? 'needs attention' : 'still preparing',
      tone: prep === 'ready' ? 'ok' : prep === 'diagnosing' ? 'bad' : 'warn',
    },
    {
      name: 'Audio',
      state: audioPasses(audio)
        ? `verified, rated ${audioView.chip.toLowerCase()}`
        : audio.type === 'errored' || (audio.type === 'done' && audio.quality === 'unreadable')
          ? `needs attention: ${audioView.chip.toLowerCase()}`
          : 'not verified yet',
      tone: audioPasses(audio) ? 'ok' : audio.type === 'errored' || audio.type === 'done' ? 'bad' : 'warn',
    },
    { name: 'Video', state: `optional, ${checkView(video, 'video').chip.toLowerCase()}`, tone: 'neutral' },
  ]
}

const toCheck = (phase: CheckPhase): HardwareCheck => {
  switch (phase.type) {
    case 'pending':
    case 'checking':
      return { status: 'pending', quality: 'pending' }
    case 'skipped':
      return { status: 'skipped', quality: 'skipped' }
    case 'errored':
      return { status: 'errored', quality: 'unreadable' }
    case 'done':
      return { status: 'verified', quality: phase.quality }
  }
}

export const toHardwareForm = (audio: CheckPhase, video: CheckPhase, captions: boolean): HardwareSetupForm => ({
  audio: toCheck(audio),
  video: toCheck(video),
  training: { captions: captions ? 'enabled' : 'disabled' },
})
