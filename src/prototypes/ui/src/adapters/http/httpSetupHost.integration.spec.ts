// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Needs the API prototype running. Not part of `npm test`: run `npm run test:integration`
// (start the API with `dotnet run --project ../api/src/AiInterviewer.Api`).
// No secrets are involved: the API prototype needs none. INTEGRATION_API_URL is a plain address.
import { describe, expect, it } from 'vitest'
import { buildSetupHost } from '../../composition/hosts.ts'
import { defaultMockConfig } from '../mock/mockSetupHost.ts'
import { SystemClock } from '../systemClock.ts'
import { describeSetupHostContract } from '../setupHostContract.ts'
import { HttpSetupHost } from './httpSetupHost.ts'

const baseUrl = process.env.INTEGRATION_API_URL ?? 'http://localhost:5036'
const reachable = await fetch(`${baseUrl}/application-setup`).then((r) => r.ok, () => false)

if (!reachable) {
  // Skipping must be loud. INTEGRATION_REQUIRED=1 (CI) turns the skip into a failure.
  const message = `The API is not reachable at ${baseUrl}. Start it, or set INTEGRATION_API_URL.`
  if (process.env.INTEGRATION_REQUIRED) {
    describe('real API', () => {
      it('is reachable', () => {
        throw new Error(message)
      })
    })
  } else {
    console.warn(`SKIPPING real-API tests. ${message}`)
    describe.skip('real API (not reachable)', () => {
      it('is reachable', () => {})
    })
  }
} else {
  describeSetupHostContract('real API', () => {
    // Through the composition root, so the real mode's wiring is tested too (hardware stays mock there).
    const { host } = buildSetupHost({ mode: 'real', apiBaseUrl: baseUrl }, new SystemClock(), () => defaultMockConfig)
    return {
      host,
      run: (pending) => pending,
      until: async (done) => {
        for (let waited = 0; waited < 5000 && !done(); waited += 100) await new Promise((r) => setTimeout(r, 100))
        if (!done()) throw new Error('The API did not finish within 5 seconds')
      },
    }
  })

  describe('real API refusals', () => {
    const host = new HttpSetupHost(baseUrl)
    it('refuses to start an interview that was never prepared, with the server’s words', async () => {
      await expect(
        host.startInterview({
          sessionId: 'never-prepared',
          form: { audio: { status: 'verified', quality: 'clear' }, video: { status: 'skipped', quality: 'skipped' }, training: { captions: 'disabled' } },
        }),
      ).rejects.toThrow(/No interview was prepared/)
    })
    it('refuses a resume it cannot read yet, naming the file', async () => {
      await expect(host.uploadResume({ displayName: 'x', fileName: 'cv.pdf', payload: new Uint8Array([1]) })).rejects.toThrow(/cv\.pdf/)
    })
  })
}
