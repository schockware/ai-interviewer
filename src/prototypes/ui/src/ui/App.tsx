// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useEffect, useRef, useState } from 'react'
import { defaultMockConfig, type MockHostConfig } from '../adapters/mock/index.ts'
import { SystemClock } from '../adapters/systemClock.ts'
import type { PrepareInterview } from '../core/contract/pageFlow.ts'
import { buildSetupHost } from '../composition/hosts.ts'
import { readIntegration, type Integration } from '../composition/integration.ts'
import { AccessibilityDialog } from './AccessibilityDialog.tsx'
import { HardwarePage } from './HardwarePage.tsx'
import { IntegrationBar } from './IntegrationBar.tsx'
import InterviewPage from './InterviewPage.tsx'
import { SetupPage } from './SetupPage.tsx'

type Page = 'setup' | 'hardware' | 'interview'

const pageFromUrl = (): Page => {
  const wanted = new URLSearchParams(window.location.search).get('page')
  return wanted === 'interview' ? 'interview' : 'setup'
}

/**
 * The page flow (contracts/page-flow.md): Application setup, then Hardware setup, then the
 * interview. `?page=interview` opens the interview directly, for development and the e2e tests.
 * No router: three pages in a row need only a value.
 */
export default function App() {
  // A bad mode is shown, never guessed past (decision 0004).
  const [integration] = useState(() => {
    try {
      return readIntegration(import.meta.env, window.location.search)
    } catch (e) {
      return e instanceof Error ? e : new Error('Unknown integration error')
    }
  })
  if (integration instanceof Error)
    return (
      <p role="alert" className="card card-error">
        {integration.message}
      </p>
    )
  return <Flow integration={integration} />
}

function Flow({ integration }: { integration: Integration }) {
  const [page, setPage] = useState<Page>(pageFromUrl)
  const [request, setRequest] = useState<PrepareInterview | null>(null)
  const [config, setConfig] = useState<MockHostConfig>(defaultMockConfig)
  const [captions, setCaptions] = useState(false)
  const [a11yOpen, setA11yOpen] = useState(false)

  // The host reads the harness config when it acts, so changing it needs no new host.
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])
  const [{ host, parts }] = useState(() => buildSetupHost(integration, new SystemClock(), () => configRef.current))

  const openA11y = () => setA11yOpen(true)

  return (
    <>
      <IntegrationBar parts={parts} />
      {page === 'setup' && (
        <SetupPage
          key={`${config.saved}-${config.load}`}
          host={host}
          config={config}
          onConfig={setConfig}
          showMockServer={parts.setup === 'mock'}
          onOpenAccessibility={openA11y}
          onPrepare={(r) => {
            setRequest(r)
            setPage('hardware') // straight to hardware setup; preparation continues there
          }}
        />
      )}
      {page === 'hardware' && request && (
        <HardwarePage
          host={host}
          request={request}
          initialCaptions={captions}
          config={config}
          onConfig={setConfig}
          onOpenAccessibility={openA11y}
          onBack={() => setPage('setup')}
          onStart={(_start, wantsCaptions) => {
            setCaptions(wantsCaptions)
            setPage('interview')
          }}
        />
      )}
      {page === 'interview' && <InterviewPage captions={captions} onCaptions={setCaptions} onOpenAccessibility={openA11y} />}
      <AccessibilityDialog open={a11yOpen} onClose={() => setA11yOpen(false)} captions={captions} onCaptions={setCaptions} />
    </>
  )
}
