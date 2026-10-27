// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the transcript card through its hook, with a host stood in for. Claude-written; not a human QA test.
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TranscriptListener } from '../core/ports.ts'
import type { SetupHost } from '../core/ports.ts'
import { TranscriptCard } from './TranscriptCard.tsx'
import { useTranscript } from './useTranscript.ts'

const fakeHost = () => {
  const listeners: TranscriptListener[] = []
  let stopped = 0
  const host = {
    watchTranscript: (_id: string, listener: TranscriptListener) => {
      listeners.push(listener)
      return () => {
        stopped += 1
      }
    },
  } as unknown as SetupHost
  return { host, listeners, stopped: () => stopped }
}

function Harness({ host, active }: { host: SetupHost; active: boolean }) {
  return <TranscriptCard transcript={useTranscript(host, 's1', active)} />
}

const segment = (id: string, text: string, final: boolean, replaces: string[], source: 'real-time' | 'post-question' = 'real-time') => ({
  sessionId: 's1',
  questionId: 'q1',
  id,
  startSeconds: 0,
  endSeconds: 1,
  text,
  final,
  replaces,
  source,
  model: source === 'real-time' ? 'realtime:base' : 'post:large-v3-turbo',
  device: source === 'real-time' ? 'cpu' : 'cuda',
})

describe('TranscriptCard', () => {
  it('waits until the interview starts, then shows partials set apart and finals in their place', () => {
    const { host, listeners } = fakeHost()
    const { rerender } = render(<Harness host={host} active={false} />)
    expect(screen.getByTestId('transcript-real-time')).toHaveTextContent('Starts with the interview.')
    expect(listeners).toHaveLength(0)

    rerender(<Harness host={host} active />)
    expect(screen.getByTestId('transcript-real-time')).toHaveTextContent('Listening for the first words…')
    act(() => listeners[0].snapshot({ segments: [], failures: [] }))
    act(() => listeners[0].segment(segment('p1', 'I led the', false, [])))
    expect(screen.getByTestId('transcript-real-time').querySelector('.transcript-partial')).toHaveTextContent('I led the')
    act(() => listeners[0].segment(segment('f1', 'I led the migration.', true, ['p1'])))
    expect(screen.getByTestId('transcript-real-time')).toHaveTextContent('I led the migration.')
    expect(screen.getByTestId('transcript-real-time')).not.toHaveTextContent('I led the I led')
    expect(screen.getByTestId('transcript-real-time')).toHaveTextContent('realtime:base on cpu')
  })

  it('shows the post-question pass apart, and a pass that could not run as a failure', () => {
    const { host, listeners } = fakeHost()
    render(<Harness host={host} active />)
    act(() => listeners[0].segment(segment('pq1', 'The careful version.', true, [], 'post-question')))
    expect(screen.getByTestId('transcript-post-question')).toHaveTextContent('The careful version.')
    expect(screen.getByTestId('transcript-post-question')).toHaveTextContent('post:large-v3-turbo on cuda')
    act(() => listeners[0].failed({ sessionId: 's1', questionId: 'q1', source: 'real-time', message: 'The transcriber is not running.' }))
    expect(screen.getByTestId('transcript-real-time')).toHaveTextContent('The transcriber is not running.')
    expect(screen.getAllByTestId('transcript-failure')).toHaveLength(1)
  })

  it('stops watching when the interview ends, and keeps what was said', () => {
    const { host, listeners, stopped } = fakeHost()
    const { rerender } = render(<Harness host={host} active />)
    act(() => listeners[0].segment(segment('f1', 'kept', true, [])))
    rerender(<Harness host={host} active={false} />)
    expect(stopped()).toBe(1)
    expect(screen.getByTestId('transcript-real-time')).toHaveTextContent('kept')
  })

  it('shows a hub it cannot reach', () => {
    const { host, listeners } = fakeHost()
    render(<Harness host={host} active />)
    act(() => listeners[0].error('Could not reach the API at /api for the transcript.'))
    expect(screen.getByTestId('transcript-card')).toHaveTextContent('Could not reach the API')
  })
})
