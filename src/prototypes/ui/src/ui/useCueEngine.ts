import { useEffect, useSyncExternalStore } from 'react'
import type { CueEngine, CuePayload } from '../core/cues/index.ts'
import type { CuePlayer } from '../core/ports.ts'

/** Reads the payload from the engine. The payload keeps its identity until something visible changes, so this re-renders only then. */
export function useCuePayload(engine: CueEngine): CuePayload {
  return useSyncExternalStore(engine.subscribe, () => engine.getState().payload)
}

/** Sounds a chime once per displayed hand-off to the user (CUE-STA-003). */
export function useCueSounds(payload: CuePayload, player: CuePlayer): void {
  const { transitionId, chime } = payload
  useEffect(() => {
    if (transitionId > 0 && chime) player.chime()
  }, [transitionId, chime, player])
}
