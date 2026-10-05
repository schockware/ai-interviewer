import { describe, expect, it } from 'vitest'
import type { StreamEvent } from '../../core/contract/index.ts'
import { buildStream } from './buildStream.ts'
import { balanced, baseOptions, calibrationScript, eager, patient, policies } from './calibrations.ts'
import { generateScript } from './mockInterviewer.ts'

const stream = (policy = balanced) => buildStream(calibrationScript(policy)).events
const states = (events: StreamEvent[]) =>
  events.flatMap((e) => (e.type === 'state' ? [`${e.state}@${e.t_true_ms}`] : []))
const stateNames = (events: StreamEvent[]) => events.flatMap((e) => (e.type === 'state' ? [e.state] : []))
const decisions = (events: StreamEvent[]) => events.filter((e) => e.type === 'turn_decision')

// The answer fixture: spans 1200-4200, 4900-8400, 10900-14000 after the question ends.
// Pauses: 700 ms (breath) and 2,500 ms (thinking). The question ends at 100 + thinking_ms + 2500.
const listenStart = (thinkingMs: number) => 100 + thinkingMs + 2500

describe('mock interviewer calibrations (micro-pauses P3)', () => {
  it.each(policies)('$name script is a valid stream with ascending positions (EVT-CORE-003)', (p) => {
    const events = stream(p)
    expect(events.map((e) => e.position)).toEqual(events.map((_, i) => i))
  })

  it('patient survives both pauses: one decision, at the true end (CUE-MOD-005)', () => {
    const events = stream(patient)
    expect(decisions(events)).toHaveLength(1)
    expect(stateNames(events)).toEqual(['thinking', 'talking', 'listening', 'thinking', 'talking', 'listening'])
  })

  it('balanced survives the breath but is cut by the thinking pause', () => {
    const events = stream(balanced)
    expect(decisions(events).map((d) => d.type === 'turn_decision' && d.confidence)).toEqual([0.55, 0.93])
  })

  it('eager decides at every pause, and only the last decision is a true end', () => {
    const events = stream(eager)
    expect(decisions(events).map((d) => d.type === 'turn_decision' && d.confidence)).toEqual([0.55, 0.55, 0.93])
  })

  it('a decision lands one endpointing delay after the user stops speaking', () => {
    const t0 = listenStart(balanced.thinking_ms)
    const [early] = decisions(stream(balanced))
    expect(early?.t_true_ms).toBe(t0 + 8400 + balanced.endpointing_ms)
  })

  it('if the user resumes before the interviewer speaks, it goes back to listening without a word', () => {
    const t0 = listenStart(eager.thinking_ms)
    // Eager decides at span 1 end + 500 and would talk 400 ms later, but the user resumes at 4900.
    const timeline = states(stream(eager))
    expect(timeline).toContain(`thinking@${t0 + 4200 + 500}`)
    expect(timeline).toContain(`listening@${t0 + 4900}`)
    expect(timeline).not.toContain(`talking@${t0 + 4200 + 500 + 400}`)
  })

  it('yielding stops the voice at the moment the user resumes (policy yield)', () => {
    const t0 = listenStart(balanced.thinking_ms)
    const resumeAt = t0 + 10900
    const events = stream(balanced)
    const frames = events.filter((e) => e.type === 'audio_frame' && e.t_true_ms > t0)
    const earlyReplyFrames = frames.filter((e) => e.t_true_ms < t0 + 14000)
    expect(earlyReplyFrames.length).toBeGreaterThan(0)
    expect(earlyReplyFrames.every((e) => e.t_true_ms < resumeAt)).toBe(true)
    expect(states(events)).toContain(`listening@${resumeAt}`)
  })

  it('links cut-off text only to the frames that were actually produced (EVT-TYPE-006)', () => {
    const events = stream(balanced)
    const early = events.find((e) => e.type === 'interviewer_text' && e.id.startsWith('r-early'))
    const seqs = events.flatMap((e) => (e.type === 'audio_frame' ? [e.seq] : []))
    expect(early?.type === 'interviewer_text' && early.frames).toBeTruthy()
    if (early?.type === 'interviewer_text' && early.frames) {
      expect(seqs).toContain(early.frames.to_seq)
      // 10 500 to 10 900 ms of speech: 20 frames, not the 125 the full reply would need.
      expect(early.frames.to_seq - early.frames.from_seq + 1).toBe(20)
    }
  })

  it('continue lets the interviewer talk over the user (double-talk policy)', () => {
    const t0 = listenStart(balanced.thinking_ms)
    const events = buildStream(generateScript({ ...baseOptions, name: 'talk-over', description: '', covers: [], policy: { ...balanced, on_user_resumes: 'continue' } })).events
    const lastFrame = events.filter((e) => e.type === 'audio_frame' && e.t_true_ms < t0 + 14000).at(-1)
    expect(lastFrame!.t_true_ms).toBeGreaterThan(t0 + 10900)
  })

  it('a final transcript piece replaces exactly the partials since the last decision (EVT-TYPE-005)', () => {
    const finals = stream(eager).filter((e) => e.type === 'transcript' && e.final)
    expect(finals.map((f) => f.type === 'transcript' && f.replaces?.length)).toEqual([1, 1, 1])
    const balancedFinals = stream(balanced).filter((e) => e.type === 'transcript' && e.final)
    expect(balancedFinals.map((f) => f.type === 'transcript' && f.replaces?.length)).toEqual([2, 1])
  })

  it('prompts after the response window when the user stays silent', () => {
    const slow = generateScript({
      ...baseOptions,
      name: 'slow-start',
      description: '',
      covers: [],
      policy: balanced,
      user_spans: [{ start_ms: 12000, end_ms: 14000, text: 'Well, one project was a migration.' }],
    })
    const events = buildStream(slow).events
    const prompt = events.find((e) => e.type === 'interviewer_text' && e.id === 'prompt')
    expect(prompt?.t_true_ms).toBe(listenStart(balanced.thinking_ms) + balanced.response_window_ms)
  })

  it('does not prompt a user who starts speaking within the response window', () => {
    expect(stream(balanced).some((e) => e.type === 'interviewer_text' && e.id === 'prompt')).toBe(false)
  })

  it('has no perceived times: the true timeline only, simulation off (EVT-SIM-003)', () => {
    expect(stream(eager).every((e) => e.t_perceived_ms === undefined && e.dropped === undefined)).toBe(true)
  })
})
