// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { AiSlot, SlotChoice } from '../contract/pageFlow.ts'

export const CUSTOM_LOCAL: SlotChoice = { type: 'custom-local' }
export const CLOUD: SlotChoice = { type: 'cloud' }

export interface SlotOption {
  /** What the server receives. The first option of a slot is its default (contracts/page-flow.md). */
  choice: SlotChoice
  label: string
}

export interface SlotView {
  slot: AiSlot
  label: string
  options: readonly SlotOption[]
  note: string
}

const custom: SlotOption = { choice: CUSTOM_LOCAL, label: 'Custom (local)…' }
const cloud: SlotOption = { choice: CLOUD, label: 'Cloud: [PROVIDER]' }
const named = (name: string, label = name): SlotOption => ({ choice: name, label })

/** The six model slots, in the order and wording of the Setup board. `{cloud}` is only offered where latency allows. */
export const SLOT_VIEWS: readonly SlotView[] = [
  { slot: 'listener', label: 'Listener', options: [named('default', 'Default'), named('Silero VAD + Smart Turn'), custom], note: 'Detects when you are done speaking. Local only.' },
  { slot: 'transcriber', label: 'Transcriber', options: [named('default', 'Default'), named('whisper.cpp'), custom], note: 'Turns your speech into text. Local only.' },
  { slot: 'speaker', label: 'Speaker', options: [named('default', 'Default'), named('Kokoro'), named('Inflect-Nano-v1'), custom], note: 'The interviewer’s voice. Local only.' },
  { slot: 'followUp', label: 'Follow-up questions', options: [named('interviewer', 'Same as interviewer'), custom, cloud], note: 'Local or cloud.' },
  { slot: 'interviewer', label: 'Interviewer', options: [named('default', 'Default'), named('Qwen3.5 ladder'), custom, cloud], note: 'Local or cloud.' },
  { slot: 'evaluator', label: 'Evaluator', options: [named('interviewer', 'Same as interviewer'), custom, cloud], note: 'Scores your answers. Local or cloud.' },
]

/** A select option's value for a choice. Named choices are prefixed so no name can collide with the other two. */
export const choiceKey = (c: SlotChoice): string => (typeof c === 'string' ? `named:${c}` : c.type)

export const choiceFromKey = (slot: AiSlot, key: string): SlotChoice => {
  const found = SLOT_VIEWS.find((v) => v.slot === slot)?.options.find((o) => choiceKey(o.choice) === key)
  if (!found) throw new Error(`Slot ${slot} has no option ${key}`)
  return found.choice
}

export const defaultAi = (): Record<AiSlot, SlotChoice> =>
  Object.fromEntries(SLOT_VIEWS.map((s) => [s.slot, s.options[0].choice])) as Record<AiSlot, SlotChoice>

export const changedSlots = (ai: Record<AiSlot, SlotChoice>): number =>
  SLOT_VIEWS.filter((s) => choiceKey(ai[s.slot]) !== choiceKey(s.options[0].choice)).length
