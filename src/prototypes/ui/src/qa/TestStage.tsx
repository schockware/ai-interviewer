// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { blackoutCss, cssFilter, injectFrameStyle, textSpacingCss, type VisionFilter } from './simulations.ts'

export type StageSims = { filter: VisionFilter; blackout: boolean; textSpacing: boolean }

const pages = [
  { value: '/', label: 'Application setup (start of the flow)' },
  { value: '/?page=interview', label: 'Interview screen' },
]

/**
 * The part of the page a simulation applies to: the profile's own check, then the real interviewer
 * prototype in a same-origin frame. The frame loads only on request, because the app moves focus
 * to its Accessibility button on load and that must not happen behind the tester's back.
 */
export function TestStage({ sims, children }: { sims: StageSims; children: ReactNode }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [choice, setChoice] = useState(pages[0].value)

  const applyToFrame = () => {
    injectFrameStyle(frameRef.current, 'qa-blackout', sims.blackout ? blackoutCss('html') : '')
    injectFrameStyle(frameRef.current, 'qa-text-spacing', sims.textSpacing ? textSpacingCss('html') : '')
  }
  useEffect(applyToFrame)

  return (
    <section className="card qa-stage" aria-labelledby="qa-stage-title" style={{ filter: cssFilter(sims.filter) }}>
      {sims.textSpacing && <style>{textSpacingCss('.qa-stage')}</style>}
      <h2 id="qa-stage-title">Test stage</h2>
      {children}
      <hr />
      <h3>The interviewer under this profile</h3>
      <div className="row">
        <label className="field">
          <span>Page to open</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            {pages.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn qa-align-end" onClick={() => setSrc(`${choice}${choice.includes('?') ? '&' : '?'}qa=${Date.now()}`)}>
          {src ? 'Reload the interviewer' : 'Load the interviewer'}
        </button>
      </div>
      {src ? (
        <iframe ref={frameRef} className="qa-frame" src={src} title="AI Interviewer prototype under test" onLoad={applyToFrame} />
      ) : (
        <p className="muted">Not loaded. When it loads, focus moves into it, as it would on the real page.</p>
      )}
    </section>
  )
}
