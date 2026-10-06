import { useEffect, useMemo, useState } from 'react'
import { builtMockStream, mockScripts, ScriptedEventSource } from '../adapters/mock/index.ts'
import { SystemClock } from '../adapters/systemClock.ts'
import { WebAudioCuePlayer } from '../adapters/webAudioCuePlayer.ts'
import { CueEngine } from '../core/cues/index.ts'
import type { CueMode } from '../core/contract/index.ts'
import { CallConditions } from './CallConditions.tsx'
import { CaptionsSection } from './CaptionsSection.tsx'
import { ControlsCard } from './ControlsCard.tsx'
import { CuePanel } from './CuePanel.tsx'
import { PageHeader } from './PageHeader.tsx'
import { MicrophoneRow } from './MicrophoneRow.tsx'
import { SimulationBadge } from './SimulationBadge.tsx'
import { useCuePayload, useCueSounds } from './useCueEngine.ts'

const scriptNames = Object.keys(mockScripts)

function makeEngine(scriptName: string, mode: CueMode): CueEngine {
  const clock = new SystemClock()
  return new CueEngine(new ScriptedEventSource(builtMockStream(scriptName), clock), clock, mode)
}

/**
 * The interview screen, built from design/mockups/ui/Main.dc.html (iteration 1). The cue engine
 * and the mock interviewer are the real prototype parts; captions text, the microphone row and
 * the controls are drawn but not wired (see each component).
 */
export default function InterviewPage({
  captions,
  onCaptions,
  onOpenAccessibility,
}: {
  captions: boolean
  onCaptions: (enabled: boolean) => void
  onOpenAccessibility: () => void
}) {
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
    <div className="page">
      <PageHeader title="Practice interview" subtitle="Behavioral · Question 3 of 8 · [ROLE TITLE]" onOpenAccessibility={onOpenAccessibility}>
        <SimulationBadge simulation={payload.simulation} />
        <span className="pill pill-mono">cues: {mode}</span>
        <button type="button" className="btn">
          End session
        </button>
      </PageHeader>

      <div className="layout">
        <main className="layout-main">
          <CuePanel payload={payload} />
          <CaptionsSection enabled={captions} onEnabledChange={onCaptions} />
          <MicrophoneRow />
        </main>
        <aside aria-label="Controls" className="layout-side">
          <ControlsCard />
          <CallConditions
            payload={payload}
            scriptNames={scriptNames}
            scriptName={scriptName}
            onScript={chooseScript}
            mode={mode}
            onMode={chooseMode}
            started={started}
            onStart={start}
            muted={muted}
            onMuted={setMuted}
          />
        </aside>
      </div>
    </div>
  )
}
