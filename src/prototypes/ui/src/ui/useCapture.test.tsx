// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the capture hook through the microphone row, with stand-ins for the devices, the recorder and the uplink. Claude-written; not a human QA test.
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MockUplink } from '../adapters/mock/mockUplink.ts'
import type { MediaPorts } from '../composition/media.ts'
import type { MediaDevicesPort, MediaRecorderPort, OpenedStream, Recording } from '../core/ports.ts'
import { MicrophoneRow } from './MicrophoneRow.tsx'
import { useCapture } from './useCapture.ts'

const fakeStream = (id: string): OpenedStream & { stopped: boolean; enabled: boolean } => {
  const s = {
    id,
    stopped: false,
    enabled: true,
    stop() {
      s.stopped = true
    },
    setEnabled(on: boolean) {
      s.enabled = on
    },
  }
  return s
}

const fakePorts = (options: { denyAudio?: boolean } = {}) => {
  const streams: ReturnType<typeof fakeStream>[] = []
  const recordings: Array<{ mime: string; tracks: string[]; emit: (n: number) => void; stopped: boolean }> = []
  const devices: MediaDevicesPort = {
    list: async () => [],
    openAudio: async () => {
      if (options.denyAudio) throw new DOMException('denied', 'NotAllowedError')
      const s = fakeStream('mic')
      streams.push(s)
      return s
    },
    openVideo: async () => {
      const s = fakeStream('cam')
      streams.push(s)
      return s
    },
    meter: () => ({ read: () => 0.5, stop: () => undefined }),
    preview: () => undefined,
  }
  const recorder: MediaRecorderPort = {
    supports: (m) => m.startsWith('audio/webm') || m.startsWith('video/webm'),
    record: (ss, mime, onChunk): Recording => {
      const entry = { mime, tracks: ss.map((s) => s.id), emit: (n: number) => onChunk(new Blob([new Uint8Array(n)])), stopped: false }
      recordings.push(entry)
      return {
        stop: async () => {
          entry.stopped = true
        },
      }
    },
  }
  const uplink = new MockUplink()
  const media: MediaPorts = { devices, recorder, uplink }
  return { media, streams, recordings, uplink }
}

function Harness({ media, videoDeviceId }: { media: MediaPorts | null; videoDeviceId: string | null }) {
  const capture = useCapture({ media, sessionId: 's1', audioDeviceId: null, videoDeviceId })
  return (
    <>
      <button type="button" onClick={() => void capture.start()}>
        start
      </button>
      <button type="button" onClick={() => void capture.stop()}>
        stop
      </button>
      <MicrophoneRow capture={capture} />
    </>
  )
}

describe('capture through the microphone row', () => {
  it('records audio alone, counts the chunks the uplink gets, mutes the microphone, and stops cleanly', async () => {
    const { media, streams, recordings, uplink } = fakePorts()
    render(<Harness media={media} videoDeviceId={null} />)
    expect(screen.getByTestId('mic-state')).toHaveTextContent('Microphone off')

    await userEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(screen.getByTestId('mic-state')).toHaveTextContent('Recording audio'))
    expect(recordings).toHaveLength(1)
    expect(recordings[0]).toMatchObject({ mime: 'audio/webm;codecs=opus', tracks: ['mic'] })
    expect(uplink.tallies).toHaveLength(1)
    expect(uplink.tallies[0]).toMatchObject({ sessionId: 's1', track: 'audio', mimeType: 'audio/webm;codecs=opus' })

    act(() => recordings[0].emit(3))
    act(() => recordings[0].emit(2))
    expect(screen.getByTestId('mic-detail')).toHaveTextContent('2 chunks sent')
    expect(uplink.tallies[0]).toMatchObject({ chunks: 2, bytes: 5 })

    await userEvent.click(screen.getByRole('button', { name: 'Mute' }))
    expect(screen.getByTestId('mic-state')).toHaveTextContent('Microphone muted')
    expect(streams[0].enabled).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Unmute' }))
    expect(streams[0].enabled).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'stop' }))
    await waitFor(() => expect(screen.getByTestId('mic-state')).toHaveTextContent('Recording stopped'))
    expect(recordings[0].stopped).toBe(true)
    expect(uplink.tallies[0].closed).toBe(true)
    expect(streams[0].stopped).toBe(true)
  })

  it('with a camera, records the composite on its own track with the same microphone, and shows the preview', async () => {
    const { media, recordings, uplink } = fakePorts()
    render(<Harness media={media} videoDeviceId="" />)
    await userEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(screen.getByTestId('mic-state')).toHaveTextContent('Recording audio and video'))

    expect(recordings.map((r) => r.tracks)).toEqual([['mic'], ['cam', 'mic']])
    expect(uplink.tallies.map((t) => t.track)).toEqual(['audio', 'composite'])
    expect(screen.getByTestId('camera-preview')).toBeInTheDocument()
  })

  it('says why when the browser refuses the microphone', async () => {
    const { media } = fakePorts({ denyAudio: true })
    render(<Harness media={media} videoDeviceId={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(screen.getByTestId('mic-state')).toHaveTextContent('Microphone blocked'))
    expect(screen.getByTestId('mic-detail')).toHaveTextContent('did not allow the microphone')
  })

  it('says so when the page has no media ports', async () => {
    render(<Harness media={null} videoDeviceId={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(screen.getByTestId('mic-detail')).toHaveTextContent('not wired'))
  })

  it('puts a broken uplink first', async () => {
    const { media, recordings } = fakePorts()
    const failing: MediaPorts = { ...media, uplink: { open: (_s, _t, _m, onError) => ({ send: () => onError('Could not reach the media stream.'), close: async () => undefined }) } }
    render(<Harness media={failing} videoDeviceId={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'start' }))
    await waitFor(() => expect(screen.getByTestId('mic-state')).toHaveTextContent('Recording audio'))
    act(() => recordings[0].emit(1))
    expect(screen.getByTestId('mic-state')).toHaveTextContent('Stream interrupted')
    expect(screen.getByTestId('mic-detail')).toHaveTextContent('Could not reach the media stream.')
  })
})
