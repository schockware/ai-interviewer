// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

// Real timers: the mock host's delays (under two seconds for these paths) are short enough.
const wait = { timeout: 4000 }

const toReadySetup = async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Interview type' }, wait)
}

const toHardware = async () => {
  await toReadySetup()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role title' }), 'Software Engineer')
  await userEvent.click(screen.getByRole('button', { name: /Prepare interview/ }))
  await screen.findByRole('heading', { level: 1, name: 'Check your setup' })
}

describe('Application setup page', () => {
  it('shows loading first, then the ready form, with Prepare interview unavailable and explained', async () => {
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your settings…')
    await screen.findByRole('heading', { name: 'Interview type' }, wait)
    expect(screen.getByRole('button', { name: /Prepare interview/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('blockers')).toHaveTextContent('Choose a role focus.')
  })

  it('opens the hot resume panel with the newest saved resume selected', async () => {
    await toReadySetup()
    await userEvent.click(screen.getByRole('radio', { name: /Hot interview/ }))
    expect(screen.getByRole('combobox', { name: 'Use an existing resume' })).toHaveDisplayValue('Resume, 2026 (PDF)')
    expect(screen.getByRole('button', { name: 'Load another resume' })).toBeInTheDocument()
  })

  it('does not move on while blocked', async () => {
    await toReadySetup()
    await userEvent.click(screen.getByRole('button', { name: /Prepare interview/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Set up your interview' })).toBeInTheDocument()
  })

  it('enables Prepare interview once a role is chosen, and moves to hardware setup', async () => {
    await toReadySetup()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role title' }), 'Software Engineer')
    expect(screen.getByRole('button', { name: /Prepare interview/ })).toHaveAttribute('aria-disabled', 'false')
    await userEvent.click(screen.getByRole('button', { name: /Prepare interview/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Check your setup' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45')
  })

  it('shows the error state, with Try again, when the mock server fails to load', async () => {
    await toReadySetup()
    await userEvent.selectOptions(screen.getByLabelText('Loading this page'), 'fails')
    expect(await screen.findByRole('alert', {}, wait)).toHaveTextContent('We could not load your setup')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Hardware page', () => {
  it('keeps Start interview unavailable until audio is verified, and says why', async () => {
    await toHardware()
    expect(screen.getByRole('button', { name: /Start interview/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('list')).toHaveTextContent('Audio · not verified yet')
  })

  it('verifies audio from the button', async () => {
    await toHardware()
    await userEvent.click(screen.getByRole('button', { name: 'Start audio check' }))
    await waitFor(() => expect(screen.getByRole('list')).toHaveTextContent('Audio · verified, rated clear'), wait)
  })

  it('goes back to application setup', async () => {
    await toHardware()
    await userEvent.click(screen.getByRole('button', { name: 'Back to application setup' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Set up your interview' })).toBeInTheDocument()
  })
})
