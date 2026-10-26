// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PrepReport, PrepareInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import type { Materials } from '../core/setup/waitingRoom.ts'
import { PreparationContext } from './preparation.ts'

/**
 * Preparation outlives the page that asked for it: it starts on Application setup, shows on
 * Hardware setup and the Waiting room, and shows on Application setup again if the user comes
 * back. So the host subscription lives here, above the pages (specs/page-flow.md, shared status).
 */
export function PreparationProvider({ host, children }: { host: SetupHost; children: ReactNode }) {
  const [request, setRequest] = useState<PrepareInterview | null>(null)
  const [materials, setMaterials] = useState<Materials | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [report, setReport] = useState<PrepReport | null>(null)

  useEffect(() => {
    if (!request) return
    return host.prepareInterview(request, setReport)
  }, [host, request, attempt])

  const start = useCallback((next: PrepareInterview, nextMaterials: Materials) => {
    setReport(null)
    setMaterials(nextMaterials)
    setRequest(next)
    setAttempt(0)
  }, [])
  const retry = useCallback(() => {
    setReport(null)
    setAttempt((n) => n + 1)
  }, [])
  const reset = useCallback(() => {
    setRequest(null)
    setMaterials(null)
    setReport(null)
    setAttempt(0)
  }, [])

  const value = useMemo(() => ({ request, materials, report, start, retry, reset }), [request, materials, report, start, retry, reset])
  return <PreparationContext.Provider value={value}>{children}</PreparationContext.Provider>
}
