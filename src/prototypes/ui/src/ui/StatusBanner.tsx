// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { bannerView, type BannerKind, type Uploading } from '../core/setup/status.ts'
import { CheckIcon, ErrorIcon, HourglassIcon } from './icons.tsx'

/**
 * The shared status banner (design/mockups/ui/StatusBanner.dc.html). Its slot sits under the header
 * on every page: a polite status region that is announced when it appears or changes, never moves
 * focus, and keeps a text label beside its icon and colour. Hidden, it takes no space.
 */
export function StatusBanner({ kind, what = 'both', body }: { kind: BannerKind; what?: Uploading; body?: string }) {
  const view = bannerView(kind, what, body)
  if (!view) return <section role="status" aria-label="Status" className="banner-slot" data-testid="status-banner" />
  return (
    <section role="status" aria-label="Status" className={`banner banner-${view.tone}`} data-testid="status-banner" data-kind={view.kind}>
      <span aria-hidden="true" className="banner-icon">
        {view.icon === 'ready' ? <CheckIcon /> : view.icon === 'problem' ? <ErrorIcon /> : <HourglassIcon />}
      </span>
      <div>
        <h2>{view.title}</h2>
        <p>{view.body}</p>
      </div>
    </section>
  )
}
