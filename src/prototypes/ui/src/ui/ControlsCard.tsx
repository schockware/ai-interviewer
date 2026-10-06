// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { useState } from 'react'

type AnswerBy = 'voice' | 'text'

/**
 * Prototype: the buttons are drawn but do nothing yet. The mock event source takes no control
 * requests. "Answer by" and the volume slider hold local state only.
 */
export function ControlsCard() {
  const [answerBy, setAnswerBy] = useState<AnswerBy>('voice')
  const [roomVolume, setRoomVolume] = useState(30)
  return (
    <section className="card controls-card" aria-labelledby="controls-heading">
      <h3 id="controls-heading">Controls</h3>
      <button type="button" className="btn btn-primary">
        Give me a sec
      </button>
      <div className="grid-2">
        {['Repeat', 'Pause', 'Hint', 'Skip'].map((name) => (
          <button key={name} type="button" className="btn">
            {name}
          </button>
        ))}
      </div>
      <div className="field">
        <span id="answer-by" className="muted">
          Answer by
        </span>
        <div role="group" aria-labelledby="answer-by" className="segmented">
          <button type="button" aria-pressed={answerBy === 'voice'} onClick={() => setAnswerBy('voice')}>
            Voice
          </button>
          <button type="button" aria-pressed={answerBy === 'text'} onClick={() => setAnswerBy('text')}>
            Text
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="ambient" className="muted">
          Room sound volume
        </label>
        <input id="ambient" type="range" min={0} max={100} value={roomVolume} onChange={(e) => setRoomVolume(Number(e.target.value))} />
      </div>
    </section>
  )
}
