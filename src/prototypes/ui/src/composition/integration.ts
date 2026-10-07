// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.

/** Which implementation backs the ports. Mock is the default everywhere; see docs/decisions/0004. */
export type IntegrationMode = 'mock' | 'real'
export const INTEGRATION_MODES: readonly IntegrationMode[] = ['mock', 'real']

export interface Integration {
  mode: IntegrationMode
  /** Where the API is, as the browser sees it. `/api` is the dev server's proxy (vite.config.ts), which avoids CORS. */
  apiBaseUrl: string
}

export const DEFAULT_API_BASE_URL = '/api'

/**
 * Reads the mode. Everything here is public: `VITE_` variables are bundled into the page, so
 * they hold a mode and a URL and never a secret (decision 0004). A bad value is an error, not a
 * silent fall back to mock, so nobody thinks they are testing the real thing when they are not.
 *
 * `?integration=real` in the address bar overrides the environment, for trying a mode by hand.
 */
export function readIntegration(env: { VITE_INTEGRATION?: string; VITE_API_URL?: string }, search: string): Integration {
  const wanted = new URLSearchParams(search).get('integration') ?? env.VITE_INTEGRATION ?? 'mock'
  const mode = INTEGRATION_MODES.find((m) => m === wanted)
  if (!mode) throw new Error(`Integration mode must be "mock" or "real", not "${wanted}".`)
  return { mode, apiBaseUrl: env.VITE_API_URL || DEFAULT_API_BASE_URL }
}
