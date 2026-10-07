// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { SimulatedClock } from '../simulatedClock.ts'
import { describeSetupHostContract } from '../setupHostContract.ts'
import { defaultMockConfig, MockSetupHost } from './mockSetupHost.ts'

describeSetupHostContract('mock', () => {
  const clock = new SimulatedClock()
  return {
    host: new MockSetupHost(clock, () => defaultMockConfig),
    run: async (pending) => {
      clock.advance(60_000)
      return pending
    },
    until: async (done) => {
      clock.advance(60_000)
      if (!done()) throw new Error('The mock host did not finish')
    },
  }
})
