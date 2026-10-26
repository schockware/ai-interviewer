// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Spec: contracts/page-flow.md, "Hardware setup and verification". Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { canStart, checklist, toHardwareForm, type CheckPhase } from './hardware.ts'

const done = (quality: 'clear' | 'intermittent' | 'readable' | 'unreadable'): CheckPhase => ({ type: 'done', quality })

describe('Ready for interview', () => {
  it('needs audio verified, and no longer waits for the interview to be prepared (the waiting room does)', () => {
    expect(canStart(done('clear'))).toBe(true)
    expect(canStart({ type: 'pending' })).toBe(false)
    expect(canStart({ type: 'checking' })).toBe(false)
  })
  it.each(['clear', 'intermittent', 'readable'] as const)('allows audio rated %s', (q) => {
    expect(canStart(done(q))).toBe(true)
  })
  it('refuses unreadable and errored audio', () => {
    expect(canStart(done('unreadable'))).toBe(false)
    expect(canStart({ type: 'errored' })).toBe(false)
  })
})

describe('the checklist that explains a disabled Ready for interview', () => {
  it('says what still needs attention, and where preparation is followed', () => {
    const items = checklist('diagnosing', done('unreadable'), { type: 'skipped' })
    expect(items.map((i) => i.state)).toEqual(['needs attention, shown in the waiting room', 'needs attention: unreadable', 'optional, skipped'])
    expect(checklist('preparing', done('clear'), { type: 'skipped' })[0].state).toBe('still preparing, you can wait for it in the waiting room')
    expect(checklist('ready', done('clear'), { type: 'skipped' })[0].state).toBe('done')
  })
})

describe('HardwareSetupForm sent with StartInterview', () => {
  it('reports verified audio with its quality, skipped video, and captions as chosen', () => {
    expect(toHardwareForm(done('readable'), { type: 'skipped' }, true)).toEqual({
      audio: { status: 'verified', quality: 'readable' },
      video: { status: 'skipped', quality: 'skipped' },
      training: { captions: 'enabled' },
    })
  })
})
