// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { createContext, useContext } from 'react'
import type { PrepReport, PrepareInterview } from '../core/contract/pageFlow.ts'
import type { Materials } from '../core/setup/waitingRoom.ts'

/** The interview being prepared, as every setup page sees it. */
export interface Preparation {
  /** What was asked for, or null before Prepare interview. */
  request: PrepareInterview | null
  materials: Materials | null
  /** The host's latest report, or null before the first. */
  report: PrepReport | null
  start: (request: PrepareInterview, materials: Materials) => void
  /** Asks the host again, after a failure. */
  retry: () => void
  /** Forgets the preparation, when the interview ends. */
  reset: () => void
}

export const PreparationContext = createContext<Preparation | null>(null)

export function usePreparation(): Preparation {
  const value = useContext(PreparationContext)
  if (!value) throw new Error('usePreparation needs a PreparationProvider above it.')
  return value
}

export function usePreparationIfAny(): Preparation | null {
  return useContext(PreparationContext)
}
