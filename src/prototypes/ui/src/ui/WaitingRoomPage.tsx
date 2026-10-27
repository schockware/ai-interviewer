// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { StartInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import { bannerKind, type BannerKind } from '../core/setup/status.ts'
import { COUNTDOWN_SECONDS, doneCount, GROUPS, STEP_LOOK, type StepGroup, type StepView } from '../core/setup/waitingRoom.ts'
import { PageHeader } from './PageHeader.tsx'
import { PrepProgressBar } from './PrepProgressBar.tsx'
import { StatusBanner } from './StatusBanner.tsx'
import { usePreparation } from './preparation.ts'
import { usePreparationSteps } from './usePreparationSteps.ts'
import { PEZ, type PezKind } from './whileYouWait.ts'

const GROUP_ORDER: StepGroup[] = ['materials', 'scripts', 'connection']

/**
 * The Waiting room, built from design/mockups/ui/Waiting.dc.html (specs/page-flow.md, section 3):
 * the interstitial between Hardware setup and the interview. It shows every step of getting the
 * interview ready, waits by itself, and when everything is done a short countdown starts the
 * interview. Training options can pause the countdown. "While you wait" offers one piece at a
 * time. Nothing here interrupts the user.
 */
export function WaitingRoomPage({
  host,
  startRequest,
  onLeave,
  onChangeSetup,
  onJoin,
  onOpenAccessibility,
  countdownSeconds = COUNTDOWN_SECONDS,
}: {
  host: SetupHost
  /** The hardware form from the page before; the interview starts with it. */
  startRequest: StartInterview
  onLeave: () => void
  onChangeSetup: () => void
  onJoin: () => void
  onOpenAccessibility: () => void
  /** Tests pass 1. */
  countdownSeconds?: number
}) {
  const preparation = usePreparation()
  const steps = usePreparationSteps()
  const prep = steps.prep ?? 'preparing'
  const hot = preparation.materials?.hot ?? false
  const [paused, setPaused] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [pez, setPez] = useState<PezKind | null>(null)
  const [pezIndex, setPezIndex] = useState(0)

  const ready = steps.state === 'ready'
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const join = useCallback(() => {
    setJoining(true)
    host.startInterview(startRequest).then(
      () => alive.current && onJoin(),
      (e: unknown) => {
        if (!alive.current) return
        setJoinError(e instanceof Error ? e.message : 'The interview could not start.')
        setJoining(false)
      },
    )
  }, [host, startRequest, onJoin])

  // The countdown runs once everything is ready, unless Training options hold it. `left` stays
  // null until the first tick, so an early pause simply keeps the full count on the dial.
  const secondsLeft = left ?? countdownSeconds
  useEffect(() => {
    if (!ready || paused || joining || joinError !== null || secondsLeft <= 0) return
    const timer = setTimeout(() => {
      const next = secondsLeft - 1
      setLeft(next)
      if (next === 0) join()
    }, 1000)
    return () => clearTimeout(timer)
  }, [ready, paused, joining, joinError, secondsLeft, join])

  const togglePause = () => {
    const next = !paused
    setPaused(next)
    if (!next && ready && secondsLeft === 0 && !joining && joinError === null) join()
  }

  // The banner: the room's own second lines, and a problem of its own when a resume could not be read.
  const resumeBlocked = steps.state === 'blocked' && prep !== 'diagnosing'
  const kind: BannerKind = resumeBlocked ? 'problem' : bannerKind('none', prep)
  const body = resumeBlocked
    ? 'Your resume could not be processed. Change the application setup to load it again, or run a cold interview.'
    : {
        preparing: 'The interviewer is building your interview. You will join as soon as it is ready.',
        retrying: 'This is taking a little longer than usual. We are retrying quietly, and you do not need to do anything.',
        diagnosing: undefined,
        ready: paused ? 'Your interview is prepared. The countdown is paused, so it waits for you.' : 'Your interview is prepared. It starts after a short countdown.',
      }[prep]

  const barNote = ready ? (paused ? 'Countdown paused' : `Starting in ${secondsLeft} s`) : prep === 'preparing' ? `${steps.percent}% · ${steps.now}` : undefined
  const grouped = GROUP_ORDER.map((g) => ({ group: g, ...GROUPS[g], steps: steps.views.filter((v) => v.group === g) })).filter((g) => g.steps.length > 0)
  const set = pez ? PEZ[pez] : null
  const piece = set ? set.pieces[pezIndex % set.pieces.length] : null
  const pick = (next: PezKind) => {
    setPez(pez === next ? null : next)
    setPezIndex(0)
  }

  return (
    <div className="page page-with-dock">
      <PageHeader title="Waiting room" subtitle="Step 4 of 4 · Getting your interview ready" onOpenAccessibility={onOpenAccessibility}>
        <button type="button" className="link-btn" onClick={onLeave}>
          Leave the waiting room
        </button>
      </PageHeader>

      <StatusBanner kind={kind} body={body} />

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
          {!ready && (
            <>
              <section aria-label="Current step" className="card">
                <span className="eyebrow">Now</span>
                <p role="status" className="now" data-testid="now">
                  {steps.now}
                </p>
              </section>
              {grouped.map((g) => (
                <section key={g.group} aria-labelledby={`grp-${g.group}`} className="card">
                  <div>
                    <h2 id={`grp-${g.group}`}>{g.title}</h2>
                    <p className="muted">{g.note}</p>
                  </div>
                  <ol className="steps">
                    {g.steps.map((s) => (
                      <StepTile key={s.id} step={s} />
                    ))}
                  </ol>
                </section>
              ))}
            </>
          )}

          {ready && (
            <>
              <section aria-label="Countdown" className="card countdown" data-testid="countdown">
                <div aria-hidden="true" className={paused ? 'dial tone-neutral' : 'dial tone-ok'}>
                  <span className="dial-number">{secondsLeft}</span>
                  <span className="dial-unit">{paused ? 'paused' : 'seconds'}</span>
                </div>
                <div className="grow stack">
                  <h2 className={paused ? 'tone-neutral' : 'tone-ok'}>{paused ? 'Countdown paused' : `Your interview starts in ${secondsLeft} seconds`}</h2>
                  {/* Announced when it appears, and on a pause or a resume. The ticking number above is not. */}
                  <p role="status">
                    {joining
                      ? 'Joining your interview…'
                      : paused
                        ? 'Take your time. The interview starts when you turn the pause off in Training options.'
                        : 'Get comfortable. The interviewer opens the interview and is not listening while they do.'}
                  </p>
                  {joinError && (
                    <p role="alert" className="note-box note-bad">
                      {joinError}
                    </p>
                  )}
                  <p className="muted">
                    Need a moment? <a href="#training">Pause the countdown in Training options</a>.
                  </p>
                </div>
              </section>
              <details className="card">
                <summary>
                  Everything is ready · {doneCount(steps.views)} of {steps.views.length} steps done
                </summary>
                <div className="stack">
                  {grouped.map((g) => (
                    <div key={g.group} className="field">
                      <h3>{g.title}</h3>
                      <ol className="checklist">
                        {g.steps.map((s) => (
                          <li key={s.id}>
                            <span aria-hidden="true" className="mark mark-ok">
                              ✓
                            </span>
                            <span>
                              {s.label} <b className="tone-ok">· Done</b>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </main>

        <aside aria-label="About the waiting room" className="layout-side">
          <section className="card">
            <h2>What is happening</h2>
            <p>
              Your interview is built for you from the role{hot ? ' and your resume' : ''}. The AI writes the opening, the questions, the follow-ups, the scoring
              guide and the closing before you join. This usually takes [WAIT TIME].
            </p>
            <p>You do not need to do anything. Your hardware check is done.</p>
          </section>
          <section className="card card-purple">
            <h2>When you join</h2>
            <p>The interview starts with the interviewer’s opening. The interviewer is not listening during the opening, so wait for the “your turn” cue.</p>
          </section>
          <section aria-labelledby="pez-title" className="card">
            <div>
              <h2 id="pez-title">While you wait</h2>
              <p className="muted">Want something to read? Pick one. It is optional, and you get one piece at a time.</p>
            </div>
            <div className="stack">
              {(Object.keys(PEZ) as PezKind[]).map((k) => (
                <button key={k} type="button" aria-pressed={pez === k} className={pez === k ? 'tile tile-on' : 'tile'} onClick={() => pick(k)}>
                  {k === 'tips' ? 'Interview tips' : k === 'faq' ? 'Frequently asked questions' : 'Review your role'}
                </button>
              ))}
            </div>
            {set && piece && (
              <div aria-live="polite" className="note-box" data-testid="pez">
                <span className="eyebrow">
                  {set.heading} · {set.counter((pezIndex % set.pieces.length) + 1, set.pieces.length)}
                </span>
                <p>
                  <b>{piece.title}</b>
                </p>
                {piece.body && <p>{piece.body}</p>}
                <div className="row">
                  <button type="button" className="btn btn-primary" onClick={() => setPezIndex(pezIndex + 1)}>
                    {set.next}
                  </button>
                  <button type="button" className="btn" onClick={() => setPez(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </section>
          <section id="training" aria-labelledby="train-title" className="card">
            <h2 id="train-title">Training options</h2>
            <div className="row row-between">
              <span id="pause-label">Pause the countdown</span>
              <button type="button" role="switch" aria-checked={paused} aria-labelledby="pause-label" className={paused ? 'switch switch-on' : 'switch'} onClick={togglePause}>
                <span className="knob" aria-hidden="true" />
                <span>{paused ? 'On' : 'Off'}</span>
              </button>
            </div>
            <p className="note">For a test interview, or if you need a moment. When this is on, the interview waits for you. If it is on before your interview is ready, the countdown starts paused.</p>
          </section>
        </aside>
      </div>

      <PrepProgressBar prep={steps.prep} percent={steps.percent} note={barNote} />
    </div>
  )
}

function StepTile({ step }: { step: StepView }) {
  const look = STEP_LOOK[step.status]
  return (
    <li className={`step step-${look.tone}`}>
      <span aria-hidden="true" className={`step-mark tone-${look.tone}`}>
        {look.mark}
      </span>
      <span className="stack-tight">
        <span className="step-label">{step.label}</span>
        <span className="note">
          <b className={`tone-${look.tone}`}>{look.word}</b>
          {step.who && ` · ${step.who}`}
        </span>
      </span>
    </li>
  )
}
