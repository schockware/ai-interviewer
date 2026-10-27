// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

// Real timers: the mock host's delays (under two seconds for these paths) are short enough.
const wait = { timeout: 4000 }

const toReadySetup = async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Interview type' }, wait)
}

const toRoleSetup = async () => {
  await toReadySetup()
  await userEvent.click(screen.getByRole('button', { name: /Role set up/ }))
  await screen.findByRole('heading', { level: 1, name: 'Set up the role' })
}

/** Picks a sample role that has saved questions, and waits for the look-up to finish. */
const pickEngineer = async () => {
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role title' }), 'Software Engineer')
  await waitFor(() => expect(screen.getByTestId('questions-note')).toHaveTextContent('Already loaded.'), wait)
}

const toHardware = async () => {
  await toRoleSetup()
  await pickEngineer()
  await userEvent.click(screen.getByRole('button', { name: /Prepare interview/ }))
  await screen.findByRole('heading', { level: 1, name: 'Check your setup' })
}

describe('Application setup page', () => {
  it('shows loading first, then the ready form, with Role set up available for a cold interview', async () => {
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your settings…')
    await screen.findByRole('heading', { name: 'Interview type' }, wait)
    expect(screen.getByRole('button', { name: /Role set up/ })).toHaveAttribute('aria-disabled', 'false')
    expect(screen.queryByTestId('blockers')).not.toBeInTheDocument()
  })

  it('opens the hot resume panel with the newest saved resume selected', async () => {
    await toReadySetup()
    await userEvent.click(screen.getByRole('radio', { name: /Hot interview/ }))
    expect(screen.getByRole('combobox', { name: 'Use an existing resume' })).toHaveDisplayValue('Resume, 2026 (PDF)')
    expect(screen.getByRole('button', { name: 'Load another resume' })).toBeInTheDocument()
  })

  it('holds Role set up only while a hot interview has no resume at all', async () => {
    await toReadySetup()
    await userEvent.selectOptions(screen.getByLabelText('Saved resumes and roles'), 'none')
    await screen.findByRole('heading', { name: 'Interview type' }, wait)
    await userEvent.click(screen.getByRole('radio', { name: /Hot interview/ }))
    expect(screen.getByRole('button', { name: /Role set up/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('blockers')).toHaveTextContent('Pick or load a resume, or switch to a cold interview.')
    await userEvent.click(screen.getByRole('button', { name: /Role set up/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Set up your interview' })).toBeInTheDocument()
  })

  it('shows the error state, with Try again, when the mock server fails to load', async () => {
    await toReadySetup()
    await userEvent.selectOptions(screen.getByLabelText('Loading this page'), 'fails')
    expect(await screen.findByRole('alert', {}, wait)).toHaveTextContent('We could not load your setup')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Role set up page', () => {
  it('starts unanswered, explains why Prepare waits, and shows the description and the loaded questions once a role is chosen', async () => {
    await toRoleSetup()
    expect(screen.getByRole('button', { name: /Prepare interview/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('blockers')).toHaveTextContent('Choose a role focus.')
    expect(screen.queryByTestId('about-role')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role title' }), 'Software Engineer')
    expect(screen.getByTestId('questions-note')).toHaveTextContent('Checking.')
    expect(screen.getByRole('button', { name: 'Setup questions' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('blockers')).toHaveTextContent('Wait while we check whether this role has questions.')

    await waitFor(() => expect(screen.getByTestId('questions-note')).toHaveTextContent('5 questions are saved for Software Engineer'), wait)
    expect(screen.getByRole('region', { name: 'Role description' })).toHaveTextContent('Software Engineer')
    expect(screen.getByRole('button', { name: /Prepare interview/ })).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByTestId('questions-summary')).toHaveTextContent('5 saved questions, kept')
  })

  it('opens the questions panel from Setup questions; purging warns and switches to the AI by default', async () => {
    await toRoleSetup()
    await pickEngineer()
    await userEvent.click(screen.getByRole('button', { name: 'Setup questions' }))
    const panel = screen.getByTestId('questions-panel')
    expect(panel).toHaveTextContent('Software Engineer already has 5 saved questions. Do you want to purge them?')
    expect(screen.queryByTestId('purge-warning')).not.toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('radio', { name: /Purge them and start over/ }))
    expect(screen.getByTestId('purge-warning')).toHaveTextContent('This cannot be undone. They are removed when you press Prepare interview.')
    expect(within(panel).getByRole('radio', { name: /Have the AI write them/ })).toBeChecked()
    expect(screen.getByTestId('questions-note')).toHaveTextContent('Purge chosen.')
    expect(screen.getByRole('button', { name: /Prepare interview/ })).toHaveAttribute('aria-disabled', 'false')
  })

  it('for a role without questions the AI is the default; choosing an upload waits for a file, and a pasted list counts its questions', async () => {
    await toRoleSetup()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Role title' }), 'Product Manager')
    await waitFor(() => expect(screen.getByTestId('questions-note')).toHaveTextContent('The AI will write the questions.'), wait)
    expect(screen.getByRole('button', { name: /Prepare interview/ })).toHaveAttribute('aria-disabled', 'false')

    await userEvent.click(screen.getByRole('button', { name: 'Setup questions' }))
    await userEvent.click(screen.getByRole('radio', { name: /Upload my own questions/ }))
    expect(screen.getByTestId('blockers')).toHaveTextContent('Choose your questions file, or let the AI write them.')

    await userEvent.click(within(screen.getByRole('group', { name: 'Your questions' })).getByRole('button', { name: 'Paste text' }))
    await userEvent.type(screen.getByLabelText('Name for these questions'), 'My list')
    await userEvent.type(screen.getByLabelText('Questions, one per line'), 'Why this team?{enter}Tell me about a launch.')
    await userEvent.click(screen.getByRole('button', { name: 'Add questions' }))
    await screen.findByText('My list is loaded. 2 questions found.', {}, wait)
    expect(screen.getByRole('button', { name: /Prepare interview/ })).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByTestId('questions-summary')).toHaveTextContent('My list')
  })

  it('a pasted job description becomes a new, selected role whose questions panel is already open', async () => {
    await toRoleSetup()
    await userEvent.click(screen.getByRole('button', { name: 'Paste text' }))
    await userEvent.type(screen.getByLabelText('Name for this role'), 'Gardener')
    await userEvent.type(screen.getByLabelText('Job description'), 'Tend the roses.')
    await userEvent.click(screen.getByRole('button', { name: 'Add job description' }))
    expect(screen.getByText('Uploading the job description. You can keep going; the waiting room finishes it.')).toBeInTheDocument()
    await screen.findByText('Gardener is added and selected.', {}, wait)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Role description' })).toHaveTextContent('Tend the roses.'), wait)
    expect(screen.getByTestId('questions-panel')).toHaveTextContent('This is a new role, so it has no questions yet.')
    expect(screen.queryByRole('button', { name: 'Setup questions' })).not.toBeInTheDocument()
  })

  it('goes back to application setup and keeps the choices', async () => {
    await toRoleSetup()
    await pickEngineer()
    await userEvent.click(screen.getByRole('button', { name: 'Back to application setup' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Set up your interview' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Role set up/ }))
    await screen.findByRole('heading', { level: 1, name: 'Set up the role' })
    expect(screen.getByRole('combobox', { name: 'Role title' })).toHaveDisplayValue('Software Engineer')
  })

  it('moves to hardware setup with the shared banner and bar, and shows them again when the user comes back', async () => {
    await toHardware()
    expect(screen.getByTestId('status-banner')).toHaveTextContent('Waiting for host…')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    await userEvent.click(screen.getByRole('button', { name: 'Back to role set up' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Set up the role' })).toBeInTheDocument()
    expect(screen.getByTestId('status-banner')).toHaveTextContent('Waiting for host…')
    expect(screen.getByTestId('prep-progress')).toHaveTextContent('Preparing your interview')
  })
})

describe('Hardware page', () => {
  it('keeps Ready for interview unavailable until audio is verified, and says why', async () => {
    await toHardware()
    expect(screen.getByRole('button', { name: /Ready for interview/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('list')).toHaveTextContent('Audio · not verified yet')
    expect(screen.getByRole('list')).toHaveTextContent('Interview prepared · still preparing, you can wait for it in the waiting room')
  })

  it('verifies audio from the button, and then leads to the waiting room without waiting for preparation', async () => {
    await toHardware()
    await userEvent.click(screen.getByRole('button', { name: 'Start audio check' }))
    await waitFor(() => expect(screen.getByRole('list')).toHaveTextContent('Audio · verified, rated clear'), wait)
    await userEvent.click(screen.getByRole('button', { name: /Ready for interview/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Waiting room' })).toBeInTheDocument()
    expect(screen.getByTestId('now')).not.toHaveTextContent('Your interview is ready')
    expect(screen.getByRole('heading', { name: 'Interview scripts' })).toBeInTheDocument()
    // The engineer's saved questions were kept, so the room loads them instead of writing them.
    expect(screen.getByText('Loading the saved questions')).toBeInTheDocument()
  })
})
