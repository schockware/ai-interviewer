// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Real-integration journeys: the UI in real mode against the API prototype.
// Run with `npm run test:e2e:real` (starts both). Not part of `npm run test:e2e`. See docs/decisions/0004.
import { expect, test } from '@playwright/test'

test.describe('setup pages against the real API', () => {
  test('says plainly that setup is real and hardware is still mock', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('integration-bar')).toContainText('real API for setup')
    await expect(page.getByTestId('integration-bar')).toContainText('hardware checks still mock')
    // The mock server's harness has no meaning against a real server.
    await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()
    await expect(page.getByText('Prototype harness: mock server')).toHaveCount(0)
  })

  test('adds a job description, prepares, checks audio, starts, and reaches the interview', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()

    await page.getByRole('button', { name: 'Paste text' }).click()
    const role = `Real role ${Date.now()}`
    await page.getByLabel('Name for this role').fill(role)
    await page.getByLabel('Job description', { exact: true }).fill('Build and test the interviewer.')
    await page.getByRole('button', { name: 'Add job description' }).click()
    await expect(page.getByText(`${role} is added and selected.`)).toBeVisible()

    await page.getByRole('button', { name: /Prepare interview/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Check your setup' })).toBeVisible()
    await page.getByRole('button', { name: 'Start audio check' }).click()
    await expect(page.getByRole('list')).toContainText('Audio · verified, rated clear', { timeout: 5000 })
    await expect(page.getByText('The host is ready')).toBeVisible()

    await page.getByRole('button', { name: /Start interview/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Practice interview' })).toBeVisible()
  })

  test('shows the API’s own words when it cannot read a resume', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()
    await page.getByRole('radio', { name: /Hot interview/ }).check()
    await page.getByTestId('resume-file').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
    await expect(page.getByRole('alert')).toContainText('"cv.pdf" cannot be read yet')
  })

  test('says the API could not be reached, when it cannot be', async ({ page }) => {
    await page.route('**/api/application-setup', (route) => route.abort())
    await page.goto('/')
    await expect(page.getByRole('alert')).toContainText('Could not reach the API')
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
