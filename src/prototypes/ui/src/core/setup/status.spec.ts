// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: specs/page-flow.md, "Status banner and preparation progress (shared)". Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { bannerKind, bannerView, progressView, uploadingOf } from './status.ts'

describe('the status banner', () => {
  it('shows nothing when there is nothing to say', () => {
    expect(bannerKind('none', null)).toBe('hidden')
    expect(bannerView('hidden')).toBeNull()
  })

  it('picks the most urgent banner: problem, then uploading, then waiting or retrying, then ready', () => {
    expect(bannerKind('both', 'diagnosing')).toBe('problem')
    expect(bannerKind('resume', 'preparing')).toBe('uploading')
    expect(bannerKind('role', 'ready')).toBe('uploading')
    expect(bannerKind('none', 'preparing')).toBe('waiting')
    expect(bannerKind('none', 'retrying')).toBe('retrying')
    expect(bannerKind('none', 'ready')).toBe('ready')
  })

  it('names what is uploading', () => {
    expect(uploadingOf(true, true)).toBe('both')
    expect(uploadingOf(true, false)).toBe('resume')
    expect(uploadingOf(false, true)).toBe('role')
    expect(uploadingOf(false, false)).toBe('none')
    expect(bannerView('uploading', 'resume')?.title).toBe('Uploading your resume…')
    expect(bannerView('uploading', 'both')?.title).toBe('Uploading your resume and role…')
  })

  it('uses the board’s words and tones, and lets a page replace the second line', () => {
    expect(bannerView('waiting')).toMatchObject({ title: 'Waiting for host…', tone: 'warn', icon: 'wait' })
    expect(bannerView('problem')).toMatchObject({ title: 'The host ran into a problem', tone: 'bad', icon: 'problem' })
    expect(bannerView('ready')).toMatchObject({ title: 'The host is ready', body: 'Your interview is prepared.', tone: 'ok', icon: 'ready' })
    expect(bannerView('ready', 'both', 'It starts after a short countdown.')?.body).toBe('It starts after a short countdown.')
  })
})

describe('the preparation progress bar', () => {
  it('shows the percentage while preparing and clamps it', () => {
    expect(progressView('preparing', 45)).toEqual({ label: 'Preparing your interview', note: '45%', now: 45, tone: 'preparing' })
    expect(progressView('preparing', 140).now).toBe(100)
    expect(progressView('preparing', -3).now).toBe(0)
  })

  it('slows and says so when retrying, claims no value while diagnosing, and is full when ready', () => {
    expect(progressView('retrying', 62)).toMatchObject({ note: 'Taking longer than usual. Retrying', now: 62, tone: 'retrying' })
    expect(progressView('diagnosing', 62)).toMatchObject({ note: 'Checking what went wrong', now: null })
    expect(progressView('ready', 10)).toEqual({ label: 'Your interview is ready', note: '', now: 100, tone: 'ready' })
  })

  it('lets a page write the note, as the waiting room does with the current step', () => {
    expect(progressView('preparing', 33, '33% · Planning the questions').note).toBe('33% · Planning the questions')
  })
})
