import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import InterviewPage from './InterviewPage.tsx'

function App() {
  const [captions, setCaptions] = useState(false)
  return <InterviewPage captions={captions} onCaptions={setCaptions} onOpenAccessibility={() => {}} />
}

describe('Interview page', () => {
  it('starts not started, with no announcement', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('cue-label')).toHaveTextContent('Not started')
    expect(screen.getByTestId('announcement')).toBeEmptyDOMElement()
  })

  it('offers all three cue modes in "Cues follow", with perceived chosen (CUE-MOD-001)', () => {
    render(<App />)
    const select = screen.getByRole('combobox', { name: 'Cues follow' })
    expect(within(select).getAllByRole('option')).toHaveLength(3)
    expect(select).toHaveValue('perceived')
  })

  it('says the modes look the same while no simulation is active (CUE-MOD-003)', () => {
    render(<App />)
    expect(screen.getByTestId('modes-note')).toHaveTextContent(/look the same/)
  })

  it('switching to debug draws both timelines at once (CUE-MOD-002)', async () => {
    render(<App />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Cues follow' }), 'debug')
    expect(screen.getByTestId('lanes')).toBeInTheDocument()
  })

  it('puts the Accessibility button first in focus, as in the mockup', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Accessibility' })).toHaveFocus()
  })

  it('shows captions off by default and turns them on from the button', async () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Captions: off' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Captions: off' }))
    expect(screen.getByRole('region', { name: 'Captions' })).toBeInTheDocument()
  })

  it('says why captions are off when asked (and the help starts open, as in the mockup)', async () => {
    render(<App />)
    const why = screen.getByRole('button', { name: 'Why are captions off?' })
    expect(why).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(why)
    expect(why).toHaveAttribute('aria-expanded', 'false')
  })
})
