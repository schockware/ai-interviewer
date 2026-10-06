import type { CuePayload } from '../core/cues/index.ts'
import { SoundIcon, StateIcon } from './icons.tsx'
import { viewFor } from './stateView.ts'

/**
 * The status card: icon, words, one line of help and the sound line. Renders the cue payload as
 * received. It decides nothing: which state to show, when, and what to announce were all settled
 * before it got here (CUE-STA-001, CUE-ANN-001).
 */
export function CuePanel({ payload }: { payload: CuePayload }) {
  const view = viewFor(payload.state)
  return (
    <section aria-label="Interviewer status" className="card status" data-state={payload.state} data-tone={view.tone}>
      {/* The icon is decoration. The words beside it carry the meaning (CUE-RED-002). */}
      <div className="status-icon cue-icon" aria-hidden="true">
        <StateIcon icon={payload.icon} />
      </div>
      <div className="status-text">
        <span className="eyebrow">Status</span>
        <h2 className="status-label" data-testid="cue-label">
          {payload.label}
        </h2>
        <p className="status-sub">{view.sub}</p>
        <p className="status-sound">
          <SoundIcon />
          Sound: {view.sound}
        </p>
        {/* Announced once per displayed change. Empty until the first change, so nothing is read on load. */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcement">
          {payload.announcementId === 0 ? '' : payload.announcement}
        </div>
      </div>
      {payload.lanes && (
        <table className="lanes" data-testid="lanes">
          <caption>Debug: both timelines</caption>
          <tbody>
            <tr>
              <th scope="row">True state</th>
              <td>{payload.lanes.trueState}</td>
            </tr>
            <tr>
              <th scope="row">Perceived state</th>
              <td>{payload.lanes.perceivedState}</td>
            </tr>
            <tr>
              <th scope="row">Offset of latest transition</th>
              <td>{payload.lanes.offsetMs === null ? 'none yet' : `${payload.lanes.offsetMs} ms`}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  )
}
