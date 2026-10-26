// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useState } from 'react'
import { MOCK_UPLOADER_HEADER, presetNameFor, testHeaders, UPLOADER_PRESETS, type MockUploaderOptions, type TestSettings } from '../composition/testMode.ts'

/**
 * The test drawer (?mode=test): a right-side panel, not in the mockups, where a tester or QA
 * engineer changes server-side settings. Each setting rides on every request to the API as a
 * header, so the API applies it to that request only. Open by default when test mode is on.
 */
export function TestDrawer({ settings, onChange, real }: { settings: TestSettings; onChange: (settings: TestSettings) => void; real: boolean }) {
  const [open, setOpen] = useState(true)
  const uploader = settings.mockUploader
  const header = testHeaders(settings)[MOCK_UPLOADER_HEADER]
  const setUploader = (options: MockUploaderOptions) => onChange({ ...settings, mockUploader: options })
  const whole = (raw: string, fallback: number): number => {
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
  }

  return (
    <>
      <button type="button" className="btn drawer-toggle" aria-expanded={open} aria-controls="test-drawer" onClick={() => setOpen(!open)}>
        Test settings
      </button>
      <aside id="test-drawer" aria-label="Test settings" className="drawer" hidden={!open} data-testid="test-drawer">
        <h2>Test settings</h2>
        <p className="muted">
          Test mode is on (<code>?mode=test</code>). These are server-side settings: every request to the API carries them as headers, and the API
          honors them only while its own test mode is on.
        </p>
        {!real && (
          <p className="note-box note-warn">
            The host is the mock, so these headers reach no server. The mock has its own harness cards on each page.
          </p>
        )}
        <section aria-labelledby="uploader-title">
          <h3 id="uploader-title">Mock resume uploader</h3>
          <div className="field">
            <label htmlFor="uploader-preset">Pace</label>
            <select
              id="uploader-preset"
              value={presetNameFor(uploader)}
              onChange={(e) => {
                const preset = UPLOADER_PRESETS.find((p) => p.name === e.target.value)
                if (preset) setUploader(preset.options)
              }}
            >
              {UPLOADER_PRESETS.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
              <option>Custom</option>
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="uploader-min">Min pause per step (ms)</label>
              <input
                id="uploader-min"
                type="number"
                min={0}
                step={100}
                value={uploader.minStepDelayMs}
                onChange={(e) => setUploader({ ...uploader, minStepDelayMs: whole(e.target.value, uploader.minStepDelayMs) })}
              />
            </div>
            <div className="field">
              <label htmlFor="uploader-max">Max pause per step (ms)</label>
              <input
                id="uploader-max"
                type="number"
                min={0}
                step={100}
                value={uploader.maxStepDelayMs}
                onChange={(e) => setUploader({ ...uploader, maxStepDelayMs: whole(e.target.value, uploader.maxStepDelayMs) })}
              />
            </div>
          </div>
          <p className="note">Applies to the next resume you load. The server refuses a minimum above the maximum.</p>
          <p className="note">
            Header sent: <code>{MOCK_UPLOADER_HEADER}: {header}</code>
          </p>
        </section>
      </aside>
    </>
  )
}
