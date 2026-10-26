// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// The media uplink against a stand-in for the socket. Claude-written; not a human QA test.
import { describe, expect, it } from 'vitest'
import { toWebSocketUrl, WebSocketUplink, type SocketLike } from './webSocketUplink.ts'

const fakeSocket = () => {
  const sent: Array<string | Blob> = []
  const urls: string[] = []
  let closedWith: number | undefined
  const socket: SocketLike = {
    readyState: 0,
    onopen: null,
    onclose: null,
    onerror: null,
    send: (d) => void sent.push(d),
    close: (code) => {
      closedWith = code
    },
  }
  const factory = (url: string) => {
    urls.push(url)
    return socket
  }
  return {
    factory,
    urls,
    sent,
    open: () => {
      socket.readyState = 1
      socket.onopen?.({})
    },
    fail: () => socket.onerror?.({}),
    closeFromServer: (code: number) => {
      socket.readyState = 3
      socket.onclose?.({ code })
    },
    closedWith: () => closedWith,
  }
}

describe('toWebSocketUrl', () => {
  it('turns the relative /api base into a ws URL on this page’s host, wss under https', () => {
    expect(toWebSocketUrl('/api', { protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/api')
    expect(toWebSocketUrl('/api/', { protocol: 'https:', host: 'app.test' })).toBe('wss://app.test/api')
  })
  it('swaps the scheme of an absolute API URL', () => {
    expect(toWebSocketUrl('http://localhost:5036', { protocol: 'http:', host: 'x' })).toBe('ws://localhost:5036')
    expect(toWebSocketUrl('https://api.test/', { protocol: 'http:', host: 'x' })).toBe('wss://api.test')
  })
})

describe('WebSocketUplink', () => {
  const chunk = (n: number) => new Blob([new Uint8Array([n])])

  it('opens one socket per track, sends the header first, then the chunks in order, queuing until open', () => {
    const fake = fakeSocket()
    const uplink = new WebSocketUplink('/api', fake.factory, { protocol: 'http:', host: 'localhost:5173' })
    const link = uplink.open('s 1', 'audio', 'audio/webm;codecs=opus', () => undefined)
    link.send(chunk(1))
    expect(fake.sent).toEqual([])
    fake.open()
    link.send(chunk(2))
    expect(fake.urls).toEqual(['ws://localhost:5173/api/streams/s%201/audio'])
    expect(fake.sent[0]).toBe('{"mimeType":"audio/webm;codecs=opus"}')
    expect(fake.sent.slice(1)).toHaveLength(2)
  })

  it('reports a failure once, drops later chunks, and a clean close resolves', async () => {
    const fake = fakeSocket()
    const errors: string[] = []
    const link = new WebSocketUplink('/api', fake.factory, { protocol: 'http:', host: 'h' }).open('s1', 'composite', 'video/webm', (m) => errors.push(m))
    fake.fail()
    fake.fail()
    link.send(chunk(1))
    expect(errors).toEqual(['Could not reach the media stream at ws://h/api/streams/s1/composite.'])
    expect(fake.sent).toEqual([])

    fake.open()
    const closing = link.close()
    expect(fake.closedWith()).toBe(1000)
    fake.closeFromServer(1000)
    await closing
  })

  it('tells the page when the server closes the stream early', () => {
    const fake = fakeSocket()
    const errors: string[] = []
    new WebSocketUplink('/api', fake.factory, { protocol: 'http:', host: 'h' }).open('s1', 'audio', 'audio/webm', (m) => errors.push(m))
    fake.open()
    fake.closeFromServer(1008)
    expect(errors).toEqual(['The media stream closed early (code 1008).'])
  })
})
