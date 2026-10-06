// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useEffect, useRef, type ReactNode } from 'react'

/** A native modal dialog: focus is trapped, Escape closes it, and focus returns to the opener. */
export function ModalDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className="a11y small-dialog" aria-label={title} onClose={onClose}>
      <div className="stack">
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  )
}
