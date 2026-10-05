import { generateScript, type MockInterviewOptions, type TurnPolicy, type UserSpan } from './mockInterviewer.ts'
import type { MockScript } from './script.ts'

// Presets are PROPOSALS to tune, anchored in docs/research/micro-pauses-and-run-ons.md:
// eager uses LiveKit's 0.5 s minimum endpointing delay, patient uses Pipecat's 3.0 s silence
// fallback, balanced sits between. All figures there are [unverified] until measured.

export const eager: TurnPolicy = {
  name: 'eager',
  description: 'Decides the turn is over after 500 ms of silence. Cuts candidates off at ordinary pauses.',
  response_window_ms: 5000,
  endpointing_ms: 500,
  thinking_ms: 400,
  on_user_resumes: 'yield',
}

export const balanced: TurnPolicy = {
  name: 'balanced',
  description: 'Waits 1.5 s. Survives a breath, but not a long thinking pause.',
  response_window_ms: 8000,
  endpointing_ms: 1500,
  thinking_ms: 600,
  on_user_resumes: 'yield',
}

export const patient: TurnPolicy = {
  name: 'patient',
  description: 'Waits 3 s. Survives long thinking pauses, but answers feel slow to finish.',
  response_window_ms: 10000,
  endpointing_ms: 3000,
  thinking_ms: 600,
  on_user_resumes: 'yield',
}

export const policies: readonly TurnPolicy[] = [eager, balanced, patient]

/**
 * An answer shaped like the recordings in src/design/PROTOTYPES.MD (fixtures 3 and 5): a pause
 * before the first word, a short breath pause, then a long thinking pause mid-answer.
 */
export const answerWithThinkingPause: UserSpan[] = [
  { start_ms: 1200, end_ms: 4200, text: 'I led a migration of our billing system' },
  { start_ms: 4900, end_ms: 8400, text: 'to a new provider' }, // 700 ms breath pause before this
  { start_ms: 10900, end_ms: 14000, text: 'and the hardest part was the data cutover' }, // 2,500 ms thinking pause before this
]

export const baseOptions = {
  question: { text: 'Tell me about a project you are proud of.', speak_ms: 2500 },
  reply: { text: 'Thanks. Can you walk me through how you handled the risks?', speak_ms: 3000 },
  premature_reply: { text: 'Okay, thank you. Next question.', speak_ms: 2500 },
  prompt: { text: 'Take your time.', speak_ms: 1200 },
  user_spans: answerWithThinkingPause,
} satisfies Partial<MockInterviewOptions>

export function calibrationScript(policy: TurnPolicy): MockScript {
  return generateScript({
    ...baseOptions,
    name: `turn-${policy.name}`,
    description: `${policy.description} The user answers with a breath pause (700 ms) and a thinking pause (2,500 ms).`,
    covers: ['CUE-STA-001', 'CUE-STA-003', 'CUE-MOD-005', 'micro-pauses P3'],
    policy,
  })
}
