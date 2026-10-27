// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaPorts } from '../composition/media.ts'
import { AUDIO_MIME_CANDIDATES, COMPOSITE_MIME_CANDIDATES, errorNameOf, permissionMessage, pickMimeType, type CaptureState } from '../core/media/capture.ts'
import { PLACEHOLDER_QUESTION_ID } from '../core/media/transcript.ts'
import type { LevelMeter, OpenedStream, Recording, Uplink } from '../core/ports.ts'

export interface CaptureOptions {
  /** Absent when the page runs without media ports (a test, or a page on its own): capture then reports itself unwired. */
  media: MediaPorts | null
  sessionId: string
  /** One stream, and one file, per question. The placeholder until questions exist. */
  questionId?: string
  audioDeviceId: string | null
  /** null: no video. '' : the default camera. */
  videoDeviceId: string | null
}

export interface Capture {
  state: CaptureState
  /** 0 to 1, from the microphone, while live. */
  level: number
  uplinkError: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
  setMuted: (muted: boolean) => void
  /** Hands the camera stream to a video element, for the preview. */
  attachPreview: (element: HTMLVideoElement | null) => void
}

interface Live {
  audio: OpenedStream
  video: OpenedStream | null
  recordings: Recording[]
  uplinks: Uplink[]
  meter: LevelMeter
  timer: ReturnType<typeof setInterval>
}

/**
 * Captures the microphone, and the camera when one was chosen, and streams both to the uplink:
 * the audio alone on the audio track, and video with its audio on the composite track, so the
 * server keeps a clean audio file for transcription beside the full recording. The recorder's
 * chunks go out as they come. Muting disables the microphone track; the stream keeps running.
 */
export function useCapture({ media, sessionId, questionId = PLACEHOLDER_QUESTION_ID, audioDeviceId, videoDeviceId }: CaptureOptions): Capture {
  const [state, setState] = useState<CaptureState>({ type: 'idle' })
  const [level, setLevel] = useState(0)
  const [uplinkError, setUplinkError] = useState<string | null>(null)
  const live = useRef<Live | null>(null)
  const sent = useRef(0)
  const preview = useRef<HTMLVideoElement | null>(null)

  const bump = useCallback(() => {
    sent.current += 1
    setState((s) => (s.type === 'live' ? { ...s, chunksSent: sent.current } : s))
  }, [])

  const stop = useCallback(async () => {
    const current = live.current
    if (!current) return
    live.current = null
    clearInterval(current.timer)
    current.meter.stop()
    for (const recording of current.recordings) await recording.stop() // flushes the last chunk first
    for (const uplink of current.uplinks) await uplink.close()
    current.audio.stop()
    current.video?.stop()
    setLevel(0)
    setState({ type: 'stopped', chunksSent: sent.current })
  }, [])

  const start = useCallback(async () => {
    if (live.current) return
    if (!media) {
      setState({ type: 'blocked', message: 'Media capture is not wired on this page.' })
      return
    }
    setUplinkError(null)
    sent.current = 0
    setState({ type: 'requesting' })

    let audio: OpenedStream
    try {
      audio = await media.devices.openAudio(audioDeviceId)
    } catch (e) {
      setState({ type: 'blocked', message: permissionMessage(errorNameOf(e), 'microphone') })
      return
    }
    const audioMime = pickMimeType(AUDIO_MIME_CANDIDATES, (m) => media.recorder.supports(m))
    if (!audioMime) {
      audio.stop()
      setState({ type: 'blocked', message: 'This browser cannot record audio in a format the server accepts.' })
      return
    }

    let video: OpenedStream | null = null
    if (videoDeviceId !== null) {
      try {
        video = await media.devices.openVideo(videoDeviceId || null)
      } catch {
        video = null // the interview goes on with audio alone; the row says so
      }
    }
    const compositeMime = video ? pickMimeType(COMPOSITE_MIME_CANDIDATES, (m) => media.recorder.supports(m)) : null
    if (video && !compositeMime) {
      video.stop()
      video = null
    }

    const uplinks: Uplink[] = []
    const recordings: Recording[] = []
    const audioUplink = media.uplink.open(sessionId, questionId, 'audio', audioMime, setUplinkError)
    uplinks.push(audioUplink)
    recordings.push(media.recorder.record([audio], audioMime, (chunk) => {
      audioUplink.send(chunk)
      bump()
    }))
    if (video && compositeMime) {
      const compositeUplink = media.uplink.open(sessionId, questionId, 'composite', compositeMime, setUplinkError)
      uplinks.push(compositeUplink)
      recordings.push(media.recorder.record([video, audio], compositeMime, (chunk) => compositeUplink.send(chunk)))
      if (preview.current) media.devices.preview(video, preview.current)
    }

    const meter = media.devices.meter(audio)
    const timer = setInterval(() => setLevel(meter.read()), 100)
    live.current = { audio, video, recordings, uplinks, meter, timer }
    setState({ type: 'live', video: video !== null, muted: false, chunksSent: 0 })
  }, [media, sessionId, questionId, audioDeviceId, videoDeviceId, bump])

  const setMuted = useCallback((muted: boolean) => {
    live.current?.audio.setEnabled(!muted)
    setState((s) => (s.type === 'live' ? { ...s, muted } : s))
  }, [])

  const attachPreview = useCallback(
    (element: HTMLVideoElement | null) => {
      preview.current = element
      const video = live.current?.video
      if (element && video && media) media.devices.preview(video, element)
    },
    [media],
  )

  // Leaving the page stops everything, so no microphone stays open behind the user's back.
  useEffect(() => () => void stop(), [stop])

  return { state, level, uplinkError, start, stop, setMuted, attachPreview }
}
