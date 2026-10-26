// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the Hardware page under the new design: Ready for interview needs the audio check only. Claude-written; not a human QA test.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { defaultMockConfig } from '../adapters/mock/index.ts'
import type { PrepReport, PrepareInterview } from '../core/contract/pageFlow.ts'
import type { MediaDevicesPort, OpenedStream, SetupHost } from '../core/ports.ts'
import { HardwarePage } from './HardwarePage.tsx'
import { PreparationProvider } from './PreparationProvider.tsx'
import { usePreparation } from './preparation.ts'
import { ResumeUploadProvider } from './ResumeUploadProvider.tsx'

/** A host whose preparation is driven by hand, audio always clear. */
const fakeHost = () => {
  const reporters: Array<(report: PrepReport) => void> = []
  const host = {
    prepareInterview: vi.fn((_r: PrepareInterview, onProgress: (report: PrepReport) => void) => {
      reporters.push(onProgress)
      return () => undefined
    }),
    verifyHardware: async () => 'clear' as const,
    watchResumeUpload: () => () => undefined,
  } as unknown as SetupHost
  return { host, report: (r: PrepReport) => reporters.forEach((on) => on(r)) }
}

const fakeStream = (id: string): OpenedStream => ({ id, stop: () => undefined, setEnabled: () => undefined })
const fakeDevices: MediaDevicesPort = {
  list: async () => [{ kind: 'audioinput', deviceId: 'mic-1', label: 'Desk microphone' }],
  openAudio: async () => fakeStream('mic'),
  openVideo: async () => fakeStream('cam'),
  meter: () => ({ read: () => 0.6, stop: () => undefined }),
  preview: () => undefined,
}

const request: PrepareInterview = {
  sessionId: 's1',
  form: {
    ai: { listener: 'default', transcriber: 'default', followUp: 'interviewer', interviewer: 'default', evaluator: 'interviewer', speaker: 'default' },
    interviewType: { type: 'cold' },
    roleFocus: 'role-1',
  },
}

function StartOnMount() {
  const { start } = usePreparation()
  useEffect(() => start(request, { hot: false, roleSource: 'saved' }), [start])
  return null
}

const renderPage = (host: SetupHost) => {
  const onReady = vi.fn()
  render(
    <ResumeUploadProvider host={host}>
      <PreparationProvider host={host}>
        <StartOnMount />
        <HardwarePage host={host} media={fakeDevices} initialCaptions={false} config={defaultMockConfig} onConfig={() => undefined} onBack={() => undefined} onReady={onReady} onOpenAccessibility={() => undefined} />
      </PreparationProvider>
    </ResumeUploadProvider>,
  )
  return onReady
}

describe('Hardware page', () => {
  it('keeps Ready for interview unavailable until audio is verified, and does not wait for preparation', async () => {
    const { host, report } = fakeHost()
    const onReady = renderPage(host)
    await waitFor(() => expect(host.prepareInterview).toHaveBeenCalled())
    const button = screen.getByRole('button', { name: /Ready for interview/ })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('status-banner')).toHaveTextContent('Waiting for host…')
    expect(screen.getByRole('list')).toHaveTextContent('Interview prepared · still preparing, you can wait for it in the waiting room')

    await userEvent.click(screen.getByRole('button', { name: 'Start audio check' }))
    await waitFor(() => expect(screen.getByText(/verified, rated clear/)).toBeInTheDocument())
    expect(button).toHaveAttribute('aria-disabled', 'false')

    await userEvent.click(button)
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(onReady.mock.calls[0][0]).toMatchObject({ sessionId: 's1', form: { audio: { status: 'verified', quality: 'clear' }, video: { status: 'skipped' } } })
    expect(onReady.mock.calls[0][2]).toEqual({ audioDeviceId: null, videoDeviceId: null })
    expect(screen.getByRole('option', { name: 'Desk microphone' })).toBeInTheDocument()
    report({ progress: 'ready', stepsDone: 9 })
  })

  it('shows the shared banner and bar as preparation moves, and the diagnosis when it fails', async () => {
    const { host, report } = fakeHost()
    renderPage(host)
    await waitFor(() => expect(host.prepareInterview).toHaveBeenCalled())
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    report({ progress: 'preparing', stepsDone: 3 })
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33'))

    report({ progress: 'diagnosing', stepsDone: 3 })
    await waitFor(() => expect(screen.getByTestId('status-banner')).toHaveTextContent('The host ran into a problem'))
    expect(screen.getByRole('heading', { name: 'What the interviewer found' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByRole('list')).toHaveTextContent('Interview prepared · needs attention, shown in the waiting room')

    await userEvent.click(screen.getByRole('button', { name: 'Try preparing again' }))
    await waitFor(() => expect(host.prepareInterview).toHaveBeenCalledTimes(2))
  })

  it('says the interview is ready once it is', async () => {
    const { host, report } = fakeHost()
    renderPage(host)
    await waitFor(() => expect(host.prepareInterview).toHaveBeenCalled())
    report({ progress: 'ready', stepsDone: 9 })
    await waitFor(() => expect(screen.getByTestId('status-banner')).toHaveTextContent('The host is ready'))
    expect(screen.getByText('Your interview is ready, so the waiting room lets you straight in.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})
