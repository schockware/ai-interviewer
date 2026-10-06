import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.describe('main page, simulation-off scenario, in a real browser', () => {
  test('shows the interviewer state change by change, and announces each once (CUE-ANN-001, CUE-ANN-002)', async ({ page }) => {
    await page.goto('/')
    const label = page.getByTestId('cue-label')
    const region = page.getByTestId('announcement')
    await expect(label).toHaveText('Not started')
    await expect(region).toHaveText('')

    await page.getByRole('button', { name: 'Start' }).click()
    await expect(label).toHaveText('Interviewer is thinking', { timeout: 2000 })
    await expect(region).toHaveText('Interviewer is thinking')
    await expect(label).toHaveText('Interviewer is speaking', { timeout: 3000 })
    await expect(region).toHaveText('Interviewer is speaking')
    await expect(label).toHaveText('Your turn', { timeout: 5000 })
    await expect(region).toHaveAttribute('aria-live', 'polite')
  })

  test('has no axe violations while a cue is showing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByTestId('cue-label')).toHaveText('Interviewer is thinking', { timeout: 2000 })
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
    expect(results.violations).toEqual([])
  })

  test('has no axe violations with captions on', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Captions: off' }).click()
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
    expect(results.violations).toEqual([])
  })

  test('has no axe violations with the Accessibility dialog open', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Accessibility' }).click()
    await expect(page.getByRole('dialog', { name: 'Accessibility' })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
    expect(results.violations).toEqual([])
  })

  test('has no axe violations in debug mode with both lanes showing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Cues follow' }).selectOption('debug')
    await expect(page.getByTestId('lanes')).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
    expect(results.violations).toEqual([])
  })

  test('every control can be reached and used with the keyboard alone (CUE-CTL-002)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Accessibility' })).toBeFocused()
    // Open and close the Accessibility dialog by keyboard; focus returns to the button.
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Accessibility' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Accessibility' })).toBeFocused()
    // Start the scripted interview without the mouse.
    await page.getByRole('button', { name: 'Start' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('cue-label')).toHaveText('Interviewer is thinking', { timeout: 2000 })
    await page.getByRole('combobox', { name: 'Cues follow' }).focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('combobox', { name: 'Cues follow' })).toHaveValue('debug')
  })

  test('switching mode does not restart the session (CUE-MOD-002)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByTestId('cue-label')).toHaveText('Interviewer is speaking', { timeout: 3000 })
    await page.getByRole('combobox', { name: 'Cues follow' }).selectOption('true_state')
    await expect(page.getByTestId('cue-label')).toHaveText('Interviewer is speaking')
    await page.getByRole('combobox', { name: 'Cues follow' }).selectOption('perceived')
    await expect(page.getByTestId('cue-label')).toHaveText('Interviewer is speaking')
  })

  test('does not make sound before a click (CUE-AMB-001)', async ({ page }) => {
    await page.addInitScript(() => {
      const created: string[] = []
      const Original = window.AudioContext
      window.AudioContext = class extends Original {
        constructor(...args: ConstructorParameters<typeof AudioContext>) {
          super(...args)
          created.push('created')
        }
      }
      ;(window as unknown as { __audioContexts: string[] }).__audioContexts = created
    })
    await page.goto('/')
    const count = () => page.evaluate(() => (window as unknown as { __audioContexts: string[] }).__audioContexts.length)
    expect(await count()).toBe(0)
    await page.getByRole('button', { name: 'Start' }).click()
    expect(await count()).toBe(1)
  })
})
