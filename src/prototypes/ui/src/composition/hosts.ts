// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { HttpSetupHost } from '../adapters/http/httpSetupHost.ts'
import { MockSetupHost, type MockHostConfig } from '../adapters/mock/mockSetupHost.ts'
import type { Clock, SetupHost } from '../core/ports.ts'
import type { Integration, IntegrationMode } from './integration.ts'

/** What each part of the host is backed by, so the page can say so. */
export interface HostParts {
  setup: IntegrationMode
  hardware: IntegrationMode
}

/**
 * The composition root for the setup host: the one place that knows which adapter backs which
 * port. In real mode the API does everything it can, and hardware verification stays mock
 * because the API has no endpoint for it yet (the audio stream is an open item in
 * contracts/page-flow.md). Remove that line when the endpoint exists.
 */
export function buildSetupHost(integration: Integration, clock: Clock, mockConfig: () => MockHostConfig): { host: SetupHost; parts: HostParts } {
  const mock = new MockSetupHost(clock, mockConfig)
  if (integration.mode === 'mock') return { host: mock, parts: { setup: 'mock', hardware: 'mock' } }
  const http = new HttpSetupHost(integration.apiBaseUrl)
  const host: SetupHost = {
    loadPage: () => http.loadPage(),
    uploadResume: (r) => http.uploadResume(r),
    uploadJobDescription: (r) => http.uploadJobDescription(r),
    pasteJobDescription: (r) => http.pasteJobDescription(r),
    prepareInterview: (r, onProgress) => http.prepareInterview(r, onProgress),
    startInterview: (r) => http.startInterview(r),
    verifyHardware: (kind) => mock.verifyHardware(kind),
  }
  return { host, parts: { setup: 'real', hardware: 'mock' } }
}
