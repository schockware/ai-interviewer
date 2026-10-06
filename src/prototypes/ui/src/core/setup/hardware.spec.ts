// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Spec: contracts/page-flow.md, "Hardware setup and verification". Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { canStart, checklist, toHardwareForm, type CheckPhase } from './hardware.ts'

const done = (quality: 'clear' | 'intermittent' | 'readable' | 'unreadable'): CheckPhase => ({ type: 'done', quality })

describe('Start interview', () => {
  it('needs the interview prepared AND audio verified', () => {
    expect(canStart('ready', done('clear'))).toBe(true)
    expect(canStart('preparing', done('clear'))).toBe(false)
    expect(canStart('ready', { type: 'pending' })).toBe(false)
  })
  it.each(['clear', 'intermittent', 'readable'] as const)('allows audio rated %s', (q) => {
    expect(canStart('ready', done(q))).toBe(true)
  })
  it('refuses unreadable and errored audio', () => {
    expect(canStart('ready', done('unreadable'))).toBe(false)
    expect(canStart('ready', { type: 'errored' })).toBe(false)
  })
})

describe('the checklist that explains a disabled Start', () => {
  it('says what still needs attention', () => {
    const items = checklist('diagnosing', done('unreadable'), { type: 'skipped' })
    expect(items.map((i) => i.state)).toEqual(['needs attention', 'needs attention: unreadable', 'optional, skipped'])
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
