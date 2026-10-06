// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([])

const readySetup = async (page: Page) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()
}
const toHardware = async (page: Page) => {
  await readySetup(page)
  await page.getByRole('combobox', { name: 'Role title' }).selectOption({ label: 'Software Engineer' })
  await page.getByRole('button', { name: /Prepare interview/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check your setup' })).toBeVisible()
}

test.describe('setup, hardware and interview as one flow', () => {
  test('goes from Application setup through Hardware setup to the interview', async ({ page }) => {
    await toHardware(page)
    await page.getByRole('button', { name: 'Start audio check' }).click()
    await expect(page.getByRole('list')).toContainText('Audio · verified, rated clear', { timeout: 5000 })
    // Preparation takes five seconds in the mock host.
    await expect(page.getByText('The host is ready')).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: /Start interview/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Practice interview' })).toBeVisible()
  })

  test('Application setup: loading, ready, hot panel and settings open have no axe violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Loading your settings…')).toBeVisible()
    await axe(page)
    await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()
    await axe(page)
    await page.getByRole('radio', { name: /Hot interview/ }).check()
    await page.getByRole('button', { name: 'Application settings' }).click()
    await expect(page.getByRole('heading', { name: 'Application settings' })).toBeVisible()
    await axe(page)
  })

  test('Application setup: the error state has no axe violations', async ({ page }) => {
    await readySetup(page)
    await page.getByLabel('Loading this page').selectOption('fails')
    await expect(page.getByRole('alert')).toContainText('We could not load your setup')
    await axe(page)
  })

  test('Application setup: loading a resume by file selects it and makes the form hot', async ({ page }) => {
    await readySetup(page)
    await page.getByRole('radio', { name: /Hot interview/ }).check()
    await page.getByTestId('resume-file').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
    await expect(page.getByText('Processing cv.pdf')).toBeVisible()
    await expect(page.getByText('cv is loaded and selected.')).toBeVisible({ timeout: 4000 })
    await expect(page.getByRole('combobox', { name: 'Use an existing resume' })).toHaveValue(/res-new/)
  })

  test('Hardware setup: preparing, with a check done, has no axe violations', async ({ page }) => {
    await toHardware(page)
    await axe(page)
    await page.getByRole('button', { name: 'Start audio check' }).click()
    await expect(page.getByRole('list')).toContainText('verified', { timeout: 5000 })
    await axe(page)
  })

  test('Hardware setup: a preparation that fails shows the diagnosis, and has no axe violations', async ({ page }) => {
    await readySetup(page)
    await page.getByLabel('Preparing the interview').selectOption('fails')
    await page.getByRole('combobox', { name: 'Role title' }).selectOption({ label: 'Software Engineer' })
    await page.getByRole('button', { name: /Prepare interview/ }).click()
    await expect(page.getByText('What the interviewer found')).toBeVisible({ timeout: 12000 })
    await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    await axe(page)
  })

  test('Hardware setup: the keyboard reaches the audio check and Start stays blocked until it passes', async ({ page }) => {
    await toHardware(page)
    await page.getByRole('button', { name: 'Start audio check' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('list')).toContainText('verified', { timeout: 5000 })
    await expect(page.getByRole('button', { name: /Start interview/ })).toBeVisible()
  })
})
