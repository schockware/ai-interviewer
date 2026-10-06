import type { CueMode } from '../contract/index.ts'
import type { Clock, EventSource } from '../ports.ts'
import { nextDueMs } from './display.ts'
import { initialState, reduce, type CueAction, type CueState } from './reducer.ts'
import { strategyFor } from './strategy.ts'

/**
 * Wires an event source and a clock to the reducer. Events arrive at their true time and are
 * kept. The engine wakes the display at each moment a watched timeline changes, so in
 * `perceived` mode a cue appears when its perceived time comes, not when the event arrived.
 * Plain TypeScript: a store with `getState` and `subscribe`, so React can read it with
 * useSyncExternalStore and a test can read it directly.
 */
export class CueEngine {
  private state: CueState
  private readonly listeners = new Set<() => void>()
  private readonly source: EventSource
  private readonly clock: Clock
  private origin = 0
  private cancelWake: (() => void) | null = null
  private unsubscribe: (() => void) | null = null
  private running = false

  constructor(source: EventSource, clock: Clock, mode: CueMode = 'perceived') {
    this.source = source
    this.clock = clock
    this.state = initialState(mode)
  }

  getState = (): CueState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  /** Session time now, in ms, on this engine's clock. */
  private sessionMs(): number {
    return this.clock.now() - this.origin
  }

  private dispatch(action: CueAction): void {
    const next = reduce(this.state, action)
    if (next === this.state) return
    this.state = next
    for (const l of [...this.listeners]) l()
    this.reschedule()
  }

  private reschedule(): void {
    this.cancelWake?.()
    this.cancelWake = null
    if (!this.running) return
    const strategy = strategyFor(this.state.mode)
    const due = nextDueMs(this.state.log, strategy.watched, this.state.nowMs)
    if (due === null) return
    this.cancelWake = this.clock.schedule(Math.max(0, due - this.sessionMs()), () => {
      this.dispatch({ type: 'tick', nowMs: due })
    })
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.origin = this.clock.now()
    this.unsubscribe = this.source.subscribe((event) => this.dispatch({ type: 'event', event, nowMs: this.sessionMs() }))
    this.source.start()
  }

  stop(): void {
    this.running = false
    this.source.stop()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.cancelWake?.()
    this.cancelWake = null
  }

  /** Takes effect at once (CUE-MOD-002). */
  setMode(mode: CueMode): void {
    this.dispatch({ type: 'mode', mode })
  }
}
