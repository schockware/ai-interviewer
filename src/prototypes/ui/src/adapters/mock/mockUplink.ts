// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { QuestionId, SessionId } from '../../core/contract/pageFlow.ts'
import type { MediaTrackKind, MediaUplink, Uplink } from '../../core/ports.ts'

export interface UplinkTally {
  sessionId: SessionId
  questionId: QuestionId
  track: MediaTrackKind
  mimeType: string
  chunks: number
  bytes: number
  closed: boolean
}

/** No server: counts what would have been sent, so the page and the tests can see the capture works. */
export class MockUplink implements MediaUplink {
  readonly tallies: UplinkTally[] = []

  open(sessionId: SessionId, questionId: QuestionId, track: MediaTrackKind, mimeType: string): Uplink {
    const tally: UplinkTally = { sessionId, questionId, track, mimeType, chunks: 0, bytes: 0, closed: false }
    this.tallies.push(tally)
    return {
      send: (chunk) => {
        tally.chunks += 1
        tally.bytes += chunk.size
      },
      close: async () => {
        tally.closed = true
      },
    }
  }
}
