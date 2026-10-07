// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Spec: docs/decisions/0004-integration-modes-and-secrets.md. Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { SimulatedClock } from '../adapters/simulatedClock.ts'
import { defaultMockConfig } from '../adapters/mock/index.ts'
import { buildSetupHost } from './hosts.ts'
import { DEFAULT_API_BASE_URL, readIntegration } from './integration.ts'

describe('reading the integration mode', () => {
  it('is mock, through the dev proxy, when nothing is set', () => {
    expect(readIntegration({}, '')).toEqual({ mode: 'mock', apiBaseUrl: DEFAULT_API_BASE_URL })
  })
  it('takes the mode and URL from the environment', () => {
    expect(readIntegration({ VITE_INTEGRATION: 'real', VITE_API_URL: 'http://api.test' }, '')).toEqual({ mode: 'real', apiBaseUrl: 'http://api.test' })
  })
  it('lets the address bar override the environment', () => {
    expect(readIntegration({ VITE_INTEGRATION: 'mock' }, '?integration=real').mode).toBe('real')
  })
  it('refuses a mode it does not know, instead of falling back to mock', () => {
    expect(() => readIntegration({ VITE_INTEGRATION: 'live' }, '')).toThrow(/"live"/)
    expect(() => readIntegration({}, '?integration=')).toThrow()
  })
})

describe('building the setup host', () => {
  const clock = new SimulatedClock()
  it('is all mock in mock mode', () => {
    expect(buildSetupHost({ mode: 'mock', apiBaseUrl: '/api' }, clock, () => defaultMockConfig).parts).toEqual({ setup: 'mock', hardware: 'mock' })
  })
  it('uses the real API for setup but still mocks hardware, and says so', () => {
    expect(buildSetupHost({ mode: 'real', apiBaseUrl: '/api' }, clock, () => defaultMockConfig).parts).toEqual({ setup: 'real', hardware: 'mock' })
  })
})
