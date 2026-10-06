import type { CuePlayer } from '../core/ports.ts'

/**
 * Placeholder cue sounds made with the Web Audio API, so no audio files are needed yet.
 * The context is only created in `unlock()`, which the page calls from a click, so nothing
 * plays by itself (CUE-AMB-001).
 */
export class WebAudioCuePlayer implements CuePlayer {
  private ctx: AudioContext | null = null
  private muted = false

  unlock(): void {
    if (typeof AudioContext === 'undefined') return
    this.ctx ??= new AudioContext()
    void this.ctx.resume()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  chime(): void {
    const ctx = this.ctx
    if (this.muted || !ctx || ctx.state !== 'running') return
    const start = ctx.currentTime
    // A rising two-note chime: distinct from the room tone and the scribbling that will follow.
    for (const [i, hz] of [660, 990].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = hz
      gain.gain.setValueAtTime(0.0001, start + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.15, start + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.12 + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start + i * 0.12)
      osc.stop(start + i * 0.12 + 0.3)
    }
  }
}
