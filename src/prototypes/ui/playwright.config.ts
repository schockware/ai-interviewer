import { defineConfig } from '@playwright/test'

// Mock by default. INTEGRATION=real (npm run test:e2e:real) starts the UI in real mode and the API
// prototype, and runs only the *.real.spec.ts files. See docs/decisions/0004.
const real = process.env.INTEGRATION === 'real'

// Autoplay: the harness must be able to start audio without a click (CUE-AMB-001 is about the
// user's ability to stop sound, not about tests being blocked).
// The Chromium flag is documented. The Firefox prefs are [unverified]; e2e/autoplay.spec.ts checks both.
export default defineConfig({
  testDir: './e2e',
  testMatch: real ? /.*\.real\.spec\.ts/ : /.*\.spec\.ts/,
  testIgnore: real ? [] : /.*\.real\.spec\.ts/,
  reporter: [['list']],
  outputDir: '../../../benchmarking/results/prototypes/ui/playwright',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    {
      command: real ? 'npm run dev:real -- --port 5173 --strictPort' : 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
    ...(real
      ? [
          {
            command: 'dotnet run --project ../api/src/AiInterviewer.Api --launch-profile http',
            url: 'http://localhost:5036/openapi/v1.json',
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]
      : []),
  ],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: { firefoxUserPrefs: { 'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0 } },
      },
    },
  ],
})
