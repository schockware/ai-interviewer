// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
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
const toWaitingRoom = async (page: Page) => {
  await toHardware(page)
  await page.getByRole('button', { name: 'Start audio check' }).click()
  await expect(page.getByRole('list')).toContainText('Audio · verified, rated clear', { timeout: 5000 })
  await page.getByRole('button', { name: /Ready for interview/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Waiting room' })).toBeVisible()
}

test.describe('setup, hardware, waiting room and interview as one flow', () => {
  test('goes from Application setup through Hardware setup and the Waiting room to the interview', async ({ page }) => {
    await toWaitingRoom(page)
    // Preparation takes five seconds in the mock host, then the countdown runs.
    await expect(page.getByTestId('status-banner')).toContainText('The host is ready', { timeout: 8000 })
    await expect(page.getByTestId('countdown')).toContainText('Your interview starts in')
    await expect(page.getByRole('heading', { level: 1, name: 'Practice interview' })).toBeVisible({ timeout: 10_000 })
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

  test('Application setup: loading a resume by file selects it, makes the form hot, and the banner says it is uploading', async ({ page }) => {
    await readySetup(page)
    await page.getByRole('radio', { name: /Hot interview/ }).check()
    await page.getByTestId('resume-file').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
    await expect(page.getByText('Processing cv.pdf')).toBeVisible()
    await expect(page.getByTestId('status-banner')).toContainText('Uploading your resume…')
    await expect(page.getByText('cv is loaded and selected.')).toBeVisible({ timeout: 4000 })
    await expect(page.getByRole('combobox', { name: 'Use an existing resume' })).toHaveValue(/res-new/)
    await axe(page)
  })

  test('Application setup: coming back while preparing shows the banner and the progress bar', async ({ page }) => {
    await toHardware(page)
    await page.getByRole('button', { name: 'Back to application setup' }).click()
    await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()
    await expect(page.getByTestId('status-banner')).toContainText('Waiting for host…')
    await expect(page.getByTestId('prep-progress')).toContainText('Preparing your interview')
    await axe(page)
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
    await expect(page.getByRole('heading', { name: 'What the interviewer found' })).toBeVisible({ timeout: 12000 })
    await expect(page.getByTestId('status-banner')).toContainText('The host ran into a problem')
    await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    await axe(page)
  })

  test('Hardware setup: the keyboard reaches the audio check and Ready stays blocked until it passes', async ({ page }) => {
    await toHardware(page)
    await expect(page.getByRole('button', { name: /Ready for interview/ })).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: 'Start audio check' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('list')).toContainText('verified', { timeout: 5000 })
    await expect(page.getByRole('button', { name: /Ready for interview/ })).toHaveAttribute('aria-disabled', 'false')
  })
})

test.describe('waiting room', () => {
  test('shows the steps while preparing, with no axe violations, then counts down; the pause holds it', async ({ page }) => {
    await toWaitingRoom(page)
    await expect(page.getByTestId('now')).not.toHaveText('Your interview is ready')
    await expect(page.getByRole('heading', { name: 'Your materials' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Interview scripts' })).toBeVisible()
    await expect(page.getByTestId('prep-progress')).toContainText('Preparing your interview')
    await axe(page)

    await page.getByRole('switch', { name: 'Pause the countdown' }).click()
    await expect(page.getByTestId('countdown')).toContainText('Countdown paused', { timeout: 8000 })
    await expect(page.getByTestId('status-banner')).toContainText('The countdown is paused')
    await axe(page)
    await page.waitForTimeout(1500)
    await expect(page.getByRole('heading', { level: 1, name: 'Waiting room' })).toBeVisible()

    await page.getByRole('switch', { name: 'Pause the countdown' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Practice interview' })).toBeVisible({ timeout: 10_000 })
  })

  test('offers one piece at a time while you wait, and Leave goes back to hardware setup', async ({ page }) => {
    await toWaitingRoom(page)
    await page.getByRole('button', { name: 'Interview tips' }).click()
    await expect(page.getByTestId('pez')).toContainText('Tip 1 of 3')
    await page.getByRole('button', { name: 'Next tip' }).click()
    await expect(page.getByTestId('pez')).toContainText('Tip 2 of 3')
    await page.getByRole('button', { name: 'Leave the waiting room' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Check your setup' })).toBeVisible()
  })

  test('a loaded resume is read in the waiting room, and one that fails blocks the countdown with a problem banner', async ({ page }) => {
    await readySetup(page)
    await page.getByLabel('Processing a loaded resume').selectOption('fails')
    await page.getByRole('radio', { name: /Hot interview/ }).check()
    await page.getByTestId('resume-file').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
    await expect(page.getByText('cv is loaded and selected.')).toBeVisible({ timeout: 4000 })
    await page.getByRole('combobox', { name: 'Role title' }).selectOption({ label: 'Software Engineer' })
    await page.getByRole('button', { name: /Prepare interview/ }).click()

    // The upload never blocks the Hardware page.
    await expect(page.getByTestId('status-banner')).toContainText('Uploading your resume…')
    await page.getByRole('button', { name: 'Start audio check' }).click()
    await expect(page.getByRole('list')).toContainText('Audio · verified, rated clear', { timeout: 5000 })
    await page.getByRole('button', { name: /Ready for interview/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Waiting room' })).toBeVisible()

    await expect(page.locator('.step', { hasText: 'Reading your resume' })).toContainText('Needs attention', { timeout: 10_000 })
    await expect(page.getByTestId('status-banner')).toContainText('Your resume could not be processed', { timeout: 8000 })
    await expect(page.getByTestId('countdown')).toHaveCount(0)
    await axe(page)
  })
})

test.describe('interview screen', () => {
  test('End interview asks for confirmation, Keep going takes focus, and ending returns to Application setup', async ({ page }) => {
    await page.goto('/?page=interview')
    await expect(page.getByRole('heading', { level: 1, name: 'Practice interview' })).toBeVisible()
    await page.getByRole('button', { name: 'End interview' }).click()
    await expect(page.getByRole('dialog')).toContainText('End the interview now?')
    await expect(page.getByRole('button', { name: 'Keep going' })).toBeFocused()
    await axe(page)
    await page.getByRole('button', { name: 'Keep going' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Practice interview' })).toBeVisible()

    await page.getByRole('button', { name: 'End interview' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'End interview' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Set up your interview' })).toBeVisible()
  })
})

test.describe('test mode', () => {
  test('?mode=test reveals the test drawer with the header it sends, it can be hidden, and it has no axe violations', async ({ page }) => {
    await page.goto('/?mode=test')
    await expect(page.getByRole('heading', { name: 'Interview type' })).toBeVisible()
    const drawer = page.getByTestId('test-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer).toContainText('X-Mock-Uploader-Options: {"minStepDelayMs":3000,"maxStepDelayMs":8000}')
    await page.getByLabel('Pace').selectOption('Instant')
    await expect(drawer).toContainText('{"minStepDelayMs":0,"maxStepDelayMs":0}')
    await axe(page)
    await page.getByRole('button', { name: 'Test settings' }).click()
    await expect(drawer).toBeHidden()
  })

  test('without ?mode=test there is no test drawer and no toggle', async ({ page }) => {
    await readySetup(page)
    await expect(page.getByTestId('test-drawer')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Test settings' })).toHaveCount(0)
  })
})

test.describe('microphone and camera', () => {
  test('Start opens the microphone and streams chunks; Mute holds it; the row has no axe violations', async ({ page }) => {
    await page.goto('/?page=interview')
    await expect(page.getByTestId('mic-state')).toHaveText('Microphone off')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByTestId('mic-state')).toHaveText('Recording audio', { timeout: 5000 })
    await expect(page.getByTestId('mic-detail')).toContainText(/[1-9]\d* chunks sent/, { timeout: 5000 })
    await axe(page)
    await page.getByRole('button', { name: 'Mute' }).click()
    await expect(page.getByTestId('mic-state')).toHaveText('Microphone muted')
    await page.getByRole('button', { name: 'Unmute' }).click()
    await expect(page.getByTestId('mic-state')).toHaveText('Recording audio')
  })

  test('the audio check opens the microphone and lists it; the camera check shows a preview', async ({ page }) => {
    await toHardware(page)
    await page.getByRole('button', { name: 'Start audio check' }).click()
    await expect(page.getByRole('list')).toContainText('verified', { timeout: 5000 })
    await expect(page.getByRole('combobox', { name: 'Microphone' }).locator('option')).not.toHaveCount(1)
    // Video starts skipped, so the button reads Check camera.
    await page.getByRole('button', { name: 'Check camera' }).click()
    await expect(page.getByTestId('camera-preview')).toBeVisible()
    await expect(page.getByRole('list')).toContainText('Video · optional, clear', { timeout: 5000 })
    await axe(page)
  })
})

test.describe('transcript', () => {
  test('after Start, the scripted transcript arrives as partials and finals, then the large model’s reading; the card has no axe violations', async ({ page }) => {
    await page.goto('/?page=interview')
    const live = page.getByTestId('transcript-real-time')
    await expect(live).toContainText('Starts with the interview.')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(live).toContainText('I led the', { timeout: 5000 })
    await expect(live).toContainText('system to the cloud,', { timeout: 8000 })
    await expect(page.getByTestId('transcript-post-question')).toContainText('monthly costs by a third.', { timeout: 12_000 })
    await expect(live).toContainText('realtime:mock on none')
    await axe(page)
  })
})
