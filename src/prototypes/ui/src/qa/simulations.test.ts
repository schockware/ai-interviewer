// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
// Claude-written prototype tests. Not verified by a person.
import { describe, expect, it } from 'vitest'
import { colorMatrices, cssFilter, feMatrixValues, scrambleWords } from './simulations.ts'

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

describe('scrambleWords', () => {
  it('keeps first and last letters, letter counts and punctuation', () => {
    const text = 'Tell me about a difficult project, please.'
    const out = scrambleWords(text, 1, seeded(7))
    const words = text.split(' ')
    const outWords = out.split(' ')
    expect(outWords).toHaveLength(words.length)
    words.forEach((w, i) => {
      const o = outWords[i]
      expect(o[0]).toBe(w[0])
      expect(o.at(-1)).toBe(w.at(-1))
      expect([...o].sort().join('')).toBe([...w].sort().join(''))
    })
  })

  it('leaves words of three letters or fewer alone', () => {
    expect(scrambleWords('a me the cat', 1, seeded(3))).toBe('a me the cat')
  })

  it('changes nothing when the chance is zero', () => {
    expect(scrambleWords('Describe your strongest technical skill', 0)).toBe('Describe your strongest technical skill')
  })
})

describe('filters', () => {
  it('builds a 20-value color matrix with alpha kept', () => {
    const values = feMatrixValues(colorMatrices.protanopia).split(' ')
    expect(values).toHaveLength(20)
    expect(values.slice(15)).toEqual(['0', '0', '0', '1', '0'])
  })

  it('points the cone filters at their SVG definitions', () => {
    expect(cssFilter('deuteranopia')).toBe('url(#qa-deuteranopia)')
    expect(cssFilter('none')).toBe('none')
  })
})
