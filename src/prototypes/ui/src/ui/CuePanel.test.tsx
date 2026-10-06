import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { initialState, reduce, type CuePayload } from '../core/cues/index.ts'
import { CuePanel } from './CuePanel.tsx'

const payloadFor = (state: 'listening' | 'thinking' | 'talking' | 'paused'): CuePayload =>
  reduce(initialState('true_state'), {
    type: 'event',
    nowMs: 0,
    event: { type: 'state', session_id: 's', position: 0, t_true_ms: 0, state },
  }).payload

describe('CuePanel renders the payload as received', () => {
  it.each([
    ['listening', 'Your turn'],
    ['thinking', 'Interviewer is thinking'],
    ['talking', 'Interviewer is speaking'],
    ['paused', 'Paused'],
  ] as const)('shows the words for %s next to the icon (CUE-RED-002)', (state, words) => {
    render(<CuePanel payload={payloadFor(state)} />)
    expect(screen.getByTestId('cue-label')).toHaveTextContent(words)
  })

  it('hides the icon from assistive technology, since the words carry the meaning (CUE-RED-002)', () => {
    const { container } = render(<CuePanel payload={payloadFor('listening')} />)
    expect(container.querySelector('.cue-icon')).toHaveAttribute('aria-hidden', 'true')
  })

  it('announces nothing on load, then the change in a polite live region (CUE-ANN-001)', () => {
    const { rerender } = render(<CuePanel payload={initialState().payload} />)
    expect(screen.getByTestId('announcement')).toBeEmptyDOMElement()
    rerender(<CuePanel payload={payloadFor('listening')} />)
    const region = screen.getByTestId('announcement')
    expect(region).toHaveTextContent('Your turn')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the simulation badge only while a condition is simulated (CUE-SIM-001)', () => {
    const p = payloadFor('thinking')
    const { rerender } = render(<CuePanel payload={p} />)
    expect(screen.queryByTestId('simulation-badge')).toBeNull()
    rerender(<CuePanel payload={{ ...p, simulation: { active: true, preset: 'laggy_clipped' } }} />)
    expect(screen.getByTestId('simulation-badge')).toHaveTextContent('Simulated: laggy_clipped')
  })

  it('draws both lanes only when given them (debug)', () => {
    const p = payloadFor('thinking')
    const { rerender } = render(<CuePanel payload={p} />)
    expect(screen.queryByTestId('lanes')).toBeNull()
    rerender(<CuePanel payload={{ ...p, lanes: { trueState: 'talking', perceivedState: 'thinking', offsetMs: 800 } }} />)
    expect(screen.getByTestId('lanes')).toHaveTextContent('800 ms')
  })
})
