import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom does not implement <dialog>'s showModal/close. The stand-in toggles the open attribute and
// fires close, which is all the components rely on. Focus trapping is not simulated.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal)
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  if (!HTMLDialogElement.prototype.close)
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
}

// jsdom has no MediaStream, getUserMedia, AudioContext or MediaRecorder. These stand-ins let the
// App-level tests run through the browser media adapters: a silent microphone, no devices listed,
// a recorder that emits nothing. Component tests that care use their own fakes.
if (typeof globalThis.MediaStream === 'undefined') {
  class FakeTrack {
    enabled = true
    stop() {}
  }
  class FakeMediaStream {
    id = `fake-${Math.random().toString(36).slice(2, 8)}`
    private tracks: FakeTrack[]
    constructor(tracks: FakeTrack[] = [new FakeTrack()]) {
      this.tracks = tracks
    }
    getTracks() {
      return this.tracks
    }
  }
  class FakeAudioContext {
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} }
    }
    createAnalyser() {
      return { fftSize: 512, getByteTimeDomainData: (a: Uint8Array) => a.fill(128) }
    }
    close() {
      return Promise.resolve()
    }
  }
  class FakeMediaRecorder {
    static isTypeSupported() {
      return true
    }
    state = 'inactive'
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    start() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      this.onstop?.()
    }
  }
  Object.assign(globalThis, { MediaStream: FakeMediaStream, AudioContext: FakeAudioContext, MediaRecorder: FakeMediaRecorder })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => [],
      getUserMedia: async () => new FakeMediaStream(),
    },
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
}
