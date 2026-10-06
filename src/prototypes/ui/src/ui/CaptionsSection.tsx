// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useState } from 'react'
import { CaptionsIcon, HelpIcon } from './icons.tsx'

/**
 * Captions are off by default, because most online interviews have none. When off, a button turns
 * them on and a help button says why.
 *
 * Prototype: the lines shown are the mockup's sample text. The event stream does not yet carry the
 * interviewer's words to the UI.
 */
export function CaptionsSection({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}) {
  const [helpOpen, setHelpOpen] = useState(true)
  const [size, setSize] = useState(20)
  const [contrast, setContrast] = useState(false)

  if (!enabled) {
    return (
      <section aria-label="Captions off" className="card card-dashed">
        <div className="row">
          <button type="button" className="btn" aria-pressed="false" onClick={() => onEnabledChange(true)}>
            <CaptionsIcon />
            Captions: off
          </button>
          <button
            type="button"
            className="btn btn-round"
            aria-label="Why are captions off?"
            aria-expanded={helpOpen}
            aria-controls="caption-help"
            onClick={() => setHelpOpen(!helpOpen)}
          >
            <HelpIcon />
          </button>
        </div>
        {helpOpen && (
          <p id="caption-help" className="help">
            Most online interviews do not have a captioning system. It is defaulted to be off.
          </p>
        )}
      </section>
    )
  }

  return (
    <section aria-label="Captions" className={contrast ? 'card captions captions-contrast' : 'card captions'}>
      <div className="row row-between">
        <h3>
          Captions <span className="muted">· sample text</span>
        </h3>
        <div className="row">
          <button type="button" className="btn btn-square" aria-label="Smaller captions" onClick={() => setSize(Math.max(14, size - 2))}>
            A−
          </button>
          <button type="button" className="btn btn-square" aria-label="Larger captions" onClick={() => setSize(Math.min(40, size + 2))}>
            A+
          </button>
          <button type="button" className="btn" aria-pressed={contrast} onClick={() => setContrast(!contrast)}>
            Contrast
          </button>
          <button type="button" className="btn" onClick={() => onEnabledChange(false)}>
            Turn off
          </button>
        </div>
      </div>
      <div className="caption-line">
        <span className="speaker speaker-interviewer">Interviewer</span>
        <p style={{ fontSize: size }}>
          Tell me about a time you had to change direction on a project late in the game. What did you do first?
        </p>
      </div>
      <div className="caption-line caption-you">
        <span className="speaker speaker-you">You</span>
        <p style={{ fontSize: size }}>So in my last role we were two weeks from launch when…</p>
      </div>
    </section>
  )
}
