// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useRef, useState, type Dispatch } from 'react'
import type { PrepareInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import {
  displayNameOf,
  interviewTypeOf,
  materialsOf,
  panelOpen,
  purging,
  questionsChecking,
  questionsNote,
  questionsSummary,
  roleBlockers,
  roleCase,
  roleValidation,
  savedQuestionCount,
  showSetupButton,
  showSource,
  toForm,
  type SetupAction,
  type SetupState,
} from '../core/setup/setupState.ts'
import { changedSlots } from '../core/setup/slots.ts'
import { bannerKind, uploadingOf } from '../core/setup/status.ts'
import type { Materials } from '../core/setup/waitingRoom.ts'
import { ArrowIcon, CheckIcon, HelpIcon, HourglassIcon, PasteIcon, UploadIcon } from './icons.tsx'
import { PageHeader } from './PageHeader.tsx'
import { PasteDialog } from './PasteDialog.tsx'
import { PrepProgressBar } from './PrepProgressBar.tsx'
import { StatusBanner } from './StatusBanner.tsx'
import { usePreparationSteps } from './usePreparationSteps.ts'

const nameOf = (fileName: string): string => fileName.replace(/\.[^.]+$/, '')

type Pasting = 'jd' | 'questions' | null

/**
 * Role set up, step 2 of 4, built from design/mockups/ui/RoleSetup.dc.html and RoleQuestions.dc.html
 * (specs/page-flow.md, section 2). The role starts unanswered. Once one is chosen its description
 * shows under the title, and Upload file, Paste text and Setup questions sit in one row. The
 * questions default to the AI writing them; a role that already has questions keeps them unless the
 * user purges them. Uploads never stop the user: only an unanswered role, the questions check, or an
 * upload chosen with no file holds Prepare interview.
 */
export function RoleSetupPage({
  host,
  s,
  dispatch,
  onBack,
  onPrepare,
  onOpenAccessibility,
}: {
  host: SetupHost
  s: SetupState
  dispatch: Dispatch<SetupAction>
  onBack: () => void
  onPrepare: (request: PrepareInterview, materials: Materials) => void
  onOpenAccessibility: () => void
}) {
  const steps = usePreparationSteps()
  const [error, setError] = useState<string | null>(null)
  const [pasting, setPasting] = useState<Pasting>(null)
  const jdInput = useRef<HTMLInputElement>(null)
  const questionsInput = useRef<HTMLInputElement>(null)

  const reasons = roleBlockers(s)
  const disabled = reasons.length > 0
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'The upload failed.')

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
  const loadQuestions = async (fileName: string, send: () => ReturnType<SetupHost['uploadQuestions']>) => {
    setError(null)
    dispatch({ type: 'questionsProcessing', fileName })
    try {
      dispatch({ type: 'questionsProcessed', processed: await send() })
    } catch (e) {
      dispatch({ type: 'questionsFailed' })
      fail(e)
    }
  }

  const prepare = () => {
    if (disabled) return
    onPrepare({ form: toForm(s), sessionId: crypto.randomUUID() }, materialsOf(s))
  }

  const role = roleValidation(s)
  const roleName = displayNameOf(s.roles, s.roleId)
  const isNew = s.roleId !== null && s.addedRoleId === s.roleId
  const kase = roleCase(s)
  const open = panelOpen(s)
  const checking = questionsChecking(s)
  const note = questionsNote(s)
  const hot = s.wants === 'hot'
  const uploading = uploadingOf(steps.uploading !== 'none', s.jdProcessing || s.questionUpload.type === 'processing')

  return (
    <div className={steps.prep ? 'page page-with-dock' : 'page'}>
      <PageHeader title="Set up the role" subtitle="Step 2 of 4 · Role set up" onOpenAccessibility={onOpenAccessibility}>
        <button type="button" className="link-btn" onClick={onBack}>
          Back to application setup
        </button>
      </PageHeader>

      <StatusBanner kind={bannerKind(uploading, steps.prep)} what={uploading} />

      <div className="layout">
        <main className="layout-main">
          <section aria-labelledby="role-title" className="card">
            <h2 id="role-title">
              Role focus <span className="required">(required)</span>
            </h2>
            {role.type === 'required' ? (
              <p className="note-box note-warn">No roles are saved yet. Add a job description below. The new role is selected for you.</p>
            ) : (
              <div className="field">
                <label htmlFor="role-pick">Role title</label>
                <select id="role-pick" value={s.roleId ?? ''} disabled={s.jdProcessing} onChange={(e) => e.target.value && dispatch({ type: 'pickRole', roleId: e.target.value })}>
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

            {s.roleId !== null && roleName && (
              <div className="about-role" data-testid="about-role">
                <span className="eyebrow">About this role</span>
                <h3>{roleName}</h3>
                {s.roleDetail.type === 'ready' && (
                  <div role="region" aria-label="Role description" tabIndex={0} className="role-description" data-testid="role-description">
                    {s.roleDetail.detail.description}
                  </div>
                )}
                {s.roleDetail.type === 'loading' && (
                  <p role="status" className="muted">
                    {isNew ? 'The description appears here when the upload finishes. You can keep going.' : 'Loading the description…'}
                  </p>
                )}
                {s.roleDetail.type === 'failed' && (
                  <div className="note-box note-bad">
                    <span>Could not load this role. {s.roleDetail.message}</span>
                    <div>
                      <button type="button" className="btn" onClick={() => dispatch({ type: 'roleRetry' })}>
                        Try again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="role-actions">
              <div role="group" aria-labelledby="jd-label" className="field">
                <span id="jd-label">
                  Job description <span className="muted">{s.roles.length === 0 ? '(required, because no roles are saved yet)' : '(optional)'}</span>
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
                  <button type="button" className="btn" aria-describedby="jd-label" aria-haspopup="dialog" aria-disabled={s.jdProcessing} onClick={() => !s.jdProcessing && setPasting('jd')}>
                    <PasteIcon />
                    Paste text
                  </button>
                </div>
              </div>

              {showSetupButton(s) && (
                <div role="group" aria-labelledby="q-label" className="field grow">
                  <span id="q-label">Interview questions</span>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-outline"
                      aria-disabled={checking}
                      aria-expanded={open}
                      aria-controls="questions-panel"
                      aria-describedby="qbtn-note"
                      onClick={() => !checking && dispatch({ type: 'toggleQuestions' })}
                    >
                      <HelpIcon />
                      Setup questions
                    </button>
                    <span id="qbtn-note" role="status" className="q-note" data-testid="questions-note">
                      <b>{note.lead}</b> {note.note}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {s.jdProcessing && (
              <span role="status" className="inline-status">
                <HourglassIcon />
                Uploading the job description. You can keep going; the waiting room finishes it.
              </span>
            )}
            {!s.jdProcessing && roleName && isNew && (
              <span role="status" className="inline-status inline-ok">
                <CheckIcon />
                {roleName} is added and selected.
              </span>
            )}

            {open && kase && (
              <div id="questions-panel" className="q-panel" data-testid="questions-panel">
                <h3>Interview questions</h3>
                <p>
                  {kase === 'existing-has'
                    ? `${roleName} already has ${savedQuestionCount(s)} saved questions. Do you want to purge them?`
                    : kase === 'new'
                      ? 'This is a new role, so it has no questions yet.'
                      : `${roleName} has no saved questions yet.`}
                </p>
                {kase === 'existing-has' && (
                  <>
                    <div role="radiogroup" aria-label="Existing questions" className="grid-2">
                      <label className={s.existing === 'keep' ? 'radio-card radio-card-on' : 'radio-card'}>
                        <span className="row">
                          <input type="radio" name="qexisting" value="keep" checked={s.existing === 'keep'} onChange={() => dispatch({ type: 'existing', existing: 'keep' })} />
                          Keep the existing questions
                        </span>
                        <span className="muted">
                          The interviewer uses the {savedQuestionCount(s)} questions already saved for {roleName}.
                        </span>
                      </label>
                      <label className={s.existing === 'purge' ? 'radio-card radio-card-on' : 'radio-card'}>
                        <span className="row">
                          <input type="radio" name="qexisting" value="purge" checked={s.existing === 'purge'} onChange={() => dispatch({ type: 'existing', existing: 'purge' })} />
                          Purge them and start over
                        </span>
                        <span className="muted">Delete the saved questions, then choose where the new ones come from.</span>
                      </label>
                    </div>
                    {purging(s) && (
                      <p role="status" className="note-box note-bad" data-testid="purge-warning">
                        Purging deletes the {savedQuestionCount(s)} saved questions for {roleName}. This cannot be undone. They are removed when you press Prepare interview.
                      </p>
                    )}
                  </>
                )}
                {showSource(s) && (
                  <>
                    <p id="q-source-label">{purging(s) ? 'Where should the new questions come from?' : 'Where should the questions come from?'}</p>
                    <div role="radiogroup" aria-labelledby="q-source-label" className="grid-2">
                      <label className={s.source === 'generate' ? 'radio-card radio-card-on' : 'radio-card'}>
                        <span className="row">
                          <input type="radio" name="qsrc" value="generate" checked={s.source === 'generate'} onChange={() => dispatch({ type: 'source', source: 'generate' })} />
                          Have the AI write them
                        </span>
                        <span className="muted">The AI writes questions for this role from its description while your interview is prepared.</span>
                      </label>
                      <label className={s.source === 'upload' ? 'radio-card radio-card-on' : 'radio-card'}>
                        <span className="row">
                          <input type="radio" name="qsrc" value="upload" checked={s.source === 'upload'} onChange={() => dispatch({ type: 'source', source: 'upload' })} />
                          Upload my own questions
                        </span>
                        <span className="muted">The interviewer uses the questions you load. One question per line, or JSON.</span>
                      </label>
                    </div>
                    {s.source === 'upload' && (
                      <div role="group" aria-label="Your questions" className="row">
                        <input
                          ref={questionsInput}
                          type="file"
                          hidden
                          aria-hidden="true"
                          tabIndex={-1}
                          data-testid="questions-file"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            const roleId = s.roleId
                            if (file && roleId !== null)
                              void loadQuestions(file.name, async () =>
                                host.uploadQuestions(roleId, { displayName: nameOf(file.name), fileName: file.name, payload: new Uint8Array(await file.arrayBuffer()) }),
                              )
                          }}
                        />
                        <button
                          type="button"
                          className="btn"
                          aria-disabled={s.questionUpload.type === 'processing'}
                          onClick={() => s.questionUpload.type !== 'processing' && questionsInput.current?.click()}
                        >
                          <UploadIcon />
                          Upload file
                        </button>
                        <button
                          type="button"
                          className="btn"
                          aria-haspopup="dialog"
                          aria-disabled={s.questionUpload.type === 'processing'}
                          onClick={() => s.questionUpload.type !== 'processing' && setPasting('questions')}
                        >
                          <PasteIcon />
                          Paste text
                        </button>
                        {s.questionUpload.type === 'processing' && (
                          <span role="status" className="inline-status">
                            <HourglassIcon />
                            Uploading {s.questionUpload.fileName}. You can keep going.
                          </span>
                        )}
                        {s.questionUpload.type === 'ready' && (
                          <span role="status" className="inline-status inline-ok">
                            <CheckIcon />
                            {s.questionUpload.processed.displayName} is loaded. {s.questionUpload.processed.count} questions found.
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
                The interviewer takes a little while to build your interview from the role and resume. You go straight to hardware setup, and a progress bar shows how it is going. Anything still
                uploading does not stop you. The waiting room finishes it.
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
                <dd>{!hot ? 'Not used' : interviewTypeOf(s).type === 'hot' ? (displayNameOf(s.resumes, s.resumeId) ?? 'Not chosen yet') : 'Uploading…'}</dd>
              </div>
              <div>
                <dt>Role focus</dt>
                <dd>{roleName ?? (role.type === 'required' ? 'Not added yet' : 'Not chosen yet')}</dd>
              </div>
              <div>
                <dt>Questions</dt>
                <dd data-testid="questions-summary">{questionsSummary(s)}</dd>
              </div>
              <div>
                <dt>AI models</dt>
                <dd>{changedSlots(s.ai) === 0 ? 'All defaults' : `${changedSlots(s.ai)} changed`}</dd>
              </div>
            </dl>
            <div>
              <button type="button" className="link-btn" onClick={onBack}>
                Change interview type or resume
              </button>
            </div>
          </section>
        </aside>
      </div>

      <PasteDialog
        open={pasting === 'jd'}
        onClose={() => setPasting(null)}
        title="Paste a job description"
        nameLabel="Name for this role"
        textLabel="Job description"
        addLabel="Add job description"
        idPrefix="jd"
        onAdd={(displayName, text) => {
          setPasting(null)
          void loadJobDescription(() => host.pasteJobDescription({ displayName, text }))
        }}
      />
      <PasteDialog
        open={pasting === 'questions'}
        onClose={() => setPasting(null)}
        title="Paste your questions"
        nameLabel="Name for these questions"
        textLabel="Questions, one per line"
        addLabel="Add questions"
        idPrefix="questions"
        onAdd={(displayName, text) => {
          setPasting(null)
          const roleId = s.roleId
          if (roleId !== null) void loadQuestions(displayName, () => host.pasteQuestions(roleId, { displayName, text }))
        }}
      />

      <PrepProgressBar prep={steps.prep} percent={steps.percent} />
    </div>
  )
}
