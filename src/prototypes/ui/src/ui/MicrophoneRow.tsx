// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { MicrophoneIcon } from './icons.tsx'

/** Prototype: static. There is no microphone and no level meter yet. */
export function MicrophoneRow() {
  return (
    <section aria-label="Microphone" className="card mic">
      <MicrophoneIcon />
      <span className="mic-state">Microphone on</span>
      <div className="meter" aria-hidden="true">
        {[6, 12, 18, 10, 4, 4].map((h, i) => (
          <span key={i} className={i < 4 ? 'bar bar-on' : 'bar'} style={{ height: h }} />
        ))}
      </div>
      <span className="grow" />
      <span className="muted">Push to talk: off · Space to toggle</span>
    </section>
  )
}
