// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useEffect, useRef, useState } from 'react'
import { defaultMockConfig, MockSetupHost, type MockHostConfig } from '../adapters/mock/index.ts'
import { SystemClock } from '../adapters/systemClock.ts'
import type { PrepareInterview } from '../core/contract/pageFlow.ts'
import { AccessibilityDialog } from './AccessibilityDialog.tsx'
import { HardwarePage } from './HardwarePage.tsx'
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
  const [host] = useState(() => new MockSetupHost(new SystemClock(), () => configRef.current))

  const openA11y = () => setA11yOpen(true)

  return (
    <>
      {page === 'setup' && (
        <SetupPage
          key={`${config.saved}-${config.load}`}
          host={host}
          config={config}
          onConfig={setConfig}
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
