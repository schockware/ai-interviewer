/** What a consumer learns from the next position it sees (EVT-CORE-003, EVT-DELIV-001). */
export type PositionCheck =
  | { kind: 'ok' }
  /** Positions `from` to `to` inclusive never arrived. */
  | { kind: 'gap'; from: number; to: number }
  /** Seen already, or older than one already seen. */
  | { kind: 'duplicate' }

export interface PositionTracker {
  accept(position: number): PositionCheck
}

/**
 * Tracks positions in arrival order. The first position seen sets the baseline unless
 * `expectedFirst` says where the stream must start, so a consumer that joins late is not
 * told about history it never asked for (EVT-DELIV-002).
 */
export function createPositionTracker(expectedFirst?: number): PositionTracker {
  let last: number | undefined = expectedFirst === undefined ? undefined : expectedFirst - 1
  return {
    accept(position) {
      if (last === undefined) {
        last = position
        return { kind: 'ok' }
      }
      if (position <= last) return { kind: 'duplicate' }
      const expected = last + 1
      last = position
      return position === expected ? { kind: 'ok' } : { kind: 'gap', from: expected, to: position - 1 }
    },
  }
}
