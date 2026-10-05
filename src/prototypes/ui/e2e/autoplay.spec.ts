import { expect, test } from '@playwright/test'

// Checks that the harness lets audio start with no user gesture, in each browser.
test('an AudioContext starts without a user gesture', async ({ page }) => {
  await page.goto('/')
  const state = await page.evaluate(async () => {
    const ctx = new AudioContext()
    await ctx.resume().catch(() => {})
    return ctx.state
  })
  expect(state).toBe('running')
})
