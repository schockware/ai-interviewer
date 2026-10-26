// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useEffect, useRef, useState } from 'react'
import { defaultMockConfig, type MockHostConfig } from '../adapters/mock/index.ts'
import { SystemClock } from '../adapters/systemClock.ts'
import type { StartInterview } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import { buildSetupHost, type HostParts } from '../composition/hosts.ts'
import { readIntegration, type Integration } from '../composition/integration.ts'
import { buildMedia, type MediaPorts } from '../composition/media.ts'
import { readTestMode, testHeaders, type TestSettings } from '../composition/testMode.ts'
import { AccessibilityDialog } from './AccessibilityDialog.tsx'
import { HardwarePage, type ChosenDevices } from './HardwarePage.tsx'
import { IntegrationBar } from './IntegrationBar.tsx'
import InterviewPage from './InterviewPage.tsx'
import { PreparationProvider } from './PreparationProvider.tsx'
import { usePreparation } from './preparation.ts'
import { ResumeUploadProvider } from './ResumeUploadProvider.tsx'
import { SetupPage } from './SetupPage.tsx'
import { TestDrawer } from './TestDrawer.tsx'
import { loadTestSettings, saveTestSettings } from './testSettingsStorage.ts'
import { WaitingRoomPage } from './WaitingRoomPage.tsx'

type Page = 'setup' | 'hardware' | 'waiting' | 'interview'

const pageFromUrl = (): Page => {
  const wanted = new URLSearchParams(window.location.search).get('page')
  return wanted === 'interview' ? 'interview' : 'setup'
}

/**
 * The page flow (specs/page-flow.md): Application setup, Hardware setup, the Waiting room, then
 * the interview. `?page=interview` opens the interview directly, for development and the e2e
 * tests. `?mode=test` opens the test drawer (composition/testMode.ts). No router: four pages in a
 * row need only a value.
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
  const [config, setConfig] = useState<MockHostConfig>(defaultMockConfig)

  // The host reads the harness config when it acts, so changing it needs no new host.
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  // Test mode: null when off. When on, the drawer's settings ride on every request as headers, read the same lazy way.
  const [testSettings, setTestSettings] = useState<TestSettings | null>(() => (readTestMode(window.location.search) ? loadTestSettings() : null))
  const testRef = useRef(testSettings)
  useEffect(() => {
    testRef.current = testSettings
    if (testSettings) saveTestSettings(testSettings)
  }, [testSettings])

  const [{ host, parts }] = useState(() => buildSetupHost(integration, new SystemClock(), () => configRef.current, () => testHeaders(testRef.current)))
  const [{ media }] = useState(() => buildMedia(integration))

  return (
    <ResumeUploadProvider host={host}>
      <PreparationProvider host={host}>
        <IntegrationBar parts={parts} />
        <Pages host={host} media={media} parts={parts} config={config} onConfig={setConfig} />
        {testSettings && <TestDrawer settings={testSettings} onChange={setTestSettings} real={parts.setup === 'real'} />}
      </PreparationProvider>
    </ResumeUploadProvider>
  )
}

function Pages({ host, media, parts, config, onConfig }: { host: SetupHost; media: MediaPorts; parts: HostParts; config: MockHostConfig; onConfig: (config: MockHostConfig) => void }) {
  const preparation = usePreparation()
  const [page, setPage] = useState<Page>(pageFromUrl)
  const [startRequest, setStartRequest] = useState<StartInterview | null>(null)
  const [devices, setDevices] = useState<ChosenDevices>({ audioDeviceId: null, videoDeviceId: null })
  const [captions, setCaptions] = useState(false)
  const [a11yOpen, setA11yOpen] = useState(false)
  const openA11y = () => setA11yOpen(true)

  return (
    <>
      {page === 'setup' && (
        <SetupPage
          key={`${config.saved}-${config.load}`}
          host={host}
          config={config}
          onConfig={onConfig}
          showMockServer={parts.setup === 'mock'}
          onOpenAccessibility={openA11y}
          onPrepare={(request, materials) => {
            preparation.start(request, materials)
            setPage('hardware') // straight to hardware setup; preparation continues there
          }}
        />
      )}
      {page === 'hardware' && (
        <HardwarePage
          host={host}
          media={media.devices}
          initialCaptions={captions}
          config={config}
          onConfig={onConfig}
          onOpenAccessibility={openA11y}
          onBack={() => setPage('setup')}
          onReady={(start, wantsCaptions, chosen) => {
            setStartRequest(start)
            setCaptions(wantsCaptions)
            setDevices(chosen)
            setPage('waiting')
          }}
        />
      )}
      {page === 'waiting' && startRequest && (
        <WaitingRoomPage
          host={host}
          startRequest={startRequest}
          onOpenAccessibility={openA11y}
          onLeave={() => setPage('hardware')}
          onChangeSetup={() => setPage('setup')}
          onJoin={() => setPage('interview')}
        />
      )}
      {page === 'interview' && (
        <InterviewPage
          captions={captions}
          onCaptions={setCaptions}
          onOpenAccessibility={openA11y}
          media={media}
          sessionId={startRequest?.sessionId}
          devices={devices}
          onEnd={() => {
            preparation.reset() // the session is closed; a new interview starts from Application setup
            setStartRequest(null)
            setPage('setup')
          }}
        />
      )}
      <AccessibilityDialog open={a11yOpen} onClose={() => setA11yOpen(false)} captions={captions} onCaptions={setCaptions} />
    </>
  )
}
