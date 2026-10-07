// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Guard for docs/decisions/0004: committed env files in this folder hold public, non-secret values only.
// Best effort. It catches the obvious (a name that sounds secret, a key not prefixed VITE_); it cannot
// catch a secret with an innocent name. Claude-written; not a human QA test.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = join(import.meta.dirname, '..', '..')
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.env*'], { cwd: here, encoding: 'utf8' }).split('\0').filter(Boolean)
const SECRETISH = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE/i

describe('committed .env files', () => {
  it('are exactly the two documented ones (committed or committable), so a stray .env cannot slip in', () => {
    expect(tracked.sort()).toEqual(['.env.example', '.env.real'])
  })

  for (const file of ['.env.example', '.env.real']) {
    const assignments = readFileSync(join(here, file), 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l))
      .map((l) => l.split('=')[0])

    it(`${file} only sets VITE_ names that do not sound secret`, () => {
      for (const name of assignments) {
        expect(name, `${name} in ${file}`).toMatch(/^VITE_/)
        expect(name, `${name} in ${file}`).not.toMatch(SECRETISH)
      }
    })
  }
})
