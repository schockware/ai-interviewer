import { buildStream, type BuiltStream } from './buildStream.ts'
import { calibrationScript, policies } from './calibrations.ts'
import type { MockScript } from './script.ts'
import simulationOff from './scripts/simulation-off.json'

export { buildStream, type BuiltStream } from './buildStream.ts'
export * as calibrations from './calibrations.ts'
export { generateScript, type MockInterviewOptions, type TurnPolicy, type UserSpan } from './mockInterviewer.ts'
export { ScriptedEventSource } from './scriptedEventSource.ts'
export type { AudioRun, MockScript, ScriptEvent } from './script.ts'

// JSON imports are typed loosely, so the cast is checked when buildStream parses every event.
const scripts: MockScript[] = [simulationOff as unknown as MockScript, ...policies.map(calibrationScript)]

export const mockScripts: Readonly<Record<string, MockScript>> = Object.fromEntries(scripts.map((s) => [s.name, s]))

export function builtMockStream(name: string): BuiltStream {
  const script = mockScripts[name]
  if (!script) throw new Error(`No mock script named "${name}"`)
  return buildStream(script)
}
export { MockSetupHost, MOCK_DELAYS, defaultMockConfig, type MockHostConfig } from './mockSetupHost.ts'
