// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import { defineConfig } from 'vitest/config'

// Tests that need the real API running. Not part of `npm test`. See docs/decisions/0004.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 15_000,
  },
})
