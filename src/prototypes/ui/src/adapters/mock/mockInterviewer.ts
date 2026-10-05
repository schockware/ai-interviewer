import type { AudioRun, MockScript, ScriptEvent } from './script.ts'

/**
 * The mock interviewer's calibration: when it decides the user is done, how long it takes to
 * start talking, and what it does if the user starts again. This is what a real turn detector
 * and pipeline would be tuned to, and it is what makes a pause mean different things (see
 * docs/research/micro-pauses-and-run-ons.md). Every value in the presets is a proposal to tune.
 */
export interface TurnPolicy {
  name: string
  description: string
  /** Silence after the interviewer finishes before it prompts, if the user has not started (research §2.4, response window). */
  response_window_ms: number
  /** Silence after the user stops before the interviewer decides the turn is over (research §2.4, mid-answer vs end-of-answer). */
  endpointing_ms: number
  /** From the decision to the first spoken word: the pipeline floor plus any padding. */
  thinking_ms: number
  /** If the user speaks again while the interviewer is talking: stop (`yield`) or keep going (`continue`, a double-talk policy). */
  on_user_resumes: 'yield' | 'continue'
}

/** One stretch of the user's speech. The pauses between spans are the micro-pauses. Times are from the moment the interviewer's question ends. */
export interface UserSpan {
  start_ms: number
  end_ms: number
  text: string
}

export interface Utterance {
  text: string
  speak_ms: number
}

export interface MockInterviewOptions {
  name: string
  description: string
  covers: string[]
  policy: TurnPolicy
  question: Utterance
  /** What the interviewer says once it has decided the user is done and was right. */
  reply: Utterance
  /** What it says if it decided too early. */
  premature_reply: Utterance
  /** A short prompt used when the user stays silent past the response window. */
  prompt: Utterance
  /** One answer, as speech spans. The last span's end is the true end of the turn. */
  user_spans: UserSpan[]
}

const FRAME_MS = 20
const START_THINKING_AT_MS = 100

/**
 * Generates a script from a calibration and a recorded-style user answer. The generator knows the
 * ground truth (where the answer really ends), so it can mark a decision as a false cutoff.
 * Output goes through buildStream like any script, so it is checked against the contract.
 */
export function generateScript(o: MockInterviewOptions): MockScript {
  const { policy } = o
  const out: (ScriptEvent | AudioRun)[] = []
  let seq = 0
  let partialCount = 0

  const speak = (id: string, startMs: number, u: Utterance, stopAtMs = Infinity): number => {
    const endMs = Math.min(startMs + u.speak_ms, stopAtMs)
    const count = Math.max(0, Math.floor((endMs - startMs) / FRAME_MS))
    out.push({ type: 'state', t_true_ms: startMs, state: 'talking' })
    out.push({
      type: 'interviewer_text',
      t_true_ms: startMs,
      id,
      text: u.text,
      ...(count > 0 ? { frames: { from_seq: seq, to_seq: seq + count - 1 } } : {}),
    })
    if (count > 0) out.push({ type: 'audio_run', stream: 'voice', start_ms: startMs, seq_from: seq, count, dur_ms: FRAME_MS })
    seq += count
    return endMs
  }

  out.push({
    type: 'session',
    t_true_ms: 0,
    phase: 'started',
    config: { cue_mode: 'perceived', preset: 'clean', interface: 'both' },
  })
  out.push({ type: 'condition', t_true_ms: 0, preset: 'clean', params: {}, seed: 42 })

  // The question.
  out.push({ type: 'state', t_true_ms: START_THINKING_AT_MS, state: 'thinking' })
  const questionEnd = speak('q1', START_THINKING_AT_MS + policy.thinking_ms, o.question)
  out.push({ type: 'state', t_true_ms: questionEnd, state: 'listening' })

  const spans = o.user_spans.map((s) => ({ ...s, start: questionEnd + s.start_ms, end: questionEnd + s.end_ms }))
  const first = spans[0]
  if (!first) throw new Error(`Calibration "${o.name}" needs at least one user span`)

  // Response window: the interviewer prompts if the user stays silent too long.
  const promptAt = questionEnd + policy.response_window_ms
  if (first.start > promptAt + o.prompt.speak_ms) {
    const promptEnd = speak('prompt', promptAt, o.prompt)
    out.push({ type: 'state', t_true_ms: promptEnd, state: 'listening' })
  }

  let pending: { id: string; text: string }[] = []
  let endOfScript = questionEnd

  spans.forEach((span, i) => {
    out.push({ type: 'speech_activity', t_true_ms: span.start, activity: 'started' })
    const partialId = `u${++partialCount}`
    out.push({ type: 'transcript', t_true_ms: span.end, id: partialId, text: span.text, final: false })
    pending.push({ id: partialId, text: span.text })
    out.push({ type: 'speech_activity', t_true_ms: span.end, activity: 'stopped' })

    const nextStart = spans[i + 1]?.start ?? Infinity
    if (nextStart - span.end < policy.endpointing_ms) return // a micro-pause: the interviewer waits

    const isTrueEnd = i === spans.length - 1
    const decidedAt = span.end + policy.endpointing_ms
    out.push({ type: 'turn_decision', t_true_ms: decidedAt, confidence: isTrueEnd ? 0.93 : 0.55 })
    out.push({
      type: 'transcript',
      t_true_ms: decidedAt,
      id: `u${++partialCount}`,
      text: pending.map((p) => p.text).join(' '),
      final: true,
      replaces: pending.map((p) => p.id),
    })
    pending = []
    out.push({ type: 'state', t_true_ms: decidedAt, state: 'thinking' })

    const talkAt = decidedAt + policy.thinking_ms
    if (talkAt >= nextStart) {
      // The user started again before the interviewer said a word.
      out.push({ type: 'state', t_true_ms: nextStart, state: 'listening' })
      return
    }
    const utterance = isTrueEnd ? o.reply : o.premature_reply
    const stopAt = policy.on_user_resumes === 'yield' ? nextStart : Infinity
    const spokeUntil = speak(isTrueEnd ? 'r-final' : `r-early-${i + 1}`, talkAt, utterance, stopAt)
    out.push({ type: 'state', t_true_ms: spokeUntil, state: 'listening' })
    endOfScript = Math.max(endOfScript, spokeUntil)
  })

  out.push({ type: 'session', t_true_ms: endOfScript + 500, phase: 'ended' })

  return { name: o.name, description: o.description, covers: o.covers, session_id: `mock-${o.name}`, events: out }
}
