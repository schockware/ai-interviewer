// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useEffect, useReducer, useState } from 'react'
import type { MockHostConfig } from '../adapters/mock/index.ts'
import type { ApplicationSetupPage, PrepareInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import { initialSetup, setupReducer, type SetupAction, type SetupState } from '../core/setup/setupState.ts'
import type { Materials } from '../core/setup/waitingRoom.ts'
import { RoleSetupPage } from './RoleSetupPage.tsx'
import { SetupPage } from './SetupPage.tsx'

type FlowAction = SetupAction | { type: 'init'; state: SetupState }

const flowReducer = (s: SetupState | null, a: FlowAction): SetupState | null => (a.type === 'init' ? a.state : s === null ? s : setupReducer(s, a))

/**
 * The two setup pages, Application setup and Role set up, over one form (specs/page-flow.md,
 * sections 1 and 2). This owns the page load and the form, and stays mounted while the later pages
 * show, so coming back finds the choices as they were. It also looks a chosen role up through the
 * host, because the Role set up page needs the role's description and saved questions.
 */
export function SetupFlow({
  host,
  step,
  config,
  onConfig,
  showMockServer,
  onOpenAccessibility,
  onRoleSetup,
  onBackToSetup,
  onPrepare,
}: {
  host: SetupHost
  /** Which page shows; `hidden` renders nothing and keeps the form. */
  step: 'setup' | 'role' | 'hidden'
  config: MockHostConfig
  onConfig: (config: MockHostConfig) => void
  /** The harness card only means something while the host is the mock. */
  showMockServer: boolean
  onOpenAccessibility: () => void
  onRoleSetup: () => void
  onBackToSetup: () => void
  onPrepare: (request: PrepareInterview, materials: Materials) => void
}) {
  const [page, setPage] = useState<ApplicationSetupPage>({ type: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [s, dispatch] = useReducer(flowReducer, null)

  // Loads on mount and on "Try again". The harness changing what the server holds remounts this (App sets a key).
  useEffect(() => {
    let live = true
    host.loadPage().then(
      (p) => {
        if (!live) return
        setPage(p)
        if (p.type === 'ready') dispatch({ type: 'init', state: initialSetup(p) })
      },
      (e: unknown) => live && setPage({ type: 'error', message: e instanceof Error ? e.message : 'Unknown error' }),
    )
    return () => {
      live = false
    }
  }, [host, attempt])

  // A newly chosen role is looked up: its description and whether it already has questions.
  const pending = s?.roleDetail.type === 'loading' ? s.roleDetail.roleId : null
  useEffect(() => {
    if (pending === null) return
    let live = true
    host.loadRole(pending).then(
      (detail) => live && dispatch({ type: 'roleLoaded', detail }),
      (e: unknown) => live && dispatch({ type: 'roleFailed', roleId: pending, message: e instanceof Error ? e.message : 'The role could not be loaded.' }),
    )
    return () => {
      live = false
    }
  }, [host, pending])

  if (step === 'hidden') return null
  if (step === 'role' && s) return <RoleSetupPage host={host} s={s} dispatch={dispatch} onBack={onBackToSetup} onPrepare={onPrepare} onOpenAccessibility={onOpenAccessibility} />
  return (
    <SetupPage
      page={page}
      s={s}
      dispatch={dispatch}
      host={host}
      config={config}
      onConfig={onConfig}
      showMockServer={showMockServer}
      onOpenAccessibility={onOpenAccessibility}
      onRetry={() => {
        setPage({ type: 'loading' })
        setAttempt(attempt + 1)
      }}
      onRoleSetup={onRoleSetup}
    />
  )
}
