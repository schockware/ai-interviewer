// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { captureView, litBars } from '../core/media/capture.ts'
import { MicrophoneIcon } from './icons.tsx'
import type { Capture } from './useCapture.ts'

const BARS = [6, 12, 18, 10, 14, 8]

/** The microphone row: what is being recorded and sent, the live level, mute, and the camera preview when video is on. */
export function MicrophoneRow({ capture }: { capture: Capture }) {
  const view = captureView(capture.state, capture.uplinkError)
  const live = capture.state.type === 'live'
  const lit = live ? litBars(capture.level, BARS.length) : 0
  return (
    <section aria-label="Microphone" className="card mic" data-testid="microphone-row">
      <MicrophoneIcon />
      <span role="status" className={`mic-state tone-${view.tone}`} data-testid="mic-state">
        {view.label}
      </span>
      <div className="meter" aria-hidden="true">
        {BARS.map((h, i) => (
          <span key={i} className={i < lit ? 'bar bar-on' : 'bar'} style={{ height: h }} />
        ))}
      </div>
      <span className="muted" data-testid="mic-detail">
        {view.detail}
      </span>
      <span className="grow" />
      {live && (
        <button type="button" className="btn" aria-pressed={capture.state.type === 'live' && capture.state.muted} onClick={() => capture.setMuted(!(capture.state.type === 'live' && capture.state.muted))}>
          {capture.state.type === 'live' && capture.state.muted ? 'Unmute' : 'Mute'}
        </button>
      )}
      {live && capture.state.type === 'live' && capture.state.video && (
        <video ref={capture.attachPreview} className="preview" autoPlay playsInline muted aria-label="Your camera" data-testid="camera-preview" />
      )}
    </section>
  )
}
