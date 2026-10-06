// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { ReactNode } from 'react'
import { AccessibilityIcon } from './icons.tsx'

/** The header every page shares: the Accessibility button first in focus order, then the title. Page-specific items go on the right. */
export function PageHeader({
  title,
  subtitle,
  onOpenAccessibility,
  children,
}: {
  title: string
  subtitle: string
  onOpenAccessibility: () => void
  children?: ReactNode
}) {
  return (
    <header className="page-head">
      <div className="row row-wide">
        <button type="button" className="btn btn-a11y" aria-haspopup="dialog" autoFocus onClick={onOpenAccessibility}>
          <AccessibilityIcon />
          Accessibility
        </button>
        <div>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  )
}
