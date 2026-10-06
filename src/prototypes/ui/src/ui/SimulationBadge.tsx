// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { CuePayload } from '../core/cues/index.ts'
import { SimulationIcon } from './icons.tsx'

/** Shown for as long as a call condition is simulated (CUE-SIM-001). */
export function SimulationBadge({ simulation }: { simulation: CuePayload['simulation'] }) {
  if (!simulation.active) return null
  return (
    <span className="pill pill-warn" data-testid="simulation-badge">
      <SimulationIcon />
      Simulated: {simulation.preset}
    </span>
  )
}
