import type { CueIcon, CuePayload } from '../core/cues/index.ts'

const glyph: Record<CueIcon, string> = {
  neutral: '○',
  ear: '👂',
  thought: '💭',
  ellipsis: '…',
  pause: '⏸',
}

/**
 * Renders the cue payload as received. It decides nothing: which state to show, when, and
 * what to announce were all settled before it got here (CUE-STA-001, CUE-ANN-001).
 */
export function CuePanel({ payload }: { payload: CuePayload }) {
  return (
    <section aria-labelledby="cue-heading" className="cue" data-state={payload.state}>
      <h2 id="cue-heading">Interviewer status</h2>
      {/* The icon is decoration. The words beside it carry the meaning (CUE-RED-002). */}
      <p className="cue-line">
        <span className="cue-icon" aria-hidden="true">
          {glyph[payload.icon]}
        </span>
        <span className="cue-label" data-testid="cue-label">
          {payload.label}
        </span>
      </p>
      {/* Announced once per displayed change. Empty until the first change, so nothing is read on load. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcement">
        {payload.announcementId === 0 ? '' : payload.announcement}
      </div>
      {payload.simulation.active && (
        <p className="badge" data-testid="simulation-badge">
          Simulated: {payload.simulation.preset}
        </p>
      )}
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
