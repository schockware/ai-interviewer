// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { TranscriptSource } from '../core/contract/pageFlow.ts'
import { failuresOf, linesOf, producerOf } from '../core/media/transcript.ts'
import type { TranscriptView } from './useTranscript.ts'

/**
 * Not in the mockups: the two transcription passes side by side, for the accuracy comparison
 * (Steven, 2026-10-27). It is not a caption system and announces nothing: captions have their own
 * section and are off by default. Partials are set apart until a final replaces them.
 */
export function TranscriptCard({ transcript }: { transcript: TranscriptView }) {
  return (
    <section aria-labelledby="transcript-title" className="card" data-testid="transcript-card">
      <div>
        <h2 id="transcript-title">Transcript (prototype)</h2>
        <p className="muted">Two passes of the same audio, kept for the accuracy comparison. Not captions; nothing here is announced.</p>
      </div>
      {transcript.error && (
        <p className="note-box note-bad" data-testid="transcript-failure">
          {transcript.error}
        </p>
      )}
      <div className="grid-2 transcript">
        <Pass transcript={transcript} source="real-time" title="Live, as you speak" empty={transcript.watching ? 'Listening for the first words…' : 'Starts with the interview.'} />
        <Pass transcript={transcript} source="post-question" title="After the question, large model" empty="Arrives once the question’s audio is complete." />
      </div>
    </section>
  )
}

function Pass({ transcript, source, title, empty }: { transcript: TranscriptView; source: TranscriptSource; title: string; empty: string }) {
  const lines = linesOf(transcript.state, source)
  const failures = failuresOf(transcript.state, source)
  const producer = producerOf(transcript.state, source)
  return (
    <div className="stack" data-testid={`transcript-${source}`}>
      <h3>{title}</h3>
      {lines.length === 0 && failures.length === 0 && <p className="muted">{empty}</p>}
      {lines.length > 0 && (
        <p className="transcript-text">
          {lines.map((l) => (
            <span key={l.id} className={l.final ? 'transcript-final' : 'transcript-partial'}>
              {l.text}{' '}
            </span>
          ))}
        </p>
      )}
      {failures.map((f, i) => (
        <p key={i} className="note-box note-bad" data-testid="transcript-failure">
          {f.message}
        </p>
      ))}
      {producer && <p className="note">{producer}</p>}
    </div>
  )
}
