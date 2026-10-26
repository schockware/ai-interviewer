// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// Component behavior of the test drawer. Claude-written; not a human QA test.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TEST_SETTINGS } from '../composition/testMode.ts'
import { TestDrawer } from './TestDrawer.tsx'

describe('TestDrawer', () => {
  it('shows the header it sends, and a preset changes it', async () => {
    const onChange = vi.fn()
    render(<TestDrawer settings={DEFAULT_TEST_SETTINGS} onChange={onChange} real />)
    expect(screen.getByTestId('test-drawer')).toHaveTextContent('X-Mock-Uploader-Options: {"minStepDelayMs":3000,"maxStepDelayMs":8000}')
    expect(screen.getByLabelText('Pace')).toHaveValue('Design pace')

    await userEvent.selectOptions(screen.getByLabelText('Pace'), 'Instant')

    expect(onChange).toHaveBeenCalledWith({ mockUploader: { minStepDelayMs: 0, maxStepDelayMs: 0 } })
  })

  it('shows Custom when the numbers match no preset, and passes a typed number up', () => {
    const onChange = vi.fn()
    render(<TestDrawer settings={{ mockUploader: { minStepDelayMs: 100, maxStepDelayMs: 250 } }} onChange={onChange} real />)
    expect(screen.getByLabelText('Pace')).toHaveValue('Custom')

    fireEvent.change(screen.getByLabelText('Max pause per step (ms)'), { target: { value: '500' } })

    expect(onChange).toHaveBeenCalledWith({ mockUploader: { minStepDelayMs: 100, maxStepDelayMs: 500 } })
  })

  it('keeps the old number when the typed value is not a number', () => {
    const onChange = vi.fn()
    render(<TestDrawer settings={DEFAULT_TEST_SETTINGS} onChange={onChange} real />)

    fireEvent.change(screen.getByLabelText('Min pause per step (ms)'), { target: { value: '-5' } })

    expect(onChange).toHaveBeenCalledWith(DEFAULT_TEST_SETTINGS)
  })

  it('can be hidden and shown again with the toggle', async () => {
    render(<TestDrawer settings={DEFAULT_TEST_SETTINGS} onChange={() => undefined} real />)
    const toggle = screen.getByRole('button', { name: 'Test settings' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(toggle)
    expect(screen.getByTestId('test-drawer')).not.toBeVisible()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(toggle)
    expect(screen.getByTestId('test-drawer')).toBeVisible()
  })

  it('says when the headers reach no server because the host is the mock', () => {
    render(<TestDrawer settings={DEFAULT_TEST_SETTINGS} onChange={() => undefined} real={false} />)
    expect(screen.getByTestId('test-drawer')).toHaveTextContent('reach no server')
  })
})
