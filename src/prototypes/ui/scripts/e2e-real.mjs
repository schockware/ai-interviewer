// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Runs the real-integration browser tests: sets INTEGRATION=real (cross-platform) and runs Playwright.
// playwright.config.ts then starts the UI in real mode and the API prototype. See docs/decisions/0004.
import { spawnSync } from 'node:child_process'

const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, INTEGRATION: 'real' },
})
process.exit(result.status ?? 1)
