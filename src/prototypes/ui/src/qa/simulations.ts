// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
// The visual simulations the QA canvas applies to its test stage. Every one is an approximation.

export type VisionFilter =
  | 'none'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia'
  | 'blur-mild'
  | 'blur-strong'
  | 'low-contrast'

/**
 * Color vision matrices from Machado, Oliveira and Fernandes (2009), severity 1.0, for linear RGB.
 * feColorMatrix filters in linearRGB by default, which is what the matrices expect.
 */
export const colorMatrices: Record<'protanopia' | 'deuteranopia' | 'tritanopia', number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

/** The 4x5 feColorMatrix value for a 3x3 RGB matrix, alpha unchanged. */
export const feMatrixValues = (m: number[][]) => m.map((row) => [...row, 0, 0].join(' ')).join(' ') + ' 0 0 0 1 0'

/** The CSS `filter` value for a simulation. Blur sizes and the contrast level are proposals. */
export const cssFilter = (f: VisionFilter): string => {
  switch (f) {
    case 'none':
      return 'none'
    case 'protanopia':
    case 'deuteranopia':
    case 'tritanopia':
      return `url(#qa-${f})`
    case 'achromatopsia':
      return 'grayscale(1)'
    case 'blur-mild':
      return 'blur(1.5px)'
    case 'blur-strong':
      return 'blur(4px)'
    case 'low-contrast':
      return 'contrast(0.45) brightness(1.15)'
  }
}

/**
 * Black on black: every color, background, border and focus ring goes black, but nothing is hidden,
 * removed or marked aria-hidden, so the accessibility tree is untouched.
 */
export const blackoutCss = (scope: string) => `
${scope}, ${scope} *, ${scope} *::before, ${scope} *::after {
  color: #000 !important;
  background: #000 !important;
  border-color: #000 !important;
  outline-color: #000 !important;
  box-shadow: none !important;
  text-shadow: none !important;
  caret-color: #000 !important;
  fill: #000 !important;
  stroke: #000 !important;
  accent-color: #000 !important;
}
${scope} img, ${scope} video, ${scope} canvas { opacity: 0 !important; }
${scope} ::placeholder { color: #000 !important; }
${scope} ::selection { color: #000 !important; background: #000 !important; }
`

/** WCAG 1.4.12 text spacing, the values the criterion lists. The page must lose no content with them. */
export const textSpacingCss = (scope: string) => `
${scope} * {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
${scope} p { margin-bottom: 2em !important; }
`

/**
 * Shuffles the inside letters of each word longer than three letters, keeping the first and last
 * letters and any punctuation. `chance` is how many words change. `random` is injectable for tests.
 */
export function scrambleWords(text: string, chance = 0.5, random: () => number = Math.random): string {
  return text.replace(/\p{L}+/gu, (word) => {
    if (word.length <= 3 || random() >= chance) return word
    const inside = [...word.slice(1, -1)]
    for (let i = inside.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[inside[i], inside[j]] = [inside[j], inside[i]]
    }
    return word[0] + inside.join('') + word[word.length - 1]
  })
}

/** Puts a style element into a same-origin frame, replacing the one it put there before. */
export function injectFrameStyle(frame: HTMLIFrameElement | null, id: string, css: string) {
  const doc = frame?.contentDocument
  if (!doc?.head) return
  doc.getElementById(id)?.remove()
  if (!css) return
  const style = doc.createElement('style')
  style.id = id
  style.textContent = css
  doc.head.append(style)
}
