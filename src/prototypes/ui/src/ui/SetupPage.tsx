// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useEffect, useReducer, useRef, useState } from 'react'
import type { MockHostConfig } from '../adapters/mock/index.ts'
import type { ApplicationSetupPage, PrepareInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import {
  blockers,
  displayNameOf,
  initialSetup,
  roleValidation,
  setupReducer,
  toForm,
  type SetupState,
} from '../core/setup/setupState.ts'
import { changedSlots, choiceFromKey, choiceKey, SLOT_VIEWS } from '../core/setup/slots.ts'
import { ArrowIcon, CheckIcon, ErrorIcon, HourglassIcon, PasteIcon, SettingsIcon, UploadIcon } from './icons.tsx'
import { ModalDialog } from './ModalDialog.tsx'
import { PageHeader } from './PageHeader.tsx'

const nameOf = (fileName: string): string => fileName.replace(/\.[^.]+$/, '')

/**
 * Application setup, built from design/mockups/ui/Setup.dc.html and SetupHot.dc.html. It holds
 * the page states (loading, error, ready) and talks to the host through the SetupHost port.
 */
export function SetupPage({
  host,
  config,
  onConfig,
  showMockServer,
  onPrepare,
  onOpenAccessibility,
}: {
  host: SetupHost
  config: MockHostConfig
  onConfig: (config: MockHostConfig) => void
  /** The harness card only means something while the host is the mock. */
  showMockServer: boolean
  onPrepare: (request: PrepareInterview) => void
  onOpenAccessibility: () => void
}) {
  const [page, setPage] = useState<ApplicationSetupPage>({ type: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Loads on mount and on "Try again". The harness changing what the server holds remounts the page (App sets a key).
  useEffect(() => {
    let live = true
    host
      .loadPage()
      .then((p) => live && setPage(p))
      .catch((e: unknown) => live && setPage({ type: 'error', message: e instanceof Error ? e.message : 'Unknown error' }))
    return () => {
      live = false
    }
  }, [host, attempt])

  return (
    <div className="page">
      <PageHeader title="Set up your interview" subtitle="Step 1 of 2 · Application setup" onOpenAccessibility={onOpenAccessibility}>
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
          <button type="button" className="btn" onClick={() => {
              setPage({ type: 'loading' })
              setAttempt(attempt + 1)
            }}>
            Try again
          </button>
        </section>
      )}

      {page.type === 'ready' && (
        <SetupForm key={attempt} page={page} host={host} settingsOpen={settingsOpen} config={config} onConfig={onConfig} showMockServer={showMockServer} onPrepare={onPrepare} />
      )}
    </div>
  )
}

function SetupForm({
  page,
  host,
  settingsOpen,
  config,
  onConfig,
  showMockServer,
  onPrepare,
}: {
  page: Extract<ApplicationSetupPage, { type: 'ready' }>
  host: SetupHost
  settingsOpen: boolean
  config: MockHostConfig
  onConfig: (config: MockHostConfig) => void
  showMockServer: boolean
  onPrepare: (request: PrepareInterview) => void
}) {
  const [s, dispatch] = useReducer(setupReducer, page, initialSetup)
  const [error, setError] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const resumeInput = useRef<HTMLInputElement>(null)
  const jdInput = useRef<HTMLInputElement>(null)

  const reasons = blockers(s)
  const disabled = reasons.length > 0
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'The upload failed.')

  const loadResume = async (file: File) => {
    setError(null)
    dispatch({ type: 'resumeProcessing', fileName: file.name })
    try {
      const processed = await host.uploadResume({ displayName: nameOf(file.name), fileName: file.name, payload: new Uint8Array(await file.arrayBuffer()) })
      dispatch({ type: 'resumeProcessed', processed })
    } catch (e) {
      dispatch({ type: 'resumeFailed' })
      fail(e)
    }
  }
  const loadJobDescription = async (send: () => ReturnType<SetupHost['uploadJobDescription']>) => {
    setError(null)
    dispatch({ type: 'jdProcessing' })
    try {
      dispatch({ type: 'jdProcessed', processed: await send() })
    } catch (e) {
      dispatch({ type: 'jdFailed' })
      fail(e)
    }
  }

  const prepare = () => {
    if (disabled) return
    onPrepare({ form: toForm(s), sessionId: crypto.randomUUID() })
  }

  const hot = s.wants === 'hot'
  const resumeName = displayNameOf(s.resumes, s.resumeId)
  const roleName = displayNameOf(s.roles, s.roleId)
  const role = roleValidation(s)

  return (
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
                      Processing {s.resumeProcessing}. This can take a moment.
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
              {(s.resumeProcessing !== null || s.resumeId === null) && (
                <p className="help">
                  A hot interview needs a resume. Pick or load one, or switch to a cold interview. If this form were ever submitted without one, the interview would fall back to a cold interview.
                </p>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="role-title" className="card">
          <h2 id="role-title">
            Role focus <span className="muted">(required)</span>
          </h2>
          {role.type === 'required' ? (
            <p className="help">No roles are saved yet. Add a job description below to continue.</p>
          ) : (
            <div className="field">
              <label htmlFor="role-pick">Role title</label>
              <select id="role-pick" value={s.roleId ?? ''} disabled={s.jdProcessing} onChange={(e) => dispatch({ type: 'pickRole', roleId: e.target.value })}>
                {s.roleId === null && <option value="">Choose a role…</option>}
                {s.roles.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="muted">Industry-standard titles.</span>
            </div>
          )}
          <div className="field">
            <span id="jd-label">
              Job description{' '}
              <span className="muted">{s.roles.length === 0 ? '(required, because no roles are saved yet)' : '(optional)'}</span>
            </span>
            <div className="row">
              <input
                ref={jdInput}
                type="file"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                data-testid="jd-file"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void loadJobDescription(async () => host.uploadJobDescription({ displayName: nameOf(file.name), fileName: file.name, payload: new Uint8Array(await file.arrayBuffer()) }))
                }}
              />
              <button type="button" className="btn" aria-describedby="jd-label" aria-disabled={s.jdProcessing} onClick={() => !s.jdProcessing && jdInput.current?.click()}>
                <UploadIcon />
                Upload file
              </button>
              <button type="button" className="btn" aria-describedby="jd-label" aria-haspopup="dialog" aria-disabled={s.jdProcessing} onClick={() => !s.jdProcessing && setPasting(true)}>
                <PasteIcon />
                Paste text
              </button>
              {s.jdProcessing && (
                <span role="status" className="inline-status">
                  <HourglassIcon />
                  Processing the job description. This can take a moment.
                </span>
              )}
              {!s.jdProcessing && roleName && s.addedRoleId !== null && s.addedRoleId === s.roleId && (
                <span role="status" className="inline-status inline-ok">
                  <CheckIcon />
                  {roleName} is added and selected.
                </span>
              )}
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="card card-error">
            {error}
          </p>
        )}

        <section aria-label="Prepare the interview" className="card">
          <div className="row">
            <button type="button" className={disabled ? 'btn btn-big btn-disabled' : 'btn btn-big btn-primary'} aria-disabled={disabled} aria-describedby="prep-note" onClick={prepare}>
              Prepare interview
              <ArrowIcon />
            </button>
            <p id="prep-note" className="muted grow">
              The interviewer takes a little while to build your interview from the role and resume. You go straight to hardware setup, and a progress bar shows how it is going.
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
        <Summary s={s} resumeName={resumeName} roleName={roleName} />
        {showMockServer && <Harness config={config} onConfig={onConfig} />}
      </aside>

      <PasteDialog
        open={pasting}
        onClose={() => setPasting(false)}
        onAdd={(displayName, text) => {
          setPasting(false)
          void loadJobDescription(() => host.pasteJobDescription({ displayName, text }))
        }}
      />
      <ModalDialog open={advanced} onClose={() => setAdvanced(false)} title="Advanced settings">
        <p>Custom (local) models and cloud access keys are set up here. [NOT BUILT YET: the custom-local and cloud shapes are not defined in the contract.]</p>
        <button type="button" className="btn" onClick={() => setAdvanced(false)}>
          Close
        </button>
      </ModalDialog>
    </div>
  )
}

function Summary({ s, resumeName, roleName }: { s: SetupState; resumeName: string | null; roleName: string | null }) {
  const hot = s.wants === 'hot'
  const changed = changedSlots(s.ai)
  return (
    <section className="card">
      <h2>Your setup so far</h2>
      <dl className="summary">
        <div>
          <dt>Interview type</dt>
          <dd>{hot ? 'Hot interview' : 'Cold interview'}</dd>
        </div>
        <div>
          <dt>Resume</dt>
          <dd>{!hot ? 'Not used' : s.resumeProcessing !== null ? 'Processing…' : (resumeName ?? 'Not chosen yet')}</dd>
        </div>
        <div>
          <dt>Role focus</dt>
          <dd>{roleName ?? 'Not chosen yet'}</dd>
        </div>
        <div>
          <dt>AI models</dt>
          <dd>{changed === 0 ? 'All defaults' : `${changed} changed`}</dd>
        </div>
      </dl>
    </section>
  )
}

function PasteDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (displayName: string, text: string) => void }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const ready = name.trim() !== '' && text.trim() !== ''
  return (
    <ModalDialog open={open} onClose={onClose} title="Paste a job description">
      <div className="field">
        <label htmlFor="jd-name">Name for this role</label>
        <input id="jd-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="jd-text">Job description</label>
        <textarea id="jd-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row">
        <button
          type="button"
          className={ready ? 'btn btn-primary' : 'btn btn-disabled'}
          aria-disabled={!ready}
          onClick={() => {
            if (!ready) return
            onAdd(name.trim(), text)
            setName('')
            setText('')
          }}
        >
          Add job description
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </ModalDialog>
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
    </section>
  )
}
