// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { QuestionId, SessionId } from '../../core/contract/pageFlow.ts'
import type { MediaTrackKind, MediaUplink, Uplink } from '../../core/ports.ts'

/** The slice of a WebSocket this adapter uses, so a test can stand in for the network. */
export interface SocketLike {
  readyState: number
  onopen: ((event: object) => void) | null
  onclose: ((event: { code?: number }) => void) | null
  onerror: ((event: object) => void) | null
  send(data: string | Blob): void
  close(code?: number): void
}
export type SocketFactory = (url: string) => SocketLike

const OPEN = 1

export const MEDIA_STREAM_PATH = '/streams'

/** `/api` becomes `ws://host/api`; an absolute http(s) URL swaps its scheme. */
export function toWebSocketUrl(apiBaseUrl: string, location: { protocol: string; host: string }): string {
  const base = apiBaseUrl.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(base)) return base.replace(/^http/i, 'ws')
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${base.startsWith('/') ? base : `/${base}`}`
}

/**
 * The real media uplink (src/prototypes/api README, Media streams): a plain WebSocket per track at
 * /streams/{sessionId}/{questionId}/{track}. The first message is the JSON header; every chunk after it is
 * sent as it comes. Chunks that arrive before the socket opens wait in order; after a failure
 * they are dropped and the page is told once.
 */
export class WebSocketUplink implements MediaUplink {
  private readonly baseUrl: string
  private readonly makeSocket: SocketFactory

  // The browser's WebSocket has these members; its handler types are stricter, hence the cast at this one boundary.
  constructor(apiBaseUrl: string, makeSocket: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike, location: { protocol: string; host: string } = window.location) {
    this.baseUrl = toWebSocketUrl(apiBaseUrl, location)
    this.makeSocket = makeSocket
  }

  open(sessionId: SessionId, questionId: QuestionId, track: MediaTrackKind, mimeType: string, onError: (message: string) => void): Uplink {
    const url = `${this.baseUrl}${MEDIA_STREAM_PATH}/${encodeURIComponent(sessionId)}/${encodeURIComponent(questionId)}/${track}`
    const socket = this.makeSocket(url)
    const queue: Blob[] = []
    let failed = false
    let closed: (() => void) | null = null

    socket.onopen = () => {
      socket.send(JSON.stringify({ mimeType }))
      for (const chunk of queue) socket.send(chunk)
      queue.length = 0
    }
    socket.onerror = () => {
      if (failed) return
      failed = true
      onError(`Could not reach the media stream at ${url}.`)
    }
    socket.onclose = (event) => {
      if (!failed && closed === null && event.code !== undefined && event.code !== 1000) {
        failed = true
        onError(`The media stream closed early (code ${event.code}).`)
      }
      closed?.()
    }

    return {
      send: (chunk) => {
        if (failed) return
        if (socket.readyState === OPEN) socket.send(chunk)
        else queue.push(chunk)
      },
      close: () =>
        new Promise<void>((resolve) => {
          closed = resolve
          if (socket.readyState > OPEN) return resolve()
          socket.close(1000)
          setTimeout(resolve, 3000) // never wait on a socket that will not answer
        }),
    }
  }
}
