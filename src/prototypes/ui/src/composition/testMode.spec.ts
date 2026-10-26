// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Spec: test mode (?mode=test) and the headers it sends; see the api README, Test mode. Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { DEFAULT_TEST_SETTINGS, MOCK_UPLOADER_HEADER, presetNameFor, readTestMode, testHeaders } from './testMode.ts'

describe('test mode', () => {
  it('is on only for ?mode=test', () => {
    expect(readTestMode('?mode=test')).toBe(true)
    expect(readTestMode('?integration=real&mode=test')).toBe(true)
    expect(readTestMode('')).toBe(false)
    expect(readTestMode('?mode=prod')).toBe(false)
  })

  it('sends no header at all when off', () => {
    expect(testHeaders(null)).toEqual({})
  })

  it('sends the uploader options as one JSON header when on', () => {
    expect(testHeaders(DEFAULT_TEST_SETTINGS)).toEqual({ [MOCK_UPLOADER_HEADER]: '{"minStepDelayMs":3000,"maxStepDelayMs":8000}' })
  })

  it('names the preset the numbers match, or Custom', () => {
    expect(presetNameFor({ minStepDelayMs: 0, maxStepDelayMs: 0 })).toBe('Instant')
    expect(presetNameFor({ minStepDelayMs: 3000, maxStepDelayMs: 8000 })).toBe('Design pace')
    expect(presetNameFor({ minStepDelayMs: 1, maxStepDelayMs: 2 })).toBe('Custom')
  })
})
