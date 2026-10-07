// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useEffect, useState } from 'react'
import type { MockHostConfig } from '../adapters/mock/index.ts'
import type { HardwareKind, PrepProgress, PrepareInterview, StartInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import {
  audioPrompt,
  barView,
  canStart,
  checklist,
  checkView,
  hostView,
  toHardwareForm,
  type CheckPhase,
  type Tone,
} from '../core/setup/hardware.ts'
import { ArrowIcon, CheckIcon, ErrorIcon, HourglassIcon } from './icons.tsx'
import { PageHeader } from './PageHeader.tsx'

const MARK: Record<Tone, string> = { ok: '✓', warn: '!', bad: '✕', neutral: '–' }
const PRESETS: ReadonlyArray<[string, string]> = [
  ['clean', 'Clean'],
  ['decent_call', 'Decent call'],
  ['laggy_clipped', 'Laggy / clipped'],
  ['bad_connection', 'Bad connection'],
  ['rough_day', 'Rough day'],
]

/**
 * Hardware setup and verification, built from design/mockups/ui/Hardware.dc.html. Preparation
 * runs while the user checks hardware, and Start interview waits for both (contracts/page-flow.md).
 *
 * Prototype: nothing is streamed from a microphone or camera. The host returns a scripted quality.
 */
export function HardwarePage({
  host,
  request,
  initialCaptions,
  config,
  onConfig,
  onBack,
  onStart,
  onOpenAccessibility,
}: {
  host: SetupHost
  request: PrepareInterview
  initialCaptions: boolean
  config: MockHostConfig
  onConfig: (config: MockHostConfig) => void
  onBack: () => void
  onStart: (start: StartInterview, captions: boolean) => void
  onOpenAccessibility: () => void
}) {
  const [prep, setPrep] = useState<PrepProgress>('preparing')
  const [attempt, setAttempt] = useState(0)
  const [audio, setAudio] = useState<CheckPhase>({ type: 'pending' })
  const [video, setVideo] = useState<CheckPhase>({ type: 'skipped' })
  const [captions, setCaptions] = useState(initialCaptions)
  const [preset, setPreset] = useState('clean')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    return host.prepareInterview(request, setPrep)
  }, [host, request, attempt])

  const check = async (kind: HardwareKind, set: (phase: CheckPhase) => void) => {
    set({ type: 'checking' })
    try {
      set({ type: 'done', quality: await host.verifyHardware(kind) })
    } catch {
      set({ type: 'errored' })
    }
  }

  const startable = canStart(prep, audio)
  const start = async () => {
    if (!startable || starting) return
    setStarting(true)
    setStartError(null)
    const startRequest = { form: toHardwareForm(audio, video, captions), sessionId: request.sessionId }
    try {
      await host.startInterview(startRequest) // the server can still refuse (not prepared, hardware not ready)
      onStart(startRequest, captions)
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'The interview could not start.')
      setStarting(false)
    }
  }

  const host_ = hostView[prep]
  const bar = barView[prep]
  const barLabelId = 'prep-label'

  return (
    <div className="page page-with-dock">
      <PageHeader title="Check your setup" subtitle="Step 2 of 2 · Hardware setup and verification" onOpenAccessibility={onOpenAccessibility}>
        <button type="button" className="btn" onClick={onBack}>
          Back to application setup
        </button>
      </PageHeader>

      <section aria-label="Host status" className={`banner banner-${host_.tone}`}>
        <span aria-hidden="true" className="banner-icon">
          {prep === 'ready' ? <CheckIcon /> : prep === 'diagnosing' ? <ErrorIcon /> : <HourglassIcon />}
        </span>
        <div>
          <h2>{host_.title}</h2>
          <p role="status">{host_.body}</p>
        </div>
      </section>

      {prep === 'diagnosing' && (
        <section aria-label="What went wrong" className="card">
          <h2>What the interviewer found</h2>
          <p>[DIAGNOSIS FROM THE AI MODELS, WITH STEPS TO FIX]</p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => {
                setPrep('preparing')
                setAttempt(attempt + 1)
              }}>
              Try preparing again
            </button>
            <button type="button" className="btn" onClick={onBack}>
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
              <select id="mic-pick">
                <option>[DEFAULT MICROPHONE]</option>
              </select>
            </div>
            <div className="row">
              <div className="meter meter-lg" aria-hidden="true">
                {[8, 16, 24, 14, 6, 6].map((h, i) => (
                  <span key={i} className={audio.type === 'checking' || audio.type === 'done' ? 'bar bar-on' : 'bar'} style={{ height: h }} />
                ))}
              </div>
              <p>{audioPrompt(audio)}</p>
            </div>
            <CheckStatus phase={audio} kind="audio" />
            <div>
              <button type="button" className="btn" aria-disabled={audio.type === 'checking'} onClick={() => audio.type !== 'checking' && void check('audio', setAudio)}>
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
            <p>{checkView(video, 'video').detail}</p>
            <div className="row">
              <button type="button" className="btn" aria-disabled={video.type === 'checking'} onClick={() => video.type !== 'checking' && void check('video', setVideo)}>
                {checkView(video, 'video').action}
              </button>
              <button type="button" className="btn" onClick={() => setVideo({ type: 'skipped' })}>
                Skip video
              </button>
            </div>
          </section>

          <section aria-label="Start the interview" className="card">
            <div>
              <button type="button" className={startable ? 'btn btn-big btn-primary' : 'btn btn-big btn-disabled'} aria-disabled={!startable} aria-describedby="start-reasons" onClick={() => void start()}>
                Start interview
                <ArrowIcon />
              </button>
            </div>
            {startError && (
              <p role="alert" className="note-box note-bad">
                {startError}
              </p>
            )}
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

      <section aria-label="Interview preparation progress" className="dock">
        <div className="dock-inner">
          <div className="row row-between">
            <span id={barLabelId}>{bar.label}</span>
            <span className="muted">{bar.note}</span>
          </div>
          <div
            role="progressbar"
            aria-labelledby={barLabelId}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={bar.now ?? undefined}
            aria-valuetext={bar.now === null ? `${bar.label}, in progress` : `${bar.label}, ${bar.now} percent`}
            className="track"
          >
            <div className={`fill fill-${bar.tone}${bar.now === null ? ' sweep' : ''}`} style={bar.now === null ? undefined : { width: `${bar.now}%` }} />
          </div>
        </div>
      </section>
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

function CheckStatus({ phase, kind }: { phase: CheckPhase; kind: HardwareKind }) {
  const view = checkView(phase, kind)
  return (
    <div role="status" className={`note-box note-${view.tone}`}>
      <span className="eyebrow">{view.chip}</span>
      <span>{view.detail}</span>
    </div>
  )
}
