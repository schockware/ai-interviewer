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

/** Ready for interview needs the audio check only; the Waiting room covers the rest (specs/page-flow.md, section 2). */
export const canStart = (audio: CheckPhase): boolean => audioPasses(audio)

export interface ChecklistItem {
  name: string
  state: string
  tone: Tone
}

/** The list under Ready for interview, so a disabled button is always explained and the waiting room is foretold. */
export function checklist(prep: PrepProgress, audio: CheckPhase, video: CheckPhase): ChecklistItem[] {
  const audioView = checkView(audio, 'audio')
  return [
    {
      name: 'Interview prepared',
      state: prep === 'ready' ? 'done' : prep === 'diagnosing' ? 'needs attention, shown in the waiting room' : 'still preparing, you can wait for it in the waiting room',
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
