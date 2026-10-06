// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { CUE_MODES, type CueMode } from '../core/contract/index.ts'
import type { CuePayload } from '../core/cues/index.ts'

const cueModeLabel: Record<CueMode, string> = {
  perceived: 'What has arrived (perceived)',
  true_state: 'Interviewer’s real state',
  debug: 'Both timelines (debug)',
}

const presetLabel = (preset: string): string =>
  ({ clean: 'Clean', decent_call: 'Decent call', laggy_clipped: 'Laggy / clipped', bad_connection: 'Bad connection' })[preset] ??
  preset

/**
 * The mockup's Call conditions card, plus the prototype's own harness controls (scenario, Start
 * and the sound toggle), which the mockup does not have. The preset is shown, not chosen: the
 * scenario sets it.
 */
export function CallConditions({
  payload,
  scriptNames,
  scriptName,
  onScript,
  mode,
  onMode,
  started,
  onStart,
  muted,
  onMuted,
}: {
  payload: CuePayload
  scriptNames: readonly string[]
  scriptName: string
  onScript: (name: string) => void
  mode: CueMode
  onMode: (mode: CueMode) => void
  started: boolean
  onStart: () => void
  muted: boolean
  onMuted: (muted: boolean) => void
}) {
  return (
    <section className="card" aria-labelledby="conditions-heading">
      <h3 id="conditions-heading">Call conditions</h3>
      <div className="field">
        <span className="muted">Preset</span>
        <span className="value" data-testid="preset">
          {presetLabel(payload.simulation.preset)}
        </span>
      </div>
      <div className="field">
        <label htmlFor="cuemode" className="muted">
          Cues follow
        </label>
        <select id="cuemode" value={mode} onChange={(e) => onMode(e.target.value as CueMode)}>
          {CUE_MODES.map((m) => (
            <option key={m} value={m}>
              {cueModeLabel[m]}
            </option>
          ))}
        </select>
      </div>
      {payload.modesIdentical && (
        <p className="note" data-testid="modes-note">
          No simulation is on, so both cue modes look the same right now.
        </p>
      )}
      <hr />
      <h4>Prototype harness</h4>
      <div className="field">
        <label htmlFor="scenario" className="muted">
          Scenario
        </label>
        <select id="scenario" value={scriptName} onChange={(e) => onScript(e.target.value)}>
          {scriptNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="btn" onClick={onStart}>
        {started ? 'Restart' : 'Start'}
      </button>
      <label className="check">
        <input type="checkbox" checked={!muted} onChange={(e) => onMuted(!e.target.checked)} /> Sound cues
      </label>
    </section>
  )
}
