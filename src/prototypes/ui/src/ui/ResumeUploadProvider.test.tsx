// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the resume processing context and card. Claude-written; not a human QA test.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ResumeUploadProgress } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import { ResumeUploadCard } from './ResumeUploadCard.tsx'
import { ResumeUploadProvider } from './ResumeUploadProvider.tsx'
import { useResumeUploads } from './resumeUploads.ts'

type OnProgress = (p: ResumeUploadProgress) => void
type OnError = (m: string) => void

/** A host whose only working method is watching; the test drives the reports by hand. */
const fakeHost = () => {
  const reporters: Array<{ resumeId: string; onProgress: OnProgress; onError: OnError }> = []
  let stopped = 0
  const watch = vi.fn((resumeId: string, onProgress: OnProgress, onError: OnError) => {
    reporters.push({ resumeId, onProgress, onError })
    return () => {
      stopped += 1
    }
  })
  const host = { watchResumeUpload: watch } as unknown as SetupHost
  return { host, watch, reporters, stopped: () => stopped }
}

function Tracker({ id, name }: { id: string; name: string }) {
  const { track } = useResumeUploads()
  return (
    <button type="button" onClick={() => track(id, name)}>
      track {id}
    </button>
  )
}

const snapshot = (status: ResumeUploadProgress['status'], steps: ResumeUploadProgress['steps']): ResumeUploadProgress => ({
  resumeId: 'r1',
  displayName: 'My CV',
  status,
  steps,
})

describe('ResumeUploadProvider and ResumeUploadCard', () => {
  it('shows nothing until a resume is tracked, then its steps as the server reports them', async () => {
    const { host, reporters } = fakeHost()
    render(
      <ResumeUploadProvider host={host}>
        <Tracker id="r1" name="My CV" />
        <ResumeUploadCard />
      </ResumeUploadProvider>,
    )
    expect(screen.queryByTestId('resume-uploads')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    expect(screen.getByTestId('resume-uploads')).toHaveTextContent('Connecting')

    act(() => reporters[0].onProgress(snapshot('running', [{ name: 'Reading', status: 'running' }, { name: 'Indexing', status: 'pending' }])))
    expect(screen.getByRole('status')).toHaveTextContent('Step 1 of 2: Reading.')
    expect(screen.getByRole('list', { name: 'Steps for My CV' })).toHaveTextContent('Indexing · waiting')

    act(() => reporters[0].onProgress(snapshot('done', [{ name: 'Reading', status: 'done' }, { name: 'Indexing', status: 'done' }])))
    expect(screen.getByText('Processed')).toBeInTheDocument()
  })

  it('tracks a resume once, however often it is asked', async () => {
    const { host, watch } = fakeHost()
    render(
      <ResumeUploadProvider host={host}>
        <Tracker id="r1" name="My CV" />
      </ResumeUploadProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    expect(watch).toHaveBeenCalledTimes(1)
  })

  it('shows the error when the server cannot report', async () => {
    const { host, reporters } = fakeHost()
    render(
      <ResumeUploadProvider host={host}>
        <Tracker id="r1" name="My CV" />
        <ResumeUploadCard />
      </ResumeUploadProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    act(() => reporters[0].onError('Could not reach the API at /api for upload progress.'))
    expect(screen.getByText('Not reported')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Could not reach the API')
  })

  it('stops every watch when the provider unmounts', async () => {
    const { host, stopped } = fakeHost()
    const { unmount } = render(
      <ResumeUploadProvider host={host}>
        <Tracker id="r1" name="One" />
        <Tracker id="r2" name="Two" />
      </ResumeUploadProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    await userEvent.click(screen.getByRole('button', { name: 'track r2' }))
    unmount()
    expect(stopped()).toBe(2)
  })

  it('renders nothing, instead of failing, with no provider above it', () => {
    const { container } = render(<ResumeUploadCard />)
    expect(container).toBeEmptyDOMElement()
  })
})
