// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
// The per-profile checks that sit at the top of the test stage.
import { useEffect, useId, useState } from 'react'
import { scrambleWords } from './simulations.ts'

const passphrases = ['harbor', 'maple', 'violet', 'canyon', 'ember', 'orbit', 'lantern', 'meadow', 'pebble', 'juniper']
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

/**
 * Proves the screen reader works: the passphrase is only on screen while the page is blacked out,
 * so the tester can only find it by listening. The result goes to `onResult` and is shown outside
 * the blacked-out area.
 */
export function ScreenReaderCheck({ blackout, onResult }: { blackout: boolean; onResult: (r: string) => void }) {
  // The parent remounts this on each blackout change, so every blackout gets a new passphrase.
  const [phrase] = useState(() => pick(passphrases))
  const [typed, setTyped] = useState('')
  const fieldId = useId()

  if (!blackout)
    return (
      <div className="stack">
        <h3>Screen reader check</h3>
        <p>Turn on <strong>Black out the page</strong> in the simulation controls to start. The passphrase only appears while the page is black.</p>
      </div>
    )
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        const ok = typed.trim().toLowerCase() === phrase
        onResult(ok ? 'Screen reader check passed: the passphrase matched.' : 'Not a match. Find the passphrase heading and try again.')
      }}
    >
      <h3>Screen reader check</h3>
      <h4>Passphrase</h4>
      <p>The passphrase is {phrase}.</p>
      <label className="field" htmlFor={fieldId}>
        Type the passphrase
      </label>
      <input id={fieldId} className="qa-input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <button type="submit" className="btn qa-fit">
        Check passphrase
      </button>
    </form>
  )
}

const testPhrases = [
  'Tell me about a project you are proud of.',
  'What did you do first when the deadline moved?',
  'Describe a time you changed your mind after feedback.',
  'Walk me through how you would test a login page.',
]

/** Speaks a phrase so the tester can see whether their captions pick it up, then reveal it to compare. */
export function CaptionCheck() {
  const [phrase, setPhrase] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  const play = () => {
    const next = pick(testPhrases)
    setPhrase(next)
    setShown(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(next))
  }

  return (
    <div className="stack">
      <h3>Caption check</h3>
      <p>Press Play. Read what your captions show, then reveal the phrase and compare.</p>
      {!canSpeak && <p className="note-box note-warn">This browser has no speech synthesis, so the test phrase cannot play. Use the interviewer below instead.</p>}
      <div className="row">
        <button type="button" className="btn" onClick={play} disabled={!canSpeak}>
          {phrase ? 'Play another phrase' : 'Play test phrase'}
        </button>
        <button type="button" className="btn" aria-expanded={shown} aria-controls="qa-phrase" disabled={!phrase} onClick={() => setShown((s) => !s)}>
          {shown ? 'Hide the phrase' : 'Show the phrase'}
        </button>
      </div>
      <p id="qa-phrase" hidden={!shown}>
        It said: {phrase}
      </p>
    </div>
  )
}

/** Samples of what the interviewer uses color for, so the tester can judge them under a filter. */
export function VisionSamples() {
  return (
    <div className="stack">
      <h3>Samples</h3>
      <p>The interviewer&apos;s four states carry an icon and a word as well as a color. Check you can still tell them apart.</p>
      <ul className="row qa-plain">
        <li className="chip qa-sample qa-listening">Listening</li>
        <li className="chip qa-sample qa-thinking">Thinking</li>
        <li className="chip qa-sample qa-talking">Talking</li>
        <li className="chip qa-sample qa-idle">Idle</li>
      </ul>
      <p className="note">Small text sample: Your turn. Take your time.</p>
      <p className="qa-large">Large text sample: Tell me about a recent project.</p>
    </div>
  )
}

const passage =
  'Tell me about a time a project changed direction halfway through. What did you notice first, who did you talk to, and what would you do differently next time?'

/**
 * The word-scramble approximation. The scrambled text is shown to sighted testers only; screen
 * readers get the real passage, so the canvas stays usable with one.
 */
export function ScramblePassage({ scramble }: { scramble: boolean }) {
  // The parent remounts this when `scramble` changes, so the first scramble happens here.
  const [text, setText] = useState(() => (scramble ? scrambleWords(passage) : passage))
  useEffect(() => {
    if (!scramble) return
    // Under reduced motion the words are scrambled once and then hold still.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setText(scrambleWords(passage)), 1200)
    return () => window.clearInterval(timer)
  }, [scramble])

  return (
    <div className="stack">
      <h3>Sample question</h3>
      <p className="qa-passage">
        {scramble ? (
          <>
            <span aria-hidden="true">{text}</span>
            <span className="sr-only">{passage}</span>
          </>
        ) : (
          passage
        )}
      </p>
    </div>
  )
}
