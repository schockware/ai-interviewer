// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { AiSlot } from '../contract/pageFlow.ts'

export const CUSTOM_LOCAL = 'Custom (local)…'
export const CLOUD = 'Cloud: [PROVIDER]'

export interface SlotView {
  slot: AiSlot
  label: string
  /** The first option is the default (contracts/page-flow.md). */
  options: readonly string[]
  note: string
}

/** The six model slots, in the order and wording of the Setup board. `{cloud}` is only offered where latency allows. */
export const SLOT_VIEWS: readonly SlotView[] = [
  { slot: 'listener', label: 'Listener', options: ['Default', 'Silero VAD + Smart Turn', CUSTOM_LOCAL], note: 'Detects when you are done speaking. Local only.' },
  { slot: 'transcriber', label: 'Transcriber', options: ['Default', 'whisper.cpp', CUSTOM_LOCAL], note: 'Turns your speech into text. Local only.' },
  { slot: 'speaker', label: 'Speaker', options: ['Default', 'Kokoro', 'Inflect-Nano-v1', CUSTOM_LOCAL], note: 'The interviewer’s voice. Local only.' },
  { slot: 'followUp', label: 'Follow-up questions', options: ['Same as interviewer', CUSTOM_LOCAL, CLOUD], note: 'Local or cloud.' },
  { slot: 'interviewer', label: 'Interviewer', options: ['Default', 'Qwen3.5 ladder', CUSTOM_LOCAL, CLOUD], note: 'Local or cloud.' },
  { slot: 'evaluator', label: 'Evaluator', options: ['Same as interviewer', CUSTOM_LOCAL, CLOUD], note: 'Scores your answers. Local or cloud.' },
]

export const defaultAi = (): Record<AiSlot, string> =>
  Object.fromEntries(SLOT_VIEWS.map((s) => [s.slot, s.options[0]])) as Record<AiSlot, string>

export const changedSlots = (ai: Record<AiSlot, string>): number => SLOT_VIEWS.filter((s) => ai[s.slot] !== s.options[0]).length
