// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useEffect, useRef, useState } from 'react'
import type { MockHostConfig } from '../adapters/mock/index.ts'
import type { HardwareKind, StartInterview } from '../core/contract/pageFlow.ts'
import { errorNameOf, litBars, permissionMessage } from '../core/media/capture.ts'
import type { LevelMeter, MediaDeviceChoice, MediaDevicesPort, OpenedStream, SetupHost } from '../core/ports.ts'
import { audioPrompt, canStart, checklist, checkView, toHardwareForm, type CheckPhase, type Tone } from '../core/setup/hardware.ts'
import { bannerKind } from '../core/setup/status.ts'
import { ArrowIcon } from './icons.tsx'
import { PageHeader } from './PageHeader.tsx'
import { PrepProgressBar } from './PrepProgressBar.tsx'
import { StatusBanner } from './StatusBanner.tsx'
import { usePreparation } from './preparation.ts'
import { usePreparationSteps } from './usePreparationSteps.ts'

const MARK: Record<Tone, string> = { ok: '✓', warn: '!', bad: '✕', neutral: '–' }
const PRESETS: ReadonlyArray<[string, string]> = [
  ['clean', 'Clean'],
  ['decent_call', 'Decent call'],
  ['laggy_clipped', 'Laggy / clipped'],
  ['bad_connection', 'Bad connection'],
  ['rough_day', 'Rough day'],
]
const METER = [8, 16, 24, 14, 6, 6]

/** The devices the interview will capture with. `videoDeviceId` null means no video; '' the default camera. */
export interface ChosenDevices {
  audioDeviceId: string | null
  videoDeviceId: string | null
}

/**
 * Hardware setup and verification, built from design/mockups/ui/Hardware.dc.html. The checks open
 * the real microphone and camera through the devices port: the meter shows the live level and the
 * camera a preview, while the host rates the quality (still scripted: the API has no verify
 * endpoint). Ready for interview needs the audio check only; the Waiting room covers whatever is
 * still being built (specs/page-flow.md, section 2).
 */
export function HardwarePage({
  host,
  media,
  initialCaptions,
  config,
  onConfig,
  onBack,
  onChangeSetup,
  onReady,
  onOpenAccessibility,
}: {
  host: SetupHost
  media: MediaDevicesPort
  initialCaptions: boolean
  config: MockHostConfig
  onConfig: (config: MockHostConfig) => void
  /** Back to Role set up, the page before. */
  onBack: () => void
  /** Back to Application setup, from the diagnosis card. */
  onChangeSetup: () => void
  /** The user is ready: on to the Waiting room with the hardware form the interview will start with, and the devices it will use. */
  onReady: (start: StartInterview, captions: boolean, devices: ChosenDevices) => void
  onOpenAccessibility: () => void
}) {
  const preparation = usePreparation()
  const steps = usePreparationSteps()
  const prep = steps.prep ?? 'preparing'
  const [audio, setAudio] = useState<CheckPhase>({ type: 'pending' })
  const [video, setVideo] = useState<CheckPhase>({ type: 'skipped' })
  const [captions, setCaptions] = useState(initialCaptions)
  const [preset, setPreset] = useState('clean')
  const [choices, setChoices] = useState<MediaDeviceChoice[]>([])
  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(null)
  const [videoDeviceId, setVideoDeviceId] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const [deviceError, setDeviceError] = useState<{ kind: HardwareKind; message: string } | null>(null)
  const camera = useRef<OpenedStream | null>(null)
  const previewRef = useRef<HTMLVideoElement>(null)

  // Device names only appear once the browser has allowed a device, so the list is read again after each check.
  useEffect(() => {
    let live = true
    media
      .list()
      .then((all) => live && setChoices(all))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [media, audio.type, video.type])

  // Leaving the page closes the camera.
  useEffect(
    () => () => {
      camera.current?.stop()
      camera.current = null
    },
    [],
  )

  const checkAudio = async () => {
    setAudio({ type: 'checking' })
    setDeviceError(null)
    let stream: OpenedStream
    let meter: LevelMeter
    try {
      stream = await media.openAudio(audioDeviceId)
      meter = media.meter(stream)
    } catch (e) {
      setDeviceError({ kind: 'audio', message: permissionMessage(errorNameOf(e), 'microphone') })
      setAudio({ type: 'errored' })
      return
    }
    const timer = setInterval(() => setLevel(meter.read()), 100)
    try {
      setAudio({ type: 'done', quality: await host.verifyHardware('audio') })
    } catch {
      setAudio({ type: 'errored' })
    } finally {
      clearInterval(timer)
      meter.stop()
      stream.stop()
      setLevel(0)
    }
  }

  const checkVideo = async () => {
    setVideo({ type: 'checking' })
    setDeviceError(null)
    camera.current?.stop()
    try {
      const stream = await media.openVideo(videoDeviceId)
      camera.current = stream
      if (previewRef.current) media.preview(stream, previewRef.current)
    } catch (e) {
      setDeviceError({ kind: 'video', message: permissionMessage(errorNameOf(e), 'camera') })
      setVideo({ type: 'errored' })
      return
    }
    try {
      setVideo({ type: 'done', quality: await host.verifyHardware('video') })
    } catch {
      setVideo({ type: 'errored' })
    }
  }

  const skipVideo = () => {
    camera.current?.stop()
    camera.current = null
    setVideo({ type: 'skipped' })
  }

  const startable = canStart(audio)
  const ready = () => {
    if (!startable || !preparation.request) return
    camera.current?.stop()
    camera.current = null
    onReady({ form: toHardwareForm(audio, video, captions), sessionId: preparation.request.sessionId }, captions, {
      audioDeviceId,
      videoDeviceId: video.type === 'done' ? (videoDeviceId ?? '') : null,
    })
  }

  const startNote =
    prep === 'ready'
      ? 'Your interview is ready, so the waiting room lets you straight in.'
      : prep === 'diagnosing'
        ? 'The host hit a problem. The waiting room shows what we found.'
        : 'Your interview is still being built. You will wait for it in the waiting room.'
  const mics = choices.filter((c) => c.kind === 'audioinput')
  const cams = choices.filter((c) => c.kind === 'videoinput')
  const lit = audio.type === 'checking' ? litBars(level, METER.length) : audio.type === 'done' ? 4 : 0

  return (
    <div className="page page-with-dock">
      <PageHeader title="Check your setup" subtitle="Step 3 of 4 · Hardware setup and verification" onOpenAccessibility={onOpenAccessibility}>
        <button type="button" className="btn" onClick={onBack}>
          Back to role set up
        </button>
      </PageHeader>

      <StatusBanner kind={bannerKind(steps.uploading, prep)} what={steps.uploading} />

      {prep === 'diagnosing' && (
        <section aria-label="What went wrong" className="card">
          <h2>What the interviewer found</h2>
          <p>[DIAGNOSIS FROM THE AI MODELS, WITH STEPS TO FIX]</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={preparation.retry}>
              Try preparing again
            </button>
            <button type="button" className="btn" onClick={onChangeSetup}>
              Change application setup
            </button>
          </div>
        </section>
      )}

      <div className="layout">
        <main className="layout-main">
          <section aria-labelledby="audio-title" className="card">
            <div className="row row-between">
              <h2 id="audio-title">
                Audio check <span className="muted">(required)</span>
              </h2>
              <Chip tone={checkView(audio, 'audio').tone} text={checkView(audio, 'audio').chip} />
            </div>
            <div className="field">
              <label htmlFor="mic-pick">Microphone</label>
              <select id="mic-pick" value={audioDeviceId ?? ''} onChange={(e) => setAudioDeviceId(e.target.value || null)} disabled={audio.type === 'checking'}>
                <option value="">Default microphone</option>
                {mics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="meter meter-lg" aria-hidden="true">
                {METER.map((h, i) => (
                  <span key={i} className={i < lit ? 'bar bar-on' : 'bar'} style={{ height: h }} />
                ))}
              </div>
              <p>{audioPrompt(audio)}</p>
            </div>
            <CheckStatus phase={audio} kind="audio" detail={deviceError?.kind === 'audio' ? deviceError.message : undefined} />
            <div>
              <button type="button" className="btn" aria-disabled={audio.type === 'checking'} onClick={() => audio.type !== 'checking' && void checkAudio()}>
                {checkView(audio, 'audio').action}
              </button>
            </div>
          </section>

          <section aria-labelledby="video-title" className="card">
            <div className="row row-between">
              <h2 id="video-title">
                Video check <span className="muted">(optional)</span>
              </h2>
              <Chip tone={checkView(video, 'video').tone} text={checkView(video, 'video').chip} />
            </div>
            <div className="field">
              <label htmlFor="cam-pick">Camera</label>
              <select id="cam-pick" value={videoDeviceId ?? ''} onChange={(e) => setVideoDeviceId(e.target.value || null)} disabled={video.type === 'checking'}>
                <option value="">Default camera</option>
                {cams.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              {(video.type === 'checking' || video.type === 'done') && <video ref={previewRef} className="preview" autoPlay playsInline muted aria-label="Your camera" data-testid="camera-preview" />}
              <p className="grow">{deviceError?.kind === 'video' ? deviceError.message : checkView(video, 'video').detail}</p>
            </div>
            <div className="row">
              <button type="button" className="btn" aria-disabled={video.type === 'checking'} onClick={() => video.type !== 'checking' && void checkVideo()}>
                {checkView(video, 'video').action}
              </button>
              <button type="button" className="btn" onClick={skipVideo}>
                Skip video
              </button>
            </div>
          </section>

          <section aria-label="Ready for the interview" className="card">
            <div>
              <button type="button" className={startable ? 'btn btn-big btn-primary' : 'btn btn-big btn-disabled'} aria-disabled={!startable} aria-describedby="start-reasons" onClick={ready}>
                Ready for interview
                <ArrowIcon />
              </button>
            </div>
            <p className="muted">{startNote}</p>
            <ul id="start-reasons" className="checklist">
              {checklist(prep, audio, video).map((c) => (
                <li key={c.name}>
                  <span aria-hidden="true" className={`mark mark-${c.tone}`}>
                    {MARK[c.tone]}
                  </span>
                  <span>
                    <b>{c.name}</b> · {c.state}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <aside aria-label="Advanced training options" className="layout-side">
          <section aria-labelledby="adv-title" className="card">
            <h2 id="adv-title">Advanced training options</h2>
            <div className="field">
              <div className="row row-between">
                <span id="cap-label">Captions on by default</span>
                <button type="button" role="switch" aria-checked={captions} aria-labelledby="cap-label" className={captions ? 'switch switch-on' : 'switch'} onClick={() => setCaptions(!captions)}>
                  <span className="knob" aria-hidden="true" />
                  <span>{captions ? 'On' : 'Off'}</span>
                </button>
              </div>
              <p className="muted">Most online interviews do not have a captioning system. It is defaulted to be off.</p>
            </div>
            <div className="field">
              <label htmlFor="preset">Simulated call conditions</label>
              <select id="preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
                {PRESETS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {preset === 'clean' ? (
                <span className="muted">Adds network delay and packet loss. Off by default.</span>
              ) : (
                <p className="help">
                  Cues and audio will arrive late and may drop out, like a real call. A “Simulated” badge stays on screen during the interview.
                </p>
              )}
            </div>
            <div className="field">
              <span>Training modules</span>
              <span className="muted">[TRAINING MODULES]</span>
            </div>
          </section>

          <section className="card" aria-labelledby="hw-harness-title">
            <h3 id="hw-harness-title">Prototype harness: mock devices</h3>
            <p className="note">The microphone and camera are real. The quality rating is still scripted, because the API has no verify endpoint.</p>
            {(['audio', 'video'] as const).map((kind) => (
              <div key={kind} className="field">
                <label htmlFor={`h-${kind}`} className="muted">
                  {kind === 'audio' ? 'Audio check result' : 'Video check result'}
                </label>
                <select id={`h-${kind}`} value={config[kind]} onChange={(e) => onConfig({ ...config, [kind]: e.target.value as MockHostConfig['audio'] })}>
                  {['clear', 'intermittent', 'readable', 'unreadable', 'errored'].map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              </div>
            ))}
            <p className="note">The call condition chosen above is shown, not applied: the interview page still plays the simulation-off scenario.</p>
          </section>
        </aside>
      </div>

      <PrepProgressBar prep={steps.prep} percent={steps.percent} />
    </div>
  )
}

function Chip({ tone, text }: { tone: Tone; text: string }) {
  return (
    <span className={`chip chip-${tone}`}>
      <span aria-hidden="true">{MARK[tone]}</span>
      {text}
    </span>
  )
}

function CheckStatus({ phase, kind, detail }: { phase: CheckPhase; kind: HardwareKind; detail?: string }) {
  const view = checkView(phase, kind)
  return (
    <div role="status" className={`note-box note-${view.tone}`}>
      <span className="eyebrow">{view.chip}</span>
      <span>{detail ?? view.detail}</span>
    </div>
  )
}
