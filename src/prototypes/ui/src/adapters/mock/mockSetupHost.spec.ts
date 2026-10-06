// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { describe, expect, it } from 'vitest'
import type { PrepProgress } from '../../core/contract/pageFlow.ts'
import { SimulatedClock } from '../simulatedClock.ts'
import { defaultMockConfig, MockSetupHost, MOCK_DELAYS, type MockHostConfig } from './mockSetupHost.ts'

const run = (config: Partial<MockHostConfig>) => {
  const clock = new SimulatedClock()
  return { clock, host: new MockSetupHost(clock, () => ({ ...defaultMockConfig, ...config })) }
}

describe('MockSetupHost', () => {
  it('loads the page with saved resumes and roles, or none', async () => {
    const some = run({})
    const p = some.host.loadPage()
    some.clock.advance(MOCK_DELAYS.load)
    expect(await p).toMatchObject({ type: 'ready', resumes: { type: 'ready' }, roles: { type: 'ready' } })

    const none = run({ saved: 'none' })
    const q = none.host.loadPage()
    none.clock.advance(MOCK_DELAYS.load)
    expect(await q).toMatchObject({ type: 'ready', resumes: { type: 'none' }, roles: { type: 'none' } })
  })

  it('answers a failing load with the error state', async () => {
    const { clock, host } = run({ load: 'fails' })
    const p = host.loadPage()
    clock.advance(MOCK_DELAYS.load)
    expect(await p).toMatchObject({ type: 'error' })
  })

  it.each([
    ['succeeds', ['preparing', 'ready']],
    ['retries-then-succeeds', ['preparing', 'retrying', 'ready']],
    ['fails', ['preparing', 'retrying', 'diagnosing']],
  ] as const)('prepares in the order %s', (preparation, expected) => {
    const { clock, host } = run({ preparation })
    const seen: PrepProgress[] = []
    host.prepareInterview({}, (p) => seen.push(p))
    clock.advance(60_000)
    expect(seen).toEqual(expected)
  })

  it('stops reporting once cancelled', () => {
    const { clock, host } = run({})
    const seen: PrepProgress[] = []
    host.prepareInterview({}, (p) => seen.push(p))()
    clock.advance(60_000)
    expect(seen).toEqual(['preparing'])
  })

  it('rejects a hardware check the harness set to errored', async () => {
    const { clock, host } = run({ audio: 'errored' })
    const p = host.verifyHardware('audio')
    clock.advance(MOCK_DELAYS.verify)
    await expect(p).rejects.toThrow()
  })
})
