// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useEffect, useRef, useState } from 'react'
import { AccessibilityIcon } from './icons.tsx'

type Announcements = 'quiet' | 'always' | 'off'

const PROFILES = [
  'Generic (works with any screen reader)',
  'NVDA (experimental)',
  'JAWS (experimental)',
  'Narrator (experimental)',
  'VoiceOver, macOS (experimental)',
  'VoiceOver, iOS and iPadOS (experimental)',
  'TalkBack (experimental)',
  'Orca (experimental)',
]

/** Timing values from the Accessibility board. Every one is a proposal (design/mockups/ui/README.MD). */
const TIMINGS: ReadonlyArray<[string, string]> = [
  ['Guard after the voice ends', '250 ms'],
  ['Announcement debounce', '250–500 ms'],
  ['“Thinking” threshold', '500 ms'],
  ['Clear-then-set delay', '100 ms'],
  ['Lead-in tone and gap', '150 + 300 ms'],
]

/**
 * The Accessibility panel (SPEC.md §4.2-4.6), a modal dialog. Prototype: only "Show captions and
 * transcript" does anything. Every other setting holds local state and changes nothing else.
 */
export function AccessibilityDialog({
  open,
  onClose,
  captions,
  onCaptions,
}: {
  open: boolean
  onClose: () => void
  captions: boolean
  onCaptions: (enabled: boolean) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [voiceOn, setVoiceOn] = useState(true)
  const [srMode, setSrMode] = useState(false)
  const [announce, setAnnounce] = useState<Announcements>('quiet')
  const [readCaptions, setReadCaptions] = useState(false)
  const [voiceVolume, setVoiceVolume] = useState(80)
  const [roomVolume, setRoomVolume] = useState(30)
  const [rate, setRate] = useState(300)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const toggleSrMode = (on: boolean) => {
    setSrMode(on)
    if (on) onCaptions(true) // "Also turns on the transcript"
  }

  return (
    <dialog ref={ref} className="a11y" aria-labelledby="a11y-title" onClose={onClose}>
      <header className="a11y-head">
        <div className="row">
          <AccessibilityIcon />
          <h1 id="a11y-title">Accessibility</h1>
        </div>
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </header>

      <section aria-labelledby="basics-heading" className="a11y-section">
        <h2 id="basics-heading">Basics</h2>
        <p className="muted">The defaults match a real interview. Turn on whatever helps you, for access or for practice.</p>

        <Toggle id="showcap" label="Show captions and transcript" hint="Most online interviews do not have a captioning system. It is defaulted to be off." checked={captions} onChange={onCaptions} />
        <Toggle id="voiceon" label="Interviewer voice" hint="Turn off to read the interviewer instead of hearing them" checked={voiceOn} onChange={setVoiceOn} />
        <Toggle id="srmode" label="Screen reader mode" hint="Keeps announcements out of the interviewer’s way. Also turns on the transcript" checked={srMode} onChange={toggleSrMode} />

        <fieldset>
          <legend>Announcements</legend>
          {(
            [
              ['quiet', 'Quiet while the interviewer speaks (default)'],
              ['always', 'Always announce (if you duck other audio)'],
              ['off', 'Off: chime and transcript only'],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="check">
              <input type="radio" name="ann" checked={announce === value} onChange={() => setAnnounce(value)} />
              {text}
            </label>
          ))}
        </fieldset>

        <Toggle id="livecap" label="Read captions aloud" hint="One finished sentence at a time. For braille or if you can’t hear the voice" checked={readCaptions} onChange={setReadCaptions} />

        <div className="field">
          <label htmlFor="voicevol">Interviewer voice volume</label>
          <input id="voicevol" type="range" min={0} max={100} value={voiceVolume} onChange={(e) => setVoiceVolume(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="roomvol">
            Room sound volume <span className="muted">· off in screen reader mode</span>
          </label>
          <input id="roomvol" type="range" min={0} max={100} value={srMode ? 0 : roomVolume} disabled={srMode} onChange={(e) => setRoomVolume(Number(e.target.value))} />
        </div>
        <p className="note">
          Headphones are recommended. On speakers, your screen reader can reach the microphone and sound like you are answering.
        </p>
      </section>

      <section aria-labelledby="advanced-heading" className="a11y-section">
        <h2 id="advanced-heading">Advanced Accessibility</h2>
        <p className="muted">Values pending manual passes</p>

        <div className="field">
          <label htmlFor="srprofile">Screen reader profile</label>
          <select id="srprofile" defaultValue={PROFILES[0]}>
            {PROFILES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <span className="muted">A profile changes timing only, never what is announced. Untested profiles behave like Generic.</span>
        </div>

        <div className="field">
          <label htmlFor="rate">Your reading rate</label>
          <div className="row">
            <input id="rate" type="number" min={100} max={900} step={10} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            <span className="muted">words per minute · how long the voice waits after an announcement</span>
          </div>
        </div>

        <table className="timings">
          <caption>Timing (Generic, accessible profile). Proposals, not tuned.</caption>
          <tbody>
            {TIMINGS.map(([name, value]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="field">
          <span>Pause the interviewer</span>
          <div className="row">
            <span className="pill">[SHORTCUT]</span>
            <button type="button" className="btn">
              Change shortcut
            </button>
          </div>
          <span className="muted">Chosen not to clash with screen reader keys</span>
        </div>
      </section>
    </dialog>
  )
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="toggle">
      <label htmlFor={id}>
        <span className="toggle-label">{label}</span>
        <span className="muted">{hint}</span>
      </label>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}
