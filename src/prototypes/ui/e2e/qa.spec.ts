// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
// Claude-written prototype tests for the QA accommodation canvas (qa.html). Not verified by a person.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const axe = (page: Page) => new AxeBuilder({ page }).withTags(tags)

test('the chooser and every profile have no axe violations at WCAG 2.2 AA', async ({ page }) => {
  for (const profile of ['', 'blind', 'deaf', 'color', 'low-vision', 'dyslexia']) {
    await page.goto(`/qa.html${profile ? `?profile=${profile}` : ''}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect((await axe(page).analyze()).violations, profile || 'chooser').toEqual([])
  }
})

test('blackout keeps the content in the accessibility tree and the passphrase check passes', async ({ page }) => {
  await page.goto('/qa.html?profile=blind')
  const blackout = page.getByRole('button', { name: 'Black out the page' })
  await blackout.click()
  await expect(blackout).toHaveAttribute('aria-pressed', 'true')
  await expect(blackout).toBeFocused()

  // Black on black: same color for text and background, but the text is still exposed.
  const phraseText = page.getByText(/^The passphrase is /)
  const colors = await phraseText.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.color, s.backgroundColor]
  })
  expect(colors).toEqual(['rgb(0, 0, 0)', 'rgb(0, 0, 0)'])
  await expect(page.getByRole('heading', { name: 'Passphrase' })).toBeVisible()
  const phrase = (await phraseText.textContent())!.replace('The passphrase is ', '').replace('.', '')

  await page.getByRole('textbox', { name: 'Type the passphrase' }).fill(phrase)
  await page.getByRole('button', { name: 'Check passphrase' }).click()
  await expect(page.getByRole('status')).toHaveText(/passed/)

  // Everything outside the stage that the tester needs stays readable while blacked out:
  // only the deliberate black-on-black text fails contrast.
  const results = await axe(page).disableRules(['color-contrast']).analyze()
  expect(results.violations).toEqual([])
})

test('the cheat sheet opens without taking focus and is out of the tree when closed', async ({ page }) => {
  await page.goto('/qa.html?profile=blind')
  await expect(page.getByRole('complementary', { name: /keys/ })).toHaveCount(0)
  const toggle = page.getByRole('button', { name: 'Show key cheat sheet' })
  await toggle.click()
  await expect(page.getByRole('button', { name: 'Hide key cheat sheet' })).toBeFocused()
  await expect(page.getByRole('complementary', { name: 'NVDA keys' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Screen reader' }).selectOption('voiceover')
  await expect(page.getByRole('complementary', { name: 'VoiceOver (macOS) keys' })).toBeVisible()
  expect((await axe(page).analyze()).violations).toEqual([])
})

test('a color filter applies to the test stage only', async ({ page }) => {
  await page.goto('/qa.html?profile=color')
  await page.getByRole('radio', { name: /Deuteranopia/ }).check()
  const stage = page.getByRole('region', { name: 'Test stage' })
  await expect(stage).toHaveCSS('filter', /qa-deuteranopia/)
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCSS('filter', 'none')
})

test('the interviewer loads in the stage and the blackout reaches into it', async ({ page }) => {
  await page.goto('/qa.html?profile=blind')
  await page.getByRole('button', { name: 'Load the interviewer' }).click()
  const frame = page.frameLocator('iframe[title="AI Interviewer prototype under test"]')
  await expect(frame.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Black out the page' }).click()
  await expect(frame.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 0, 0)')
})

test('text spacing and the scramble keep the real text for screen readers', async ({ page }) => {
  await page.goto('/qa.html?profile=dyslexia')
  await page.getByRole('checkbox', { name: 'Scramble words (approximation)' }).check()
  await expect(page.getByText(/^Tell me about a time a project changed direction/)).toBeAttached()
  await page.getByRole('checkbox', { name: 'Text spacing (WCAG 1.4.12)' }).check()
  await expect(page.getByRole('heading', { name: 'Sample question' })).toHaveCSS('letter-spacing', /px/)
  expect((await axe(page).analyze()).violations).toEqual([])
})
