// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.

/**
 * The "While you wait" panel's pieces (the Pez dispenser), one at a time. Every item is a
 * placeholder from the board; the real content is not written. PROPOSAL.
 */
export type PezKind = 'tips' | 'faq' | 'role'

export interface PezPiece {
  title: string
  body: string
}

export interface PezSet {
  heading: string
  next: string
  counter: (index: number, total: number) => string
  pieces: PezPiece[]
}

export const PEZ: Record<PezKind, PezSet> = {
  tips: {
    heading: 'Interview tip',
    next: 'Next tip',
    counter: (i, n) => `Tip ${i} of ${n}`,
    pieces: [
      { title: '[INTERVIEW TIP 1]', body: '' },
      { title: '[INTERVIEW TIP 2]', body: '' },
      { title: '[INTERVIEW TIP 3]', body: '' },
    ],
  },
  faq: {
    heading: 'Question',
    next: 'Next question',
    counter: (i, n) => `${i} of ${n}`,
    pieces: [
      { title: '[FAQ QUESTION 1]', body: '[FAQ ANSWER 1]' },
      { title: '[FAQ QUESTION 2]', body: '[FAQ ANSWER 2]' },
      { title: '[FAQ QUESTION 3]', body: '[FAQ ANSWER 3]' },
    ],
  },
  role: {
    heading: 'Role review',
    next: 'Next point',
    counter: (i, n) => `Point ${i} of ${n}`,
    pieces: [
      { title: '[ROLE TITLE]', body: '[ROLE REVIEW POINT 1]' },
      { title: '[ROLE TITLE]', body: '[ROLE REVIEW POINT 2]' },
      { title: '[ROLE TITLE]', body: '[ROLE REVIEW POINT 3]' },
    ],
  },
}
