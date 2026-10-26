// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
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

  test('adds a job description, prepares, checks audio, waits, and reaches the interview after the countdown', async ({ page }) => {
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
    // The real API prepares at once, so the banner is ready before the audio check finishes.
    await expect(page.getByTestId('status-banner')).toContainText('The host is ready')

    await page.getByRole('button', { name: /Ready for interview/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Waiting room' })).toBeVisible()
    await expect(page.getByTestId('countdown')).toContainText('Your interview starts in')
    await expect(page.getByRole('heading', { level: 1, name: 'Practice interview' })).toBeVisible({ timeout: 10_000 })
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

test.describe('resume processing against the real API', () => {
  test('in test mode, the drawer makes the uploader instant and the waiting room shows the resume read', async ({ page }) => {
    await page.goto('/?mode=test')
    await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()
    // The header rides on the upload request; the API applies it to that resume's processing.
    await page.getByLabel('Pace').selectOption('Instant')
    // The drawer lies over the right column, where the waiting room's pause switch sits; close it once the header is set.
    await page.getByRole('button', { name: 'Test settings' }).click()
    await page.getByRole('radio', { name: /Hot interview/ }).check()
    await page.getByTestId('resume-file').setInputFiles({ name: 'cv.txt', mimeType: 'text/plain', buffer: Buffer.from('Ten years of building things.') })
    await expect(page.getByText('cv is loaded and selected.')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Paste text' }).click()
    await page.getByLabel('Name for this role').fill(`Real role ${Date.now()}`)
    await page.getByLabel('Job description', { exact: true }).fill('Build and test the interviewer.')
    await page.getByRole('button', { name: 'Add job description' }).click()
    await page.getByRole('button', { name: /Prepare interview/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Check your setup' })).toBeVisible()

    await page.getByRole('button', { name: 'Start audio check' }).click()
    await expect(page.getByRole('list')).toContainText('Audio · verified, rated clear', { timeout: 5000 })
    // Pause the countdown first, so the room stays open long enough to read the steps.
    await page.getByRole('button', { name: /Ready for interview/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Waiting room' })).toBeVisible()
    await page.getByRole('switch', { name: 'Pause the countdown' }).click()
    await expect(page.getByText(/Everything is ready · \d+ of \d+ steps done/)).toBeVisible({ timeout: 10_000 })
    await page.getByText(/Everything is ready/).click()
    await expect(page.locator('details li', { hasText: 'Reading your resume' })).toContainText('Done')
  })
})

test.describe('media streams against the real API', () => {
  test('the interview streams the microphone to the API over a WebSocket, through the dev proxy', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('integration-bar')).toContainText('media streams')
    await page.goto('/?page=interview')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByTestId('mic-state')).toHaveText('Recording audio', { timeout: 5000 })
    await expect(page.getByTestId('mic-detail')).toContainText(/[1-9]\d* chunks sent/, { timeout: 5000 })
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('mic-state')).not.toHaveText('Stream interrupted')
    await page.getByRole('button', { name: 'End interview' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'End interview' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Set up your interview' })).toBeVisible()
  })
})
