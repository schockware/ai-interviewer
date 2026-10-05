import type { StreamEvent } from '../../core/contract/index.ts'
import type { Clock, EventSource } from '../../core/ports.ts'
import type { BuiltStream } from './buildStream.ts'

/**
 * Plays a built stream through a Clock: each event is delivered when the clock has run for its
 * true timestamp since `start()`. Both timestamps stay on the event. Choosing which one to show
 * is the cue layer's job, not the source's. A drifting clock makes delivery drift too, which is
 * how component tests emulate a front end whose clock disagrees with the session clock.
 */
export class ScriptedEventSource implements EventSource {
  readonly header: BuiltStream['header']
  private readonly events: readonly StreamEvent[]
  private readonly clock: Clock
  private listeners = new Set<(event: StreamEvent) => void>()
  private cancels: (() => void)[] = []
  private started = false

  constructor(stream: BuiltStream, clock: Clock) {
    this.header = stream.header
    this.events = stream.events
    this.clock = clock
  }

  subscribe(listener: (event: StreamEvent) => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.cancels = this.events.map((event) =>
      this.clock.schedule(event.t_true_ms, () => {
        for (const listener of [...this.listeners]) listener(event)
      }),
    )
  }

  stop(): void {
    for (const cancel of this.cancels) cancel()
    this.cancels = []
    this.started = false
  }
}
