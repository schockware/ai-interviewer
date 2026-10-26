// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the resume uploads context. Claude-written; not a human QA test.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ResumeUploadProgress } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
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

/** Shows what the context holds, and tracks on request. */
function Probe({ id, name }: { id: string; name: string }) {
  const { uploads, track } = useResumeUploads()
  return (
    <>
      <button type="button" onClick={() => track(id, name)}>
        track {id}
      </button>
      <output data-testid="uploads">{uploads.map((u) => `${u.resumeId}:${u.progress?.status ?? (u.error ? 'error' : 'none')}`).join(',')}</output>
    </>
  )
}

const snapshot = (status: ResumeUploadProgress['status']): ResumeUploadProgress => ({ resumeId: 'r1', displayName: 'CV', status, steps: [] })

describe('ResumeUploadProvider', () => {
  it('holds nothing until a resume is tracked, then the latest report', async () => {
    const { host, reporters } = fakeHost()
    render(
      <ResumeUploadProvider host={host}>
        <Probe id="r1" name="CV" />
      </ResumeUploadProvider>,
    )
    expect(screen.getByTestId('uploads')).toHaveTextContent('')

    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    expect(screen.getByTestId('uploads')).toHaveTextContent('r1:none')
    act(() => reporters[0].onProgress(snapshot('running')))
    expect(screen.getByTestId('uploads')).toHaveTextContent('r1:running')
    act(() => reporters[0].onProgress(snapshot('done')))
    expect(screen.getByTestId('uploads')).toHaveTextContent('r1:done')
  })

  it('tracks a resume once, however often it is asked', async () => {
    const { host, watch } = fakeHost()
    render(
      <ResumeUploadProvider host={host}>
        <Probe id="r1" name="CV" />
      </ResumeUploadProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    expect(watch).toHaveBeenCalledTimes(1)
  })

  it('keeps the error when the server cannot report', async () => {
    const { host, reporters } = fakeHost()
    render(
      <ResumeUploadProvider host={host}>
        <Probe id="r1" name="CV" />
      </ResumeUploadProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    act(() => reporters[0].onError('Could not reach the API.'))
    expect(screen.getByTestId('uploads')).toHaveTextContent('r1:error')
  })

  it('stops every watch when the provider unmounts', async () => {
    const { host, stopped } = fakeHost()
    const { unmount } = render(
      <ResumeUploadProvider host={host}>
        <Probe id="r1" name="One" />
        <Probe id="r2" name="Two" />
      </ResumeUploadProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'track r1' }))
    await userEvent.click(screen.getByRole('button', { name: 'track r2' }))
    unmount()
    expect(stopped()).toBe(2)
  })
})
