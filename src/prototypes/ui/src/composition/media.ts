// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { BrowserMediaDevices, BrowserRecorder } from '../adapters/browser/mediaStreams.ts'
import { MockUplink } from '../adapters/mock/mockUplink.ts'
import { WebSocketUplink } from '../adapters/ws/webSocketUplink.ts'
import type { MediaDevicesPort, MediaRecorderPort, MediaUplink } from '../core/ports.ts'
import type { Integration, IntegrationMode } from './integration.ts'

/** Everything the pages need to capture and send media. */
export interface MediaPorts {
  devices: MediaDevicesPort
  recorder: MediaRecorderPort
  uplink: MediaUplink
}

/**
 * The devices and the recorder are the browser's in every mode: they are local, not a server.
 * Only the uplink differs. In mock mode the chunks are counted and dropped; in real mode they go
 * to the API's media streams over plain WebSockets, through the same /api base as everything else
 * (the dev proxy carries WebSockets).
 */
export function buildMedia(integration: Integration): { media: MediaPorts; mode: IntegrationMode } {
  const devices = new BrowserMediaDevices()
  const recorder = new BrowserRecorder()
  if (integration.mode === 'mock') return { media: { devices, recorder, uplink: new MockUplink() }, mode: 'mock' }
  return { media: { devices, recorder, uplink: new WebSocketUplink(integration.apiBaseUrl) }, mode: 'real' }
}
