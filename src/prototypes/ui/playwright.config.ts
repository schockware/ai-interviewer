import { defineConfig } from '@playwright/test'

// Autoplay: the harness must be able to start audio without a click (CUE-AMB-001 is about the
// user's ability to stop sound, not about tests being blocked).
// The Chromium flag is documented. The Firefox prefs are [unverified]; e2e/autoplay.spec.ts checks both.
export default defineConfig({
  testDir: './e2e',
  reporter: [['list']],
  outputDir: '../../../benchmarking/results/prototypes/ui/playwright',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
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
