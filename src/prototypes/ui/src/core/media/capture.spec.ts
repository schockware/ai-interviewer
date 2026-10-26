// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: media capture policy (a proposal for decision 0003, open item 1). Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { AUDIO_MIME_CANDIDATES, captureView, COMPOSITE_MIME_CANDIDATES, litBars, permissionMessage, pickMimeType } from './capture.ts'

describe('picking the recorder format', () => {
  it('takes the first supported candidate, WebM with Opus first', () => {
    expect(pickMimeType(AUDIO_MIME_CANDIDATES, (m) => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus')
    expect(pickMimeType(AUDIO_MIME_CANDIDATES, (m) => m === 'audio/mp4')).toBe('audio/mp4')
    expect(pickMimeType(COMPOSITE_MIME_CANDIDATES, (m) => m === 'video/webm;codecs=vp8,opus')).toBe('video/webm;codecs=vp8,opus')
  })
  it('is null when the browser records none of them', () => {
    expect(pickMimeType(AUDIO_MIME_CANDIDATES, () => false)).toBeNull()
  })
})

describe('the microphone row’s words', () => {
  it('follows the capture state', () => {
    expect(captureView({ type: 'idle' }, null)).toMatchObject({ label: 'Microphone off', tone: 'neutral' })
    expect(captureView({ type: 'requesting' }, null)).toMatchObject({ tone: 'warn' })
    expect(captureView({ type: 'live', video: false, muted: false, chunksSent: 12 }, null)).toEqual({ label: 'Recording audio', detail: '12 chunks sent', tone: 'ok' })
    expect(captureView({ type: 'live', video: true, muted: false, chunksSent: 1 }, null).label).toBe('Recording audio and video')
    expect(captureView({ type: 'live', video: true, muted: true, chunksSent: 1 }, null)).toMatchObject({ label: 'Microphone muted', tone: 'warn' })
    expect(captureView({ type: 'blocked', message: 'no' }, null)).toMatchObject({ label: 'Microphone blocked', detail: 'no', tone: 'bad' })
    expect(captureView({ type: 'stopped', chunksSent: 40 }, null)).toMatchObject({ label: 'Recording stopped', detail: '40 chunks sent' })
  })
  it('puts a broken stream first', () => {
    expect(captureView({ type: 'live', video: false, muted: false, chunksSent: 3 }, 'Could not reach the media stream.')).toMatchObject({ label: 'Stream interrupted', tone: 'bad' })
  })
})

describe('the level meter', () => {
  it('lights bars in proportion and clamps', () => {
    expect(litBars(0, 6)).toBe(0)
    expect(litBars(0.5, 6)).toBe(3)
    expect(litBars(1, 6)).toBe(6)
    expect(litBars(7, 6)).toBe(6)
    expect(litBars(-1, 6)).toBe(0)
  })
})

describe('permission messages', () => {
  it('explains the browser’s refusal in the page’s words', () => {
    expect(permissionMessage('NotAllowedError', 'microphone')).toContain('did not allow the microphone')
    expect(permissionMessage('NotFoundError', 'camera')).toContain('No camera was found')
    expect(permissionMessage('NotReadableError', 'microphone')).toContain('in use')
    expect(permissionMessage('Weird', 'camera')).toContain('Weird')
  })
})
