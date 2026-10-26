// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { DEFAULT_TEST_SETTINGS, type TestSettings } from '../composition/testMode.ts'

const KEY = 'ai-interviewer.test-settings'

/** The tester's last settings for this tab, so a reload keeps them. Best effort: storage may be unavailable. */
export function loadTestSettings(): TestSettings {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TestSettings>
      const u = parsed.mockUploader
      if (u && typeof u.minStepDelayMs === 'number' && typeof u.maxStepDelayMs === 'number')
        return { mockUploader: { minStepDelayMs: u.minStepDelayMs, maxStepDelayMs: u.maxStepDelayMs } }
    }
  } catch {
    // no storage, or an unreadable value: start from the defaults
  }
  return DEFAULT_TEST_SETTINGS
}

export function saveTestSettings(settings: TestSettings): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // no storage: the settings last for this page only
  }
}
