import { useEffect, useMemo, useState } from 'react'
import { builtMockStream, mockScripts, ScriptedEventSource } from '../adapters/mock/index.ts'
import type { MediaPorts } from '../composition/media.ts'
import type { SetupHost } from '../core/ports.ts'
import { SystemClock } from '../adapters/systemClock.ts'
import { WebAudioCuePlayer } from '../adapters/webAudioCuePlayer.ts'
import { CueEngine } from '../core/cues/index.ts'
import type { CueMode } from '../core/contract/index.ts'
import { CallConditions } from './CallConditions.tsx'
import { CaptionsSection } from './CaptionsSection.tsx'
import { ControlsCard } from './ControlsCard.tsx'
import { CuePanel } from './CuePanel.tsx'
import { ModalDialog } from './ModalDialog.tsx'
import { PageHeader } from './PageHeader.tsx'
import { MicrophoneRow } from './MicrophoneRow.tsx'
import { SimulationBadge } from './SimulationBadge.tsx'
import { StatusBanner } from './StatusBanner.tsx'
import { TranscriptCard } from './TranscriptCard.tsx'
import { useCapture } from './useCapture.ts'
import { useCuePayload, useCueSounds } from './useCueEngine.ts'
import { useTranscript } from './useTranscript.ts'
import type { ChosenDevices } from './HardwarePage.tsx'

const scriptNames = Object.keys(mockScripts)

function makeEngine(scriptName: string, mode: CueMode): CueEngine {
  const clock = new SystemClock()
  return new CueEngine(new ScriptedEventSource(builtMockStream(scriptName), clock), clock, mode)
}

/**
 * The interview screen, built from design/mockups/ui/Main.dc.html. The cue engine and the mock
 * interviewer are the real prototype parts. Start also opens the microphone, and the camera when
 * one was chosen on the Hardware page, and streams them to the server (useCapture.ts); captions
 * text and the controls are drawn but not wired (see each component).
 */
export default function InterviewPage({
  captions,
  onCaptions,
  onOpenAccessibility,
  onEnd,
  media = null,
  host = null,
  sessionId,
  devices = { audioDeviceId: null, videoDeviceId: null },
}: {
  captions: boolean
  onCaptions: (enabled: boolean) => void
  onOpenAccessibility: () => void
  /** End interview, confirmed: the session is closed right away, without the interviewer's closing. */
  onEnd?: () => void
  /** The devices, recorder and uplink. Absent on a page rendered alone, when the microphone row says capture is not wired. */
  media?: MediaPorts | null
  /** The host, for the transcript over the hub. Absent on a page rendered alone: then no transcript card. */
  host?: SetupHost | null
  /** The session the streams belong to. A page opened directly makes one up. */
  sessionId?: string
  devices?: ChosenDevices
}) {
  const [scriptName, setScriptName] = useState(scriptNames[0] ?? '')
  const [endOpen, setEndOpen] = useState(false)
  const [ownSessionId] = useState(() => sessionId ?? `direct-${Math.random().toString(36).slice(2, 10)}`)
  const capture = useCapture({ media, sessionId: ownSessionId, audioDeviceId: devices.audioDeviceId, videoDeviceId: devices.videoDeviceId })
  const [mode, setMode] = useState<CueMode>('perceived')
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const player = useMemo(() => new WebAudioCuePlayer(), [])
  const [engine, setEngine] = useState(() => makeEngine(scriptName, mode))
  // The transcript is watched from Start until the page is left; what was said stays on screen.
  const transcript = useTranscript(host, ownSessionId, started)

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
    void capture.start() // inside the click too: the browser asks for the microphone on a gesture
  }

  return (
    <div className="page">
      <PageHeader title="Practice interview" subtitle="Behavioral · Question 3 of 8 · [ROLE TITLE]" onOpenAccessibility={onOpenAccessibility}>
        <SimulationBadge simulation={payload.simulation} />
        <span className="pill pill-mono">cues: {mode}</span>
      </PageHeader>

      {/* The shared banner's slot: reserved on every page, empty here until there is something to say. */}
      <StatusBanner kind="hidden" />

      <div className="layout">
        <main className="layout-main">
          <CuePanel payload={payload} />
          <CaptionsSection enabled={captions} onEnabledChange={onCaptions} />
          <MicrophoneRow capture={capture} />
          {host && <TranscriptCard transcript={transcript} />}
        </main>
        <aside aria-label="Controls" className="layout-side">
          <ControlsCard />
          <section aria-label="End the interview" className="card">
            <div>
              <button type="button" className="btn btn-danger" aria-haspopup="dialog" onClick={() => setEndOpen(true)}>
                End interview
              </button>
            </div>
            <p className="note">Ends the session right away. You will be asked to confirm.</p>
          </section>
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

      <ModalDialog open={endOpen} onClose={() => setEndOpen(false)} title="End the interview now?">
        <p>The session closes right away, without the interviewer’s closing. You cannot undo this.</p>
        <div className="row">
          {/* The safe choice comes first and takes focus. */}
          <button type="button" className="btn btn-primary" autoFocus onClick={() => setEndOpen(false)}>
            Keep going
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              engine.stop()
              setEndOpen(false)
              void capture.stop().then(() => onEnd?.())
            }}
          >
            End interview
          </button>
        </div>
      </ModalDialog>
    </div>
  )
}
