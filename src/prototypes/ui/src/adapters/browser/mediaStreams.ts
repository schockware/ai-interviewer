// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { CHUNK_MS } from '../../core/media/capture.ts'
import type { LevelMeter, MediaDeviceChoice, MediaDevicesPort, MediaRecorderPort, OpenedStream, Recording } from '../../core/ports.ts'

/**
 * The browser's own devices and recorder, behind the ports: `navigator.mediaDevices` for the
 * microphone and camera, an `AnalyserNode` for the level meter, `MediaRecorder` for the chunks.
 * The MediaStream never leaves this module: the ports see an OpenedStream.
 */
class BrowserStream implements OpenedStream {
  readonly id: string
  readonly raw: MediaStream
  constructor(raw: MediaStream) {
    this.raw = raw
    this.id = raw.id
  }
  stop(): void {
    this.raw.getTracks().forEach((t) => t.stop())
  }
  setEnabled(on: boolean): void {
    this.raw.getTracks().forEach((t) => {
      t.enabled = on
    })
  }
}

const rawOf = (stream: OpenedStream): MediaStream => {
  if (!(stream instanceof BrowserStream)) throw new Error('This stream was not opened by the browser adapter.')
  return stream.raw
}

export class BrowserMediaDevices implements MediaDevicesPort {
  async list(): Promise<MediaDeviceChoice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    const all = await navigator.mediaDevices.enumerateDevices()
    return all
      .filter((d): d is MediaDeviceInfo => d.kind === 'audioinput' || d.kind === 'videoinput')
      .map((d, i) => ({ kind: d.kind as 'audioinput' | 'videoinput', deviceId: d.deviceId, label: d.label || `${d.kind === 'audioinput' ? 'Microphone' : 'Camera'} ${i + 1}` }))
  }

  async openAudio(deviceId: string | null): Promise<OpenedStream> {
    // Echo cancellation and noise suppression are the browser defaults for now (decision 0003, open item 6).
    const audio: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId } } : {}
    return new BrowserStream(await navigator.mediaDevices.getUserMedia({ audio, video: false }))
  }

  async openVideo(deviceId: string | null): Promise<OpenedStream> {
    const video: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId } } : {}
    return new BrowserStream(await navigator.mediaDevices.getUserMedia({ audio: false, video }))
  }

  meter(stream: OpenedStream): LevelMeter {
    const context = new AudioContext()
    const source = context.createMediaStreamSource(rawOf(stream))
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    return {
      read: () => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const s of samples) {
          const v = (s - 128) / 128
          sum += v * v
        }
        // RMS, scaled so ordinary speech fills most of the meter.
        return Math.min(1, Math.sqrt(sum / samples.length) * 4)
      },
      stop: () => {
        source.disconnect()
        void context.close()
      },
    }
  }

  preview(stream: OpenedStream, element: HTMLVideoElement): void {
    element.srcObject = rawOf(stream)
    element.muted = true
    void element.play().catch(() => undefined)
  }
}

export class BrowserRecorder implements MediaRecorderPort {
  supports(mimeType: string): boolean {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)
  }

  /** One recorder over every track of the given streams: audio alone, or video with its audio for the composite. */
  record(streams: OpenedStream[], mimeType: string, onChunk: (chunk: Blob) => void, timesliceMs = CHUNK_MS): Recording {
    const combined = new MediaStream(streams.flatMap((s) => rawOf(s).getTracks()))
    const recorder = new MediaRecorder(combined, { mimeType })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) onChunk(event.data)
    }
    recorder.start(timesliceMs)
    return {
      stop: () =>
        new Promise<void>((resolve) => {
          if (recorder.state === 'inactive') return resolve()
          recorder.onstop = () => resolve()
          recorder.stop() // flushes the last chunk through ondataavailable first
        }),
    }
  }
}
