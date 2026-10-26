// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
import { useState } from 'react'
import { CheatSheet } from './CheatSheet.tsx'
import { CaptionCheck, ScramblePassage, ScreenReaderCheck, VisionSamples } from './checks.tsx'
import { captionServices, profiles, screenReaders, type Profile, type ProfileId, type ScreenReaderId } from './profiles.ts'
import { blackoutCss, colorMatrices, feMatrixValues, type VisionFilter } from './simulations.ts'
import { TestStage } from './TestStage.tsx'

const colorFilters: { value: VisionFilter; label: string; note: string }[] = [
  { value: 'none', label: 'No filter', note: 'Typical color vision' },
  { value: 'protanopia', label: 'Protanopia', note: 'No red cones; reds look dark' },
  { value: 'deuteranopia', label: 'Deuteranopia', note: 'No green cones; the most common kind' },
  { value: 'tritanopia', label: 'Tritanopia', note: 'No blue cones; rare' },
  { value: 'achromatopsia', label: 'Achromatopsia', note: 'No color at all' },
]

const lowVisionFilters: { value: VisionFilter; label: string; note: string }[] = [
  { value: 'none', label: 'No filter', note: 'Typical sight' },
  { value: 'blur-mild', label: 'Mild blur', note: '1.5 px blur (proposal)' },
  { value: 'blur-strong', label: 'Strong blur', note: '4 px blur (proposal)' },
  { value: 'low-contrast', label: 'Low contrast', note: 'Contrast cut to 45% (proposal)' },
]

/**
 * The QA accommodation canvas: one page per profile, each with setup steps, a check that the
 * accommodation works, and the interviewer prototype under the simulation. `?profile=` picks one.
 */
export function QaCanvas({ profileId }: { profileId: ProfileId | null }) {
  const profile = profiles.find((p) => p.id === profileId) ?? null
  const [filter, setFilter] = useState<VisionFilter>('none')
  const [blackout, setBlackout] = useState(false)
  const [textSpacing, setTextSpacing] = useState(false)
  const [scramble, setScramble] = useState(false)
  const [cheatOpen, setCheatOpen] = useState(false)
  const [readerId, setReaderId] = useState<ScreenReaderId>('nvda')
  const [captionId, setCaptionId] = useState(captionServices[0].id)
  const [result, setResult] = useState('')
  const reader = screenReaders.find((r) => r.id === readerId)!

  const filters = profile?.id === 'color' ? colorFilters : lowVisionFilters

  return (
    <>
      <svg className="qa-defs" aria-hidden="true" focusable="false">
        {(Object.keys(colorMatrices) as (keyof typeof colorMatrices)[]).map((k) => (
          <filter key={k} id={`qa-${k}`}>
            <feColorMatrix type="matrix" values={feMatrixValues(colorMatrices[k])} />
          </filter>
        ))}
      </svg>
      {blackout && <style>{blackoutCss('.qa-blackout')}</style>}

      <header className="qa-head">
        <div className="page-head">
          <div>
            <p className="eyebrow">AI Interviewer · QA</p>
            <h1>Accommodation profiles for testers</h1>
            <p className="muted">Become a candidate who needs an accommodation, prove the accommodation works, then run the interviewer as them.</p>
          </div>
          <span className="pill pill-warn">Prototype: simulations are approximations</span>
        </div>
        <nav aria-label="Profiles">
          <ul className="qa-nav">
            {profiles.map((p) => (
              <li key={p.id}>
                <a href={`?profile=${p.id}`} aria-current={p.id === profile?.id ? 'page' : undefined}>
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {profile && (
        <div className="qa-controls" role="region" aria-label="Simulation controls">
          {profile.id === 'blind' && (
            <>
              <label className="field qa-inline">
                <span>Screen reader</span>
                <select value={readerId} onChange={(e) => setReaderId(e.target.value as ScreenReaderId)}>
                  <optgroup label="Most used (WebAIM survey, 2024)">
                    {screenReaders.filter((r) => r.top3).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Built into other systems">
                    {screenReaders.filter((r) => !r.top3).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.platform})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <button type="button" className="btn" aria-pressed={blackout} onClick={() => { setBlackout((b) => !b); setResult('') }}>
                Black out the page
              </button>
              <button type="button" className="btn" aria-expanded={cheatOpen} aria-controls="qa-cheat-sheet" onClick={() => setCheatOpen((o) => !o)}>
                {cheatOpen ? 'Hide key cheat sheet' : 'Show key cheat sheet'}
              </button>
              <p role="status" className="qa-result">
                {result}
              </p>
            </>
          )}
          {(profile.id === 'color' || profile.id === 'low-vision') && (
            <fieldset className="qa-filters">
              <legend>Filter on the test stage</legend>
              {filters.map((f) => (
                <label key={f.value} className="check">
                  <input type="radio" name="qa-filter" value={f.value} checked={filter === f.value} onChange={() => setFilter(f.value)} />
                  <span>
                    {f.label} <span className="note">{f.note}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {profile.id === 'dyslexia' && (
            <>
              <label className="check">
                <input type="checkbox" checked={textSpacing} onChange={(e) => setTextSpacing(e.target.checked)} />
                Text spacing (WCAG 1.4.12)
              </label>
              <label className="check">
                <input type="checkbox" checked={scramble} onChange={(e) => setScramble(e.target.checked)} />
                Scramble words (approximation)
              </label>
            </>
          )}
          {profile.id === 'deaf' && <p className="note">No visual simulation. Turn your speakers down or wear earplugs so you rely on the captions.</p>}
        </div>
      )}

      <div className={`qa-body${cheatOpen && profile?.id === 'blind' ? ' qa-body-cheat' : ''}`}>
        <main className={`page qa-main${blackout && profile?.id === 'blind' ? ' qa-blackout' : ''}`}>
          {profile ? (
            <ProfileView
              profile={profile}
              readerId={readerId}
              captionId={captionId}
              onCaptionId={setCaptionId}
              sims={{ filter: profile.id === 'color' || profile.id === 'low-vision' ? filter : 'none', blackout: blackout && profile.id === 'blind', textSpacing: textSpacing && profile.id === 'dyslexia' }}
              scramble={scramble}
              onResult={setResult}
            />
          ) : (
            <Chooser />
          )}
        </main>
        {profile?.id === 'blind' && <CheatSheet open={cheatOpen} reader={reader} />}
      </div>
    </>
  )
}

function Chooser() {
  return (
    <>
      <h2>Choose a profile</h2>
      <ul className="grid-auto qa-plain">
        {profiles.map((p) => (
          <li key={p.id} className="card">
            <h3>
              <a href={`?profile=${p.id}`}>{p.name}</a>
            </h3>
            <p className="muted">{p.summary}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function ProfileView({
  profile,
  readerId,
  captionId,
  onCaptionId,
  sims,
  scramble,
  onResult,
}: {
  profile: Profile
  readerId: ScreenReaderId
  captionId: string
  onCaptionId: (id: string) => void
  sims: Parameters<typeof TestStage>[0]['sims']
  scramble: boolean
  onResult: (r: string) => void
}) {
  const reader = screenReaders.find((r) => r.id === readerId)!
  const service = captionServices.find((s) => s.id === captionId)!
  return (
    <>
      <div className="stack">
        <h2>{profile.name}</h2>
        <p className="muted">{profile.summary}</p>
      </div>

      <section className="card" aria-labelledby="qa-setup-title">
        <h2 id="qa-setup-title">1. Set up</h2>
        {profile.id === 'blind' && (
          <>
            <p>
              {reader.name}, {reader.platform}. Use {reader.browser}. Pick another screen reader in the simulation controls.
            </p>
            <ol className="qa-steps">
              {reader.setup.map((s) => (
                <li key={s}>{s}</li>
              ))}
              <li>Headphones are recommended, so the screen reader is not picked up by the microphone.</li>
            </ol>
          </>
        )}
        {profile.id === 'deaf' && (
          <>
            <label className="field qa-inline">
              <span>Speech to text service</span>
              <select value={captionId} onChange={(e) => onCaptionId(e.target.value)}>
                {captionServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <ol className="qa-steps">
              {service.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
              <li>Leave the interviewer&apos;s own captions off at first. They are one press away on the interview screen if the candidate prefers them.</li>
            </ol>
            <p className="note">Menu paths are proposals; operating systems move them. Whether OS captions keep working with the volume muted is not checked.</p>
          </>
        )}
        {profile.id === 'color' && (
          <ol className="qa-steps">
            <li>Pick a filter in the simulation controls. It applies to the test stage only, so these instructions stay readable.</li>
            <li>For each filter, check the four states, the meters and every error or warning still read without color.</li>
            <li>Filters use the Machado (2009) matrices for full loss of one cone type. Milder, more common forms are not simulated.</li>
            <li>For a second opinion, Chrome DevTools has its own: Rendering &gt; Emulate vision deficiencies.</li>
          </ol>
        )}
        {profile.id === 'low-vision' && (
          <ol className="qa-steps">
            <li>Zoom the browser to 200% and then 400% (Ctrl or Command with +). At 400% nothing should need scrolling sideways.</li>
            <li>Try the system magnifier: Windows Magnifier (Windows+Plus), or macOS Zoom (System Settings &gt; Accessibility &gt; Zoom).</li>
            <li>Try a high contrast theme: Windows Contrast themes (Left Alt+Left Shift+Print Screen), or macOS Increase contrast.</li>
            <li>Pick a blur or low contrast filter in the simulation controls. It applies to the test stage only.</li>
          </ol>
        )}
        {profile.id === 'dyslexia' && (
          <>
            <ol className="qa-steps">
              <li>Turn on Text spacing. It applies the WCAG 1.4.12 values to the stage and the interviewer. Check that no text is cut off or overlaps.</li>
              <li>Try a reading tool the candidate might use: Immersive Reader in Edge, or the browser&apos;s reader view.</li>
              <li>Optional: turn on Scramble words to feel how slow a jumbled question is to read. It only changes the sample question.</li>
            </ol>
            <div className="note-box note-warn stack">
              <h3>About the scramble</h3>
              <p>
                It is easy to build, but it is not what dyslexia is. Dyslexia is mainly a difficulty with linking sounds to letters, not letters moving on the page, and the International Dyslexia Association calls the popular scramble demo &ldquo;compelling, powerful, and wrong&rdquo;. Use it for empathy only, never as a pass or fail check. Text spacing is the real test.{' '}
                <a href="https://dyslexiaida.org/online-dyslexia-simulation-is-compelling-powerful-and-wrong/" target="_blank" rel="noreferrer">
                  Read the IDA article (opens in a new tab)
                </a>
              </p>
            </div>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="qa-check-title">
        <h2 id="qa-check-title">2. Check it works</h2>
        {profile.id === 'blind' && (
          <ol className="qa-steps">
            <li>Press Black out the page. The page goes black; only the controls and the cheat sheet stay visible.</li>
            <li>With the screen reader, find the heading &ldquo;Passphrase&rdquo; in the test stage and listen to it.</li>
            <li>Find the field &ldquo;Type the passphrase&rdquo;, type it, and press Check passphrase. The result shows in the controls bar.</li>
            <li>Then load the interviewer and complete setup by ear alone.</li>
          </ol>
        )}
        {profile.id === 'deaf' && <p>Use the caption check in the test stage, then load the interviewer and follow it by captions alone.</p>}
        {(profile.id === 'color' || profile.id === 'low-vision' || profile.id === 'dyslexia') && <p>Use the samples in the test stage, then load the interviewer and complete setup under each setting.</p>}
      </section>

      <TestStage sims={sims}>
        {profile.id === 'blind' && <ScreenReaderCheck key={String(sims.blackout)} blackout={sims.blackout} onResult={onResult} />}
        {profile.id === 'deaf' && <CaptionCheck />}
        {(profile.id === 'color' || profile.id === 'low-vision') && <VisionSamples />}
        {profile.id === 'dyslexia' && <ScramblePassage key={String(scramble)} scramble={scramble} />}
      </TestStage>
    </>
  )
}
