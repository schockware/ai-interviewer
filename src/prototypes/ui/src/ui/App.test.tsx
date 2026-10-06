import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App shell', () => {
  it('starts not started, with no announcement', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('cue-label')).toHaveTextContent('Not started')
    expect(screen.getByTestId('announcement')).toBeEmptyDOMElement()
  })

  it('offers all three cue modes as radio buttons, with perceived chosen (CUE-MOD-001)', () => {
    render(<App />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Perceived/ })).toBeChecked()
  })

  it('says the modes look the same while no simulation is active (CUE-MOD-003)', () => {
    render(<App />)
    expect(screen.getByTestId('modes-note')).toHaveTextContent(/look the same/)
  })

  it('switching to debug draws both timelines at once (CUE-MOD-002)', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('radio', { name: /Debug/ }))
    expect(screen.getByTestId('lanes')).toBeInTheDocument()
  })

  it('can be operated by keyboard: the controls are reachable in order', async () => {
    render(<App />)
    await userEvent.tab()
    expect(screen.getByRole('combobox', { name: /Scenario/ })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Start' })).toHaveFocus()
  })
})
