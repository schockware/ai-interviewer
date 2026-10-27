// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useRef, useState, type Dispatch } from 'react'
import type { MockHostConfig } from '../adapters/mock/index.ts'
import type { ApplicationSetupPage } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import { displayNameOf, setupBlockers, type SetupAction, type SetupState } from '../core/setup/setupState.ts'
import { bannerKind, uploadingOf } from '../core/setup/status.ts'
import { changedSlots, choiceFromKey, choiceKey, SLOT_VIEWS } from '../core/setup/slots.ts'
import { ArrowIcon, CheckIcon, ErrorIcon, HourglassIcon, SettingsIcon, UploadIcon } from './icons.tsx'
import { ModalDialog } from './ModalDialog.tsx'
import { PageHeader } from './PageHeader.tsx'
import { PrepProgressBar } from './PrepProgressBar.tsx'
import { useResumeUploads } from './resumeUploads.ts'
import { StatusBanner } from './StatusBanner.tsx'
import { usePreparationSteps } from './usePreparationSteps.ts'

const nameOf = (fileName: string): string => fileName.replace(/\.[^.]+$/, '')

/**
 * Application setup, step 1 of 4, built from design/mockups/ui/Setup.dc.html and SetupHot.dc.html:
 * the AI models, the interview type with the resume under Hot, and the Role set up button, which
 * only waits while a hot interview has no resume at all. An upload never stops the user. The form
 * itself lives in SetupFlow; this page shows the load states and the first half of the form. The
 * shared banner says what is uploading, and shows the preparation if the user comes back while it
 * runs; the shared bar then shows at the bottom too (specs/page-flow.md, section 1).
 */
export function SetupPage({
  page,
  s,
  dispatch,
  host,
  config,
  onConfig,
  showMockServer,
  onRetry,
  onRoleSetup,
  onOpenAccessibility,
}: {
  page: ApplicationSetupPage
  /** null until the page is ready. */
  s: SetupState | null
  dispatch: Dispatch<SetupAction>
  host: SetupHost
  config: MockHostConfig
  onConfig: (config: MockHostConfig) => void
  /** The harness card only means something while the host is the mock. */
  showMockServer: boolean
  onRetry: () => void
  onRoleSetup: () => void
  onOpenAccessibility: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const steps = usePreparationSteps()

  return (
    <div className={steps.prep ? 'page page-with-dock' : 'page'}>
      <PageHeader title="Set up your interview" subtitle="Step 1 of 4 · Application setup" onOpenAccessibility={onOpenAccessibility}>
        <button type="button" className="btn" aria-expanded={settingsOpen} aria-controls="app-settings" onClick={() => setSettingsOpen(!settingsOpen)}>
          <SettingsIcon />
          Application settings
        </button>
      </PageHeader>
      <p className="muted">[STANDARD AI DISCLAIMER]</p>

      {page.type === 'loading' && (
        <section aria-label="Loading your setup" className="card">
          <p role="status">Loading your settings…</p>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skel" aria-hidden="true" />
          ))}
        </section>
      )}

      {page.type === 'error' && (
        <section role="alert" aria-label="Setup could not load" className="card card-error row">
          <ErrorIcon />
          <div className="grow">
            <h2>We could not load your setup</h2>
            <p>{page.message}</p>
          </div>
          <button type="button" className="btn" onClick={onRetry}>
            Try again
          </button>
        </section>
      )}

      {page.type === 'ready' && s && (
        <SetupForm s={s} dispatch={dispatch} host={host} settingsOpen={settingsOpen} config={config} onConfig={onConfig} showMockServer={showMockServer} onRoleSetup={onRoleSetup} />
      )}

      <PrepProgressBar prep={steps.prep} percent={steps.percent} />
    </div>
  )
}

function SetupForm({
  s,
  dispatch,
  host,
  settingsOpen,
  config,
  onConfig,
  showMockServer,
  onRoleSetup,
}: {
  s: SetupState
  dispatch: Dispatch<SetupAction>
  host: SetupHost
  settingsOpen: boolean
  config: MockHostConfig
  onConfig: (config: MockHostConfig) => void
  showMockServer: boolean
  onRoleSetup: () => void
}) {
  const steps = usePreparationSteps()
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const resumeInput = useRef<HTMLInputElement>(null)
  const uploads = useResumeUploads()

  const reasons = setupBlockers(s)
  const disabled = reasons.length > 0

  const loadResume = async (file: File) => {
    setError(null)
    dispatch({ type: 'resumeProcessing', fileName: file.name })
    try {
      const processed = await host.uploadResume({ displayName: nameOf(file.name), fileName: file.name, payload: new Uint8Array(await file.arrayBuffer()) })
      dispatch({ type: 'resumeProcessed', processed })
      uploads.track(processed.resumeId, processed.displayName) // the server keeps processing; the banner and the waiting room show it
    } catch (e) {
      dispatch({ type: 'resumeFailed' })
      setError(e instanceof Error ? e.message : 'The upload failed.')
    }
  }

  // Uploading: a request in flight, or a resume loaded this session that the server is still reading.
  const uploading = uploadingOf(s.resumeProcessing !== null || steps.uploading !== 'none', s.jdProcessing)

  const hot = s.wants === 'hot'
  const resumeName = displayNameOf(s.resumes, s.resumeId)

  return (
    <>
      <StatusBanner kind={bannerKind(uploading, steps.prep)} what={uploading} />
      <div className="layout">
        <main className="layout-main">
          {settingsOpen && (
            <section id="app-settings" aria-labelledby="settings-title" className="card">
              <h2 id="settings-title">Application settings</h2>
              <p className="muted">Switch the AI models and set up cloud access. The first choice in each list is the default.</p>
              <div className="grid-auto">
                {SLOT_VIEWS.map((slot) => (
                  <div key={slot.slot} className="field">
                    <label htmlFor={`slot-${slot.slot}`}>{slot.label}</label>
                    <select
                      id={`slot-${slot.slot}`}
                      value={choiceKey(s.ai[slot.slot])}
                      onChange={(e) => {
                        const choice = choiceFromKey(slot.slot, e.target.value)
                        dispatch({ type: 'ai', slot: slot.slot, choice })
                        if (typeof choice !== 'string') setAdvanced(true)
                      }}
                    >
                      {slot.options.map((o) => (
                        <option key={choiceKey(o.choice)} value={choiceKey(o.choice)}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="muted">{slot.note}</span>
                  </div>
                ))}
              </div>
              <p className="note">
                Custom (local) models open Advanced settings. Cloud options only list supported integrations, and need an access key you set up there. [ACCESS KEY SETUP]
              </p>
              <div>
                <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setAdvanced(true)}>
                  Advanced settings…
                </button>
              </div>
            </section>
          )}

          <section aria-labelledby="type-title" className="card">
            <h2 id="type-title">Interview type</h2>
            <div role="radiogroup" aria-labelledby="type-title" className="grid-2">
              <label className={hot ? 'radio-card' : 'radio-card radio-card-on'}>
                <span className="row">
                  <input type="radio" name="itype" value="cold" checked={!hot} onChange={() => dispatch({ type: 'wants', wants: 'cold' })} />
                  Cold interview <span className="pill">Default</span>
                </span>
                <span className="muted">The interviewer ignores any resume and goes off standard questions. Many AI pre-screens are cold interviews only.</span>
              </label>
              <label className={hot ? 'radio-card radio-card-on' : 'radio-card'}>
                <span className="row">
                  <input type="radio" name="itype" value="hot" checked={hot} onChange={() => dispatch({ type: 'wants', wants: 'hot' })} />
                  Hot interview
                </span>
                <span className="muted">The interviewer reads your resume and uses it for a few questions or for interview flavor.</span>
              </label>
            </div>

            {hot && (
              <div className="stack" data-testid="resume-panel">
                {s.resumes.length > 0 && (
                  <div className="field">
                    <label htmlFor="resume-pick">Use an existing resume</label>
                    <select id="resume-pick" value={s.resumeId ?? ''} disabled={s.resumeProcessing !== null} onChange={(e) => dispatch({ type: 'pickResume', resumeId: e.target.value })}>
                      {s.resumes.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <span className="muted">Newest first. Starts on the last resume you picked, if it still exists.</span>
                  </div>
                )}
                <div className="field">
                  <span id="load-label">
                    Load a resume <span className="muted">(required for a hot interview)</span>
                  </span>
                  <div className="row">
                    <input ref={resumeInput} type="file" hidden aria-hidden="true" tabIndex={-1} data-testid="resume-file" onChange={(e) => e.target.files?.[0] && loadResume(e.target.files[0])} />
                    <button
                      type="button"
                      className="btn"
                      aria-describedby="load-label"
                      aria-disabled={s.resumeProcessing !== null}
                      onClick={() => s.resumeProcessing === null && resumeInput.current?.click()}
                    >
                      <UploadIcon />
                      {s.resumes.length > 0 ? 'Load another resume' : 'Load resume'}
                    </button>
                    {s.resumeProcessing !== null && (
                      <span role="status" className="inline-status">
                        <HourglassIcon />
                        Uploading {s.resumeProcessing}. You can keep going; the waiting room finishes it.
                      </span>
                    )}
                    {s.resumeProcessing === null && resumeName && s.loadedResumeId !== null && s.loadedResumeId === s.resumeId && (
                      <span role="status" className="inline-status inline-ok">
                        <CheckIcon />
                        {resumeName} is loaded and selected.
                      </span>
                    )}
                  </div>
                </div>
                {s.resumeProcessing === null && s.resumeId === null && (
                  <p className="help">
                    A hot interview needs a resume. Pick or load one, or switch to a cold interview. If this form were ever submitted without one, the interview would fall back to a cold interview.
                  </p>
                )}
              </div>
            )}
          </section>

          {error && (
            <p role="alert" className="card card-error">
              {error}
            </p>
          )}

          <section aria-label="Role set up" className="card">
            <div className="row">
              <button type="button" className={disabled ? 'btn btn-big btn-disabled' : 'btn btn-big btn-primary'} aria-disabled={disabled} aria-describedby="role-note" onClick={() => !disabled && onRoleSetup()}>
                Role set up
                <ArrowIcon />
              </button>
              <p id="role-note" className="muted grow">
                Next you choose the role and its questions. A resume that is still uploading does not stop you. The waiting room finishes it.
              </p>
            </div>
            {disabled && (
              <div role="status" className="note-box" data-testid="blockers">
                <span className="eyebrow">Before you can continue</span>
                <ul>
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </main>

        <aside aria-label="Your choices" className="layout-side">
          <section className="card">
            <h2>Your setup so far</h2>
            <dl className="summary">
              <div>
                <dt>Interview type</dt>
                <dd>{hot ? 'Hot interview' : 'Cold interview'}</dd>
              </div>
              <div>
                <dt>Resume</dt>
                <dd>{!hot ? 'Not used' : s.resumeProcessing !== null ? 'Uploading…' : (resumeName ?? 'Not chosen yet')}</dd>
              </div>
              <div>
                <dt>AI models</dt>
                <dd>{changedSlots(s.ai) === 0 ? 'All defaults' : `${changedSlots(s.ai)} changed`}</dd>
              </div>
            </dl>
          </section>
          {showMockServer && <Harness config={config} onConfig={onConfig} />}
        </aside>

        <ModalDialog open={advanced} onClose={() => setAdvanced(false)} title="Advanced settings">
          <p>Custom (local) models and cloud access keys are set up here. [NOT BUILT YET: the custom-local and cloud shapes are not defined in the contract.]</p>
          <button type="button" className="btn" onClick={() => setAdvanced(false)}>
            Close
          </button>
        </ModalDialog>
      </div>
    </>
  )
}

/** Not in the mockup. Sets what the scripted host does, so every page state can be reached. */
function Harness({ config, onConfig }: { config: MockHostConfig; onConfig: (config: MockHostConfig) => void }) {
  const pick = <K extends keyof MockHostConfig>(key: K, label: string, options: ReadonlyArray<MockHostConfig[K]>) => (
    <div className="field">
      <label htmlFor={`h-${key}`} className="muted">
        {label}
      </label>
      <select id={`h-${key}`} value={config[key]} onChange={(e) => onConfig({ ...config, [key]: e.target.value as MockHostConfig[K] })}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  )
  return (
    <section className="card" aria-labelledby="harness-title">
      <h3 id="harness-title">Prototype harness: mock server</h3>
      {pick('saved', 'Saved resumes and roles', ['some', 'none'])}
      {pick('load', 'Loading this page', ['works', 'fails'])}
      {pick('preparation', 'Preparing the interview', ['succeeds', 'retries-then-succeeds', 'fails'])}
      {pick('upload', 'Processing a loaded resume', ['succeeds', 'fails'])}
      {pick('transcription', 'Transcribing the interview', ['works', 'unavailable'])}
    </section>
  )
}
