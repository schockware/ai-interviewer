// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useState } from 'react'
import { ModalDialog } from './ModalDialog.tsx'

/** A name and a block of text, for a pasted job description or pasted questions. Clears itself once added. */
export function PasteDialog({
  open,
  onClose,
  onAdd,
  title,
  nameLabel,
  textLabel,
  addLabel,
  idPrefix,
}: {
  open: boolean
  onClose: () => void
  onAdd: (displayName: string, text: string) => void
  title: string
  nameLabel: string
  textLabel: string
  addLabel: string
  idPrefix: string
}) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const ready = name.trim() !== '' && text.trim() !== ''
  return (
    <ModalDialog open={open} onClose={onClose} title={title}>
      <div className="field">
        <label htmlFor={`${idPrefix}-name`}>{nameLabel}</label>
        <input id={`${idPrefix}-name`} type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-text`}>{textLabel}</label>
        <textarea id={`${idPrefix}-text`} rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row">
        <button
          type="button"
          className={ready ? 'btn btn-primary' : 'btn btn-disabled'}
          aria-disabled={!ready}
          onClick={() => {
            if (!ready) return
            onAdd(name.trim(), text)
            setName('')
            setText('')
          }}
        >
          {addLabel}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </ModalDialog>
  )
}
