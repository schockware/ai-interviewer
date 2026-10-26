// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { Tone } from '../core/setup/hardware.ts'
import { PREFLIGHT_TONE, type PreflightItem, type PreflightOutcome } from '../core/setup/preflight.ts'
import { ModalDialog } from './ModalDialog.tsx'

const MARK: Record<Tone, string> = { ok: '✓', warn: '!', bad: '✕', neutral: '–' }

/**
 * The interstitial behind Start interview, not in the mockups: every requirement, live. It
 * waits on its own while something is still in flight, and the page starts the interview the
 * moment everything is ok. A block, or a refusal from the server, stays until closed.
 */
export function PreflightDialog({
  open,
  items,
  outcome,
  starting,
  error,
  onClose,
}: {
  open: boolean
  items: PreflightItem[]
  outcome: PreflightOutcome
  starting: boolean
  error: string | null
  onClose: () => void
}) {
  const stuck = outcome === 'blocked' || error !== null
  const status = error
    ? 'The interview did not start.'
    : outcome === 'blocked'
      ? 'Something still needs attention before the interview can start.'
      : outcome === 'waiting'
        ? 'Waiting for the last pieces. This finishes on its own.'
        : starting
          ? 'Starting your interview…'
          : 'All set. Starting…'
  return (
    <ModalDialog open={open} onClose={onClose} title="Checking everything is ready">
      <ul className="checklist" aria-label="Pre-flight checks" data-testid="preflight">
        {items.map((item) => {
          const tone = PREFLIGHT_TONE[item.state.type]
          return (
            <li key={item.name}>
              <span aria-hidden="true" className={`mark mark-${tone}`}>
                {MARK[tone]}
              </span>
              <span>
                <b>{item.name}</b> · {item.state.detail}
              </span>
            </li>
          )
        })}
      </ul>
      <p role="status">{status}</p>
      {error && (
        <p role="alert" className="note-box note-bad">
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="btn" onClick={onClose}>
          {stuck ? 'Close' : 'Cancel'}
        </button>
      </div>
    </ModalDialog>
  )
}
