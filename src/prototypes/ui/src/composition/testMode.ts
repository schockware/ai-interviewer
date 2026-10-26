// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.

/**
 * Test mode: `?mode=test` in the address bar. It reveals the test drawer, and every request to the
 * API then carries the tester's server-side settings as headers, one header per setting, so the
 * same build serves a quick integration run and a slow UX session. The API honors the headers
 * only while its own TestMode:Enabled is on; otherwise it answers 400 and the page shows why.
 * These are public test knobs, never secrets (decision 0004).
 */
export const TEST_MODE_PARAM = 'mode'
export const TEST_MODE_VALUE = 'test'

export const readTestMode = (search: string): boolean => new URLSearchParams(search).get(TEST_MODE_PARAM) === TEST_MODE_VALUE

/** Mirrors the API's MockUploaderOptionsDto: how long the mock resume uploader pauses between steps. */
export interface MockUploaderOptions {
  minStepDelayMs: number
  maxStepDelayMs: number
}

/** Everything the drawer can set. Each field becomes one request header. */
export interface TestSettings {
  mockUploader: MockUploaderOptions
}

export const MOCK_UPLOADER_HEADER = 'X-Mock-Uploader-Options'

/** The API's own default pace (its appsettings.json), so the drawer starts where the server is. */
export const SERVER_DEFAULT_UPLOADER: MockUploaderOptions = { minStepDelayMs: 3000, maxStepDelayMs: 8000 }

export const UPLOADER_PRESETS: ReadonlyArray<{ name: string; options: MockUploaderOptions }> = [
  { name: 'Instant', options: { minStepDelayMs: 0, maxStepDelayMs: 0 } },
  { name: 'Quick', options: { minStepDelayMs: 200, maxStepDelayMs: 600 } },
  { name: 'Design pace', options: SERVER_DEFAULT_UPLOADER },
]
export const INSTANT_UPLOADER: MockUploaderOptions = UPLOADER_PRESETS[0].options

export const DEFAULT_TEST_SETTINGS: TestSettings = { mockUploader: SERVER_DEFAULT_UPLOADER }

/** One header per setting. Nothing when test mode is off, so an ordinary run sends no test header at all. */
export function testHeaders(settings: TestSettings | null): Record<string, string> {
  return settings ? { [MOCK_UPLOADER_HEADER]: JSON.stringify(settings.mockUploader) } : {}
}

export const presetNameFor = (options: MockUploaderOptions): string =>
  UPLOADER_PRESETS.find((p) => p.options.minStepDelayMs === options.minStepDelayMs && p.options.maxStepDelayMs === options.maxStepDelayMs)?.name ?? 'Custom'
