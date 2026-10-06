import { useEffect, useMemo, useState } from 'react'
import { builtMockStream, mockScripts, ScriptedEventSource } from '../adapters/mock/index.ts'
import { SystemClock } from '../adapters/systemClock.ts'
import { WebAudioCuePlayer } from '../adapters/webAudioCuePlayer.ts'
import { CueEngine } from '../core/cues/index.ts'
import { CUE_MODES, type CueMode } from '../core/contract/index.ts'
import { CuePanel } from './CuePanel.tsx'
import { useCuePayload, useCueSounds } from './useCueEngine.ts'

const modeLabel: Record<CueMode, string> = {
  perceived: 'Perceived (what arrives through the call)',
  true_state: 'True state (the instant it happens)',
  debug: 'Debug (both timelines)',
}

const scriptNames = Object.keys(mockScripts)

function makeEngine(scriptName: string, mode: CueMode): CueEngine {
  const clock = new SystemClock()
  return new CueEngine(new ScriptedEventSource(builtMockStream(scriptName), clock), clock, mode)
}

export default function App() {
  const [scriptName, setScriptName] = useState(scriptNames[0] ?? '')
  const [mode, setMode] = useState<CueMode>('perceived')
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const player = useMemo(() => new WebAudioCuePlayer(), [])
  const [engine, setEngine] = useState(() => makeEngine(scriptName, mode))

  useEffect(() => () => engine.stop(), [engine])
  useEffect(() => player.setMuted(muted), [muted, player])

  const payload = useCuePayload(engine)
  useCueSounds(payload, player)

  const chooseScript = (name: string) => {
    setScriptName(name)
    setStarted(false)
    setEngine(makeEngine(name, mode))
  }
  const chooseMode = (next: CueMode) => {
    setMode(next)
    engine.setMode(next) // takes effect at once, with no restart (CUE-MOD-002)
  }
  const start = () => {
    player.unlock() // inside the click, so sound is never played on its own (CUE-AMB-001)
    const next = makeEngine(scriptName, mode)
    setEngine(next)
    setStarted(true)
    next.start()
  }

  return (
    <main>
      <h1>AI Interviewer: UI prototype</h1>
      <p>A scripted mock interviewer. No microphone and no models are used.</p>

      <div className="controls">
        <label>
          Scenario{' '}
          <select value={scriptName} onChange={(e) => chooseScript(e.target.value)}>
            {scriptNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={start}>
          {started ? 'Restart' : 'Start'}
        </button>
        <label>
          <input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} /> Sound cues
        </label>
      </div>

      <fieldset>
        <legend>Cue mode</legend>
        {CUE_MODES.map((m) => (
          <label key={m} className="mode">
            <input type="radio" name="cue-mode" checked={mode === m} onChange={() => chooseMode(m)} /> {modeLabel[m]}
          </label>
        ))}
        {payload.modesIdentical && (
          <p data-testid="modes-note">No simulation is active, so Perceived and True state look the same.</p>
        )}
      </fieldset>

      <CuePanel payload={payload} />
    </main>
  )
}
