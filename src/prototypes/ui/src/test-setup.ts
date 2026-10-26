import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom does not implement <dialog>'s showModal/close. The stand-in toggles the open attribute and
// fires close, which is all the components rely on. Focus trapping is not simulated.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal)
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  if (!HTMLDialogElement.prototype.close)
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
}
