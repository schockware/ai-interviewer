// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { HostParts } from '../composition/hosts.ts'

/** Always says what is real and what is mock, so a mock run is never mistaken for a real one. */
export function IntegrationBar({ parts }: { parts: HostParts }) {
  const real = parts.setup === 'real'
  return (
    <p className={real ? 'integration-bar integration-real' : 'integration-bar'} data-testid="integration-bar">
      Integration: {real ? 'real API for setup' : 'all mock'}
      {real && parts.hardware === 'mock' && ' · hardware checks still mock'} · the interview cues are always scripted
    </p>
  )
}
