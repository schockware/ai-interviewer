// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// The HTTP adapter against a stand-in for the network: no API needs to run.
import { describe, expect, it } from 'vitest'
import { HttpSetupHost, toBase64 } from './httpSetupHost.ts'

interface Seen {
  url: string
  init?: RequestInit
}

const fakeFetch = (reply: (seen: Seen) => Response | Error) => {
  const calls: Seen[] = []
  const fn: typeof fetch = async (input, init) => {
    const seen = { url: String(input), init }
    calls.push(seen)
    const r = reply(seen)
    if (r instanceof Error) throw r
    return r
  }
  return { fn, calls }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('HttpSetupHost', () => {
  it('encodes bytes as base64, which is what the API reads', () => {
    expect(toBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=')
    expect(toBase64(new Uint8Array(70_000))).toHaveLength(Math.ceil(70_000 / 3) * 4)
  })

  it('GETs the setup page from the base URL, tolerating a trailing slash', async () => {
    const { fn, calls } = fakeFetch(() => json({ type: 'ready', form: {}, resumes: { type: 'none' }, roles: { type: 'none' } }))
    const page = await new HttpSetupHost('/api/', fn).loadPage()
    expect(calls[0].url).toBe('/api/application-setup')
    expect(page.type).toBe('ready')
  })

  it('rejects a page type it does not know, instead of passing it on', async () => {
    const { fn } = fakeFetch(() => json({ type: 'mystery' }))
    await expect(new HttpSetupHost('/api', fn).loadPage()).rejects.toThrow(/does not know/)
  })

  it('POSTs a resume with its payload as base64', async () => {
    const { fn, calls } = fakeFetch(() => json({ resumeId: 'r', displayName: 'cv' }))
    await new HttpSetupHost('/api', fn).uploadResume({ displayName: 'cv', fileName: 'cv.txt', payload: new TextEncoder().encode('hi') })
    expect(calls[0].url).toBe('/api/resumes')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ displayName: 'cv', fileName: 'cv.txt', payload: 'aGk=' })
  })

  it('turns the API’s { message } into the error the page shows', async () => {
    const { fn } = fakeFetch(() => json({ message: '"cv.pdf" cannot be read yet.' }, 422))
    await expect(new HttpSetupHost('/api', fn).pasteJobDescription({ displayName: 'x', text: 'y' })).rejects.toThrow('"cv.pdf" cannot be read yet.')
  })

  it('says plainly when the API answers with something that is not its error shape', async () => {
    const { fn } = fakeFetch(() => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }))
    await expect(new HttpSetupHost('/api', fn).loadPage()).rejects.toThrow(/502 Bad Gateway/)
  })

  it('says the API could not be reached when the network fails', async () => {
    const { fn } = fakeFetch(() => new TypeError('Failed to fetch'))
    await expect(new HttpSetupHost('/api', fn).loadPage()).rejects.toThrow(/Could not reach the API at \/api/)
  })

  it('reports preparing, then ready on 202', async () => {
    const { fn } = fakeFetch(() => new Response(null, { status: 202 }))
    const seen: string[] = []
    new HttpSetupHost('/api', fn).prepareInterview({ sessionId: 's', form: {} as never }, (p) => seen.push(p))
    expect(seen).toEqual(['preparing'])
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((r) => setTimeout(r))
    expect(seen).toEqual(['preparing', 'ready'])
  })

  it('reports diagnosing when the API refuses to prepare, and nothing once cancelled', async () => {
    const refused = fakeFetch(() => json({ message: 'not ready' }, 422))
    const seen: string[] = []
    new HttpSetupHost('/api', refused.fn).prepareInterview({ sessionId: 's', form: {} as never }, (p) => seen.push(p))
    await new Promise((r) => setTimeout(r))
    expect(seen).toEqual(['preparing', 'diagnosing'])

    const cancelled: string[] = []
    const stop = new HttpSetupHost('/api', fakeFetch(() => new Response(null, { status: 202 })).fn).prepareInterview({ sessionId: 's', form: {} as never }, (p) => cancelled.push(p))
    stop()
    await new Promise((r) => setTimeout(r))
    expect(cancelled).toEqual(['preparing'])
  })
})
