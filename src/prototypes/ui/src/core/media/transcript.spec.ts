// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: specs/transcription STT-STR-002 (a final replaces the partials it names) as the page applies it. Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import type { TranscriptSegment } from '../contract/pageFlow.ts'
import { emptyTranscript, failuresOf, linesOf, producerOf, withFailure, withSegment, withSnapshot } from './transcript.ts'

const seg = (id: string, text: string, final: boolean, replaces: string[] = [], source: TranscriptSegment['source'] = 'real-time', start = 0): TranscriptSegment => ({
  sessionId: 's1',
  questionId: 'q1',
  id,
  startSeconds: start,
  endSeconds: start + 1,
  text,
  final,
  replaces,
  source,
  model: source === 'real-time' ? 'realtime:base' : 'post:large',
  device: source === 'real-time' ? 'cpu' : 'cuda',
})

describe('the page’s transcript', () => {
  it('replaces the partials a piece names, and keeps time order', () => {
    let state = withSegment(emptyTranscript, seg('p1', 'I led', false, [], 'real-time', 0))
    state = withSegment(state, seg('p2', 'I led the migration', false, ['p1'], 'real-time', 0))
    expect(linesOf(state, 'real-time').map((s) => s.text)).toEqual(['I led the migration'])
    state = withSegment(state, seg('f1', 'I led the migration of billing.', true, ['p2'], 'real-time', 0))
    state = withSegment(state, seg('p3', 'which cut', false, [], 'real-time', 3))
    expect(linesOf(state, 'real-time').map((s) => s.text)).toEqual(['I led the migration of billing.', 'which cut'])
  })

  it('keeps the two passes apart, even with the same ids', () => {
    let state = withSegment(emptyTranscript, seg('1', 'live words', true))
    state = withSegment(state, seg('1', 'careful words', true, [], 'post-question'))
    expect(linesOf(state, 'real-time').map((s) => s.text)).toEqual(['live words'])
    expect(linesOf(state, 'post-question').map((s) => s.text)).toEqual(['careful words'])
    expect(producerOf(state, 'post-question')).toBe('post:large on cuda')
  })

  it('drops an empty final from the lines but lets it retire partials', () => {
    let state = withSegment(emptyTranscript, seg('p1', 'half a', false))
    state = withSegment(state, seg('f1', '', true, ['p1']))
    expect(linesOf(state, 'real-time')).toEqual([])
  })

  it('folds a snapshot in order and keeps failures by pass', () => {
    const state = withFailure(
      withSnapshot(emptyTranscript, {
        segments: [seg('p1', 'a', false), seg('f1', 'a b', true, ['p1'])],
        failures: [{ sessionId: 's1', questionId: 'q1', source: 'post-question', message: 'down' }],
      }),
      { sessionId: 's1', questionId: 'q1', source: 'real-time', message: 'gone' },
    )
    expect(linesOf(state, 'real-time').map((s) => s.text)).toEqual(['a b'])
    expect(failuresOf(state, 'post-question').map((f) => f.message)).toEqual(['down'])
    expect(failuresOf(state, 'real-time').map((f) => f.message)).toEqual(['gone'])
  })
})
