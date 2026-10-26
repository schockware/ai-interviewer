// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the pre-flight check behind Start interview. Claude-written; not a human QA test.
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { defaultMockConfig } from '../adapters/mock/index.ts'
import type { CueSettings, InterviewType, PrepareInterview, ResumeUploadProgress } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import { HardwarePage } from './HardwarePage.tsx'
import { ResumeUploadProvider } from './ResumeUploadProvider.tsx'
import { useResumeUploads } from './resumeUploads.ts'

type OnProgress = (p: ResumeUploadProgress) => void

const settings: CueSettings = {
  emulation: {
    cadences: { speaking: 0, listening: 0, thinking: 0, variances: { floor: 1, ceiling: 1 } },
    latencies: { network: 0, packetLossVariancePerSecond: 0, audioRamp: 'clipped-ending' },
  },
}

/** Prepared at once, audio clear, and resume processing driven by hand. */
const fakeHost = (startInterview: SetupHost['startInterview'] = async () => settings) => {
  const reporters: Array<{ resumeId: string; onProgress: OnProgress }> = []
  const host: SetupHost = {
    loadPage: async () => ({ type: 'loading' }),
    uploadResume: async (r) => ({ resumeId: 'r1', displayName: r.displayName }),
    uploadJobDescription: async (r) => ({ roleId: 'role-1', displayName: r.displayName }),
    pasteJobDescription: async (r) => ({ roleId: 'role-1', displayName: r.displayName }),
    prepareInterview: (_r, onProgress) => {
      onProgress('ready')
      return () => undefined
    },
    startInterview: vi.fn(startInterview),
    verifyHardware: async () => 'clear',
    watchResumeUpload: (resumeId, onProgress) => {
      reporters.push({ resumeId, onProgress })
      return () => undefined
    },
  }
  return { host, reporters }
}

function TrackOnMount() {
  const { track } = useResumeUploads()
  useEffect(() => track('r1', 'CV'), [track])
  return null
}

const request = (interviewType: InterviewType): PrepareInterview => ({
  sessionId: 's1',
  form: {
    ai: { listener: 'default', transcriber: 'default', followUp: 'interviewer', interviewer: 'default', evaluator: 'interviewer', speaker: 'default' },
    interviewType,
    roleFocus: 'role-1',
  },
})

const renderPage = (host: SetupHost, interviewType: InterviewType, tracked = false) => {
  const onStart = vi.fn()
  render(
    <ResumeUploadProvider host={host}>
      {tracked && <TrackOnMount />}
      <HardwarePage
        host={host}
        request={request(interviewType)}
        initialCaptions={false}
        config={defaultMockConfig}
        onConfig={() => undefined}
        onBack={() => undefined}
        onStart={onStart}
        onOpenAccessibility={() => undefined}
        preflightHoldMs={0}
      />
    </ResumeUploadProvider>,
  )
  return onStart
}

const dialog = () => document.querySelector('dialog') as HTMLDialogElement
const snapshot = (status: ResumeUploadProgress['status'], steps: ResumeUploadProgress['steps']): ResumeUploadProgress => ({ resumeId: 'r1', displayName: 'CV', status, steps })

const verifyAudioAndStart = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Start audio check' }))
  // The checklist line is "<b>Audio</b> · verified, rated clear"; the matcher sees the span's own text only.
  await waitFor(() => expect(screen.getByText(/verified, rated clear/)).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: /Start interview/ }))
}

describe('Start interview and the pre-flight check', () => {
  it('for a cold interview, the check passes at once and the interview starts', async () => {
    const { host } = fakeHost()
    const onStart = renderPage(host, { type: 'cold' })
    await verifyAudioAndStart()

    expect(dialog()).toHaveAttribute('open')
    expect(screen.getByTestId('preflight')).toHaveTextContent('Resume · not used in a cold interview')
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1))
    expect(host.startInterview).toHaveBeenCalledTimes(1)
  })

  it('for a hot interview, waits for the resume to finish processing, then starts', async () => {
    const { host, reporters } = fakeHost()
    const onStart = renderPage(host, { type: 'hot', resumeId: 'r1' }, true)
    act(() => reporters[0].onProgress(snapshot('running', [{ name: 'Reading', status: 'running' }])))
    await verifyAudioAndStart()

    expect(screen.getByTestId('preflight')).toHaveTextContent('Resume · still processing')
    expect(screen.getByText('Waiting for the last pieces. This finishes on its own.')).toBeInTheDocument()
    expect(onStart).not.toHaveBeenCalled()

    act(() => reporters[0].onProgress(snapshot('done', [{ name: 'Reading', status: 'done' }])))
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1))
  })

  it('blocks when the resume failed to process, and Close returns to the page', async () => {
    const { host, reporters } = fakeHost()
    const onStart = renderPage(host, { type: 'hot', resumeId: 'r1' }, true)
    act(() => reporters[0].onProgress(snapshot('failed', [{ name: 'Matching dates', status: 'failed' }])))
    await verifyAudioAndStart()

    expect(screen.getByTestId('preflight')).toHaveTextContent('Resume · Processing stopped at “Matching dates”')
    expect(screen.getByText('Something still needs attention before the interview can start.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dialog()).not.toHaveAttribute('open')
    await new Promise((r) => setTimeout(r, 20))
    expect(onStart).not.toHaveBeenCalled()
    expect(host.startInterview).not.toHaveBeenCalled()
  })

  it('cancelling while waiting closes the check, and a later report does not start the interview', async () => {
    const { host, reporters } = fakeHost()
    const onStart = renderPage(host, { type: 'hot', resumeId: 'r1' }, true)
    act(() => reporters[0].onProgress(snapshot('running', [{ name: 'Reading', status: 'running' }])))
    await verifyAudioAndStart()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toHaveAttribute('open')
    act(() => reporters[0].onProgress(snapshot('done', [{ name: 'Reading', status: 'done' }])))
    await new Promise((r) => setTimeout(r, 20))
    expect(onStart).not.toHaveBeenCalled()
  })

  it('shows the server’s refusal inside the check and does not go on', async () => {
    const { host } = fakeHost(async () => {
      throw new Error('No interview was prepared for this session.')
    })
    const onStart = renderPage(host, { type: 'cold' })
    await verifyAudioAndStart()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No interview was prepared for this session.'))
    expect(screen.getByText('The interview did not start.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(onStart).not.toHaveBeenCalled()
  })
})
