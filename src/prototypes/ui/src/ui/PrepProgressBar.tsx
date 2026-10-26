// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { PrepProgress } from '../core/contract/pageFlow.ts'
import { progressView } from '../core/setup/status.ts'

/**
 * The shared "Preparing your interview" bar (design/mockups/ui/PrepProgress.dc.html), at the bottom
 * of every setup page once preparation has started. It has a name and a fixed text value, and its
 * movement is not announced. Renders nothing before preparation starts.
 */
export function PrepProgressBar({ prep, percent, note }: { prep: PrepProgress | null; percent: number; note?: string }) {
  if (prep === null) return null
  const bar = progressView(prep, percent, note)
  const labelId = 'prep-label'
  return (
    <section aria-label="Interview preparation progress" className="dock" data-testid="prep-progress">
      <div className="dock-inner">
        <div className="row row-between">
          <span id={labelId}>{bar.label}</span>
          <span className="muted">{bar.note}</span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={bar.now ?? undefined}
          aria-valuetext={bar.label}
          className="track"
        >
          <div className={`fill fill-${bar.tone}${bar.now === null ? ' sweep' : ''}`} style={bar.now === null ? undefined : { width: `${bar.now}%` }} />
        </div>
      </div>
    </section>
  )
}
