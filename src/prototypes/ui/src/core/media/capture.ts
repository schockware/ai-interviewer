// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { Tone } from '../setup/hardware.ts'

// What the browser captures during the interview and how it is cut up for the server. Pure:
// the devices and the recorder are ports (core/ports.ts); this is the policy.

/** Recorder formats to try, best first. PROPOSAL (decision 0003, open item 1): WebM with Opus, which Chromium and Firefox both record. */
export const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'] as const
export const COMPOSITE_MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] as const

/** How often the recorder hands over a chunk. PROPOSAL: short enough for the real-time transcription to keep up. */
export const CHUNK_MS = 250

/** The first format the recorder supports, or null when none is. */
export function pickMimeType(candidates: readonly string[], supported: (mimeType: string) => boolean): string | null {
  return candidates.find((m) => supported(m)) ?? null
}

export type CaptureState =
  | { type: 'idle' }
  | { type: 'requesting' }
  | { type: 'live'; video: boolean; muted: boolean; chunksSent: number }
  | { type: 'blocked'; message: string }
  | { type: 'stopped'; chunksSent: number }

export interface CaptureView {
  label: string
  detail: string
  tone: Tone
}

/** The microphone row's words. */
export function captureView(state: CaptureState, uplinkError: string | null): CaptureView {
  if (uplinkError) return { label: 'Stream interrupted', detail: uplinkError, tone: 'bad' }
  switch (state.type) {
    case 'idle':
      return { label: 'Microphone off', detail: 'Start the interview to turn it on.', tone: 'neutral' }
    case 'requesting':
      return { label: 'Asking for your microphone…', detail: 'Allow it in your browser when asked.', tone: 'warn' }
    case 'live':
      return {
        label: state.muted ? 'Microphone muted' : state.video ? 'Recording audio and video' : 'Recording audio',
        detail: `${state.chunksSent} chunks sent`,
        tone: state.muted ? 'warn' : 'ok',
      }
    case 'blocked':
      return { label: 'Microphone blocked', detail: state.message, tone: 'bad' }
    case 'stopped':
      return { label: 'Recording stopped', detail: `${state.chunksSent} chunks sent`, tone: 'neutral' }
  }
}

/** How many of `bars` light up for a level between 0 and 1. */
export const litBars = (level: number, bars: number): number => Math.min(bars, Math.round(Math.max(0, Math.min(1, level)) * bars))

/** The DOMException name, or the error's name, for permissionMessage. */
export const errorNameOf = (e: unknown): string => (typeof DOMException !== 'undefined' && e instanceof DOMException ? e.name : e instanceof Error ? e.name : 'UnknownError')

/** The browser's reason, in the page's words. The names are the DOMException names of getUserMedia. */
export function permissionMessage(errorName: string, device: 'microphone' | 'camera'): string {
  switch (errorName) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Your browser did not allow the ${device}. Allow it in the address bar and try again.`
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `No ${device} was found. Plug one in or pick another, then try again.`
    case 'NotReadableError':
      return `The ${device} is in use by another app or could not be read.`
    default:
      return `The ${device} could not be opened (${errorName}).`
  }
}
