// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the Waiting room. Claude-written; not a human QA test.
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CueSettings, PrepReport, PrepareInterview, ResumeUploadProgress, StartInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import { PREP_STEP_TOTAL } from '../core/setup/waitingRoom.ts'
import { PreparationProvider } from './PreparationProvider.tsx'
import { usePreparation } from './preparation.ts'
import { ResumeUploadProvider } from './ResumeUploadProvider.tsx'
import { useResumeUploads } from './resumeUploads.ts'
import { WaitingRoomPage } from './WaitingRoomPage.tsx'

const settings: CueSettings = {
  emulation: {
    cadences: { speaking: 0, listening: 0, thinking: 0, variances: { floor: 1, ceiling: 1 } },
    latencies: { network: 0, packetLossVariancePerSecond: 0, audioRamp: 'clipped-ending' },
  },
}
type OnProgress = (p: ResumeUploadProgress) => void

const fakeHost = (startInterview: SetupHost['startInterview'] = async () => settings) => {
  const reporters: Array<(report: PrepReport) => void> = []
  const uploadReporters: OnProgress[] = []
  const host = {
    prepareInterview: vi.fn((_r: PrepareInterview, onProgress: (report: PrepReport) => void) => {
      reporters.push(onProgress)
      return () => undefined
    }),
    startInterview: vi.fn(startInterview),
    watchResumeUpload: (_id: string, onProgress: OnProgress) => {
      uploadReporters.push(onProgress)
      return () => undefined
    },
  } as unknown as SetupHost
  return {
    host,
    report: (r: PrepReport) => act(() => reporters.forEach((on) => on(r))),
    reportUpload: (status: ResumeUploadProgress['status']) => act(() => uploadReporters.forEach((on) => on({ resumeId: 'r1', displayName: 'CV', status, steps: [] }))),
  }
}

const request = (hot: boolean): PrepareInterview => ({
  sessionId: 's1',
  form: {
    ai: { listener: 'default', transcriber: 'default', followUp: 'interviewer', interviewer: 'default', evaluator: 'interviewer', speaker: 'default' },
    interviewType: hot ? { type: 'hot', resumeId: 'r1' } : { type: 'cold' },
    roleFocus: 'role-1',
  questions: { type: 'generate' },
  },
})
const startRequest: StartInterview = {
  sessionId: 's1',
  form: { audio: { status: 'verified', quality: 'clear' }, video: { status: 'skipped', quality: 'skipped' }, training: { captions: 'disabled' } },
}

function Begin({ hot }: { hot: boolean }) {
  const { start } = usePreparation()
  const { track } = useResumeUploads()
  useEffect(() => {
    if (hot) track('r1', 'CV')
    start(request(hot), { hot, roleSource: 'saved', questions: 'generate' })
  }, [start, track, hot])
  return null
}

const renderRoom = (host: SetupHost, hot = false) => {
  const onJoin = vi.fn()
  const onLeave = vi.fn()
  render(
    <ResumeUploadProvider host={host}>
      <PreparationProvider host={host}>
        <Begin hot={hot} />
        <WaitingRoomPage host={host} startRequest={startRequest} onLeave={onLeave} onChangeSetup={() => undefined} onJoin={onJoin} onOpenAccessibility={() => undefined} countdownSeconds={1} />
      </PreparationProvider>
    </ResumeUploadProvider>,
  )
  return { onJoin, onLeave }
}

const prepared = async (host: SetupHost) => waitFor(() => expect(host.prepareInterview).toHaveBeenCalled())

describe('Waiting room', () => {
  it('shows the current step and every group while preparing, with the bar carrying the step', async () => {
    const { host, report } = fakeHost()
    renderRoom(host)
    await prepared(host)
    report({ progress: 'preparing', stepsDone: 2 })

    expect(screen.getByTestId('now')).toHaveTextContent('Writing the questions')
    expect(screen.getByRole('heading', { name: 'Your materials' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Interview scripts' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Voice and connection' })).toBeInTheDocument()
    expect(screen.getByText('Looking up the role', { selector: '.step-label' }).closest('li')).toHaveTextContent('Done')
    expect(screen.getByText('Writing the questions', { selector: '.step-label' }).closest('li')).toHaveTextContent('In progress')
    expect(screen.getByTestId('prep-progress')).toHaveTextContent('22% · Writing the questions')
    expect(screen.queryByTestId('countdown')).toBeNull()
  })

  it('counts down once everything is ready and starts the interview', async () => {
    const { host, report } = fakeHost()
    const { onJoin } = renderRoom(host)
    await prepared(host)
    report({ progress: 'ready', stepsDone: PREP_STEP_TOTAL })

    expect(screen.getByTestId('status-banner')).toHaveTextContent('The host is ready')
    expect(screen.getByTestId('countdown')).toHaveTextContent('Your interview starts in 1 seconds')
    expect(screen.getByText(/Everything is ready · 9 of 9 steps done/)).toBeInTheDocument()
    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(host.startInterview).toHaveBeenCalledWith(startRequest)
  })

  it('starts the countdown paused when Training options say so, and goes on when the pause is turned off', async () => {
    const { host, report } = fakeHost()
    const { onJoin } = renderRoom(host)
    await prepared(host)
    await userEvent.click(screen.getByRole('switch', { name: 'Pause the countdown' }))
    report({ progress: 'ready', stepsDone: PREP_STEP_TOTAL })

    expect(screen.getByTestId('countdown')).toHaveTextContent('Countdown paused')
    expect(screen.getByTestId('status-banner')).toHaveTextContent('The countdown is paused')
    await new Promise((r) => setTimeout(r, 1300))
    expect(onJoin).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('switch', { name: 'Pause the countdown' }))
    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1), { timeout: 3000 })
  })

  it('waits for the resume to be read before it is ready, and blocks when reading failed', async () => {
    const { host, report, reportUpload } = fakeHost()
    const { onJoin } = renderRoom(host, true)
    await prepared(host)
    reportUpload('running')
    report({ progress: 'ready', stepsDone: PREP_STEP_TOTAL })

    expect(screen.getByTestId('now')).toHaveTextContent('Reading your resume')
    expect(screen.queryByTestId('countdown')).toBeNull()

    reportUpload('failed')
    expect(screen.getByTestId('status-banner')).toHaveTextContent('Your resume could not be processed')
    expect(screen.getByText('Reading your resume', { selector: '.step-label' }).closest('li')).toHaveTextContent('Needs attention')
    await new Promise((r) => setTimeout(r, 1300))
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('shows the diagnosis when preparation failed, and Try preparing again asks the host again', async () => {
    const { host, report } = fakeHost()
    renderRoom(host)
    await prepared(host)
    report({ progress: 'diagnosing', stepsDone: 4 })

    expect(screen.getByTestId('status-banner')).toHaveTextContent('The host ran into a problem')
    expect(screen.getByText('Preparing the follow-up questions', { selector: '.step-label' }).closest('li')).toHaveTextContent('Needs attention')
    await userEvent.click(screen.getByRole('button', { name: 'Try preparing again' }))
    await waitFor(() => expect(host.prepareInterview).toHaveBeenCalledTimes(2))
  })

  it('keeps the server’s refusal on screen and does not join', async () => {
    const { host, report } = fakeHost(async () => {
      throw new Error('No interview was prepared for this session.')
    })
    const { onJoin } = renderRoom(host)
    await prepared(host)
    report({ progress: 'ready', stepsDone: PREP_STEP_TOTAL })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No interview was prepared'), { timeout: 3000 })
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('offers one piece at a time while you wait, and leaves on request', async () => {
    const { host } = fakeHost()
    const { onLeave } = renderRoom(host)
    await prepared(host)

    await userEvent.click(screen.getByRole('button', { name: 'Interview tips' }))
    expect(screen.getByTestId('pez')).toHaveTextContent('Tip 1 of 3')
    expect(screen.getByTestId('pez')).toHaveTextContent('[INTERVIEW TIP 1]')
    await userEvent.click(screen.getByRole('button', { name: 'Next tip' }))
    expect(screen.getByTestId('pez')).toHaveTextContent('Tip 2 of 3')
    await userEvent.click(screen.getByRole('button', { name: 'Frequently asked questions' }))
    expect(screen.getByTestId('pez')).toHaveTextContent('[FAQ QUESTION 1]')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('pez')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Leave the waiting room' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
