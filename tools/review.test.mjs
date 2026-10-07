// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Claude-written tests for the review tool (not prod-zone code). Run: node --test tools/review.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contentHash, NOT_REVIEWED, parseLedger, stateOf } from './review.mjs'

const line = (hash, verdict, path) => `2026-10-07 09:00:00 | ${hash} | ${verdict} | ${path} | Steven | my note | with a bar`
const A = 'a'.repeat(16)
const B = 'b'.repeat(16)

test('line endings do not change the hash, content does', () => {
  assert.equal(contentHash(Buffer.from('a\r\nb\r\n')), contentHash(Buffer.from('a\nb\n')))
  assert.notEqual(contentHash(Buffer.from('a\nb\n')), contentHash(Buffer.from('a\nc\n')))
})

test('parses ledger lines, keeps a note that contains the separator, ignores headers', () => {
  const entries = parseLedger(`HEADER\n---\n${line(A, 'approved', 'x.ts')}\nnot a line`)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].note, 'my note | with a bar')
})

test('unreviewed, reviewed, changed since review, and changes requested', () => {
  const entries = parseLedger([line(B, 'changes', 'x.ts'), line(A, 'approved', 'x.ts')].join('\n'))
  assert.equal(stateOf([], 'x.ts', A), 'unreviewed')
  assert.equal(stateOf(entries, 'x.ts', A), 'reviewed')
  assert.equal(stateOf(entries, 'x.ts', B), 'changes-requested')
  assert.equal(stateOf(entries, 'x.ts', 'c'.repeat(16)), 'changed-since-review')
})

test('the newest entry for the same content decides', () => {
  const entries = parseLedger([line(A, 'changes', 'x.ts'), line(A, 'approved', 'x.ts')].join('\n'))
  assert.equal(stateOf(entries, 'x.ts', A), 'changes-requested')
})

test('identical content passes at another path, so a reviewed prototype file can be promoted unchanged', () => {
  const entries = parseLedger(line(A, 'approved', 'src/prototypes/ui/a.ts'))
  assert.equal(stateOf(entries, 'src/prod/ui/a.ts', A), 'reviewed')
})

test('lockfiles and .gitkeep are not reviewed; source is', () => {
  const skipped = (f) => NOT_REVIEWED.some((re) => re.test(f))
  assert.ok(skipped('src/prod/ui/package-lock.json'))
  assert.ok(skipped('src/prod/ui/e2e/.gitkeep'))
  assert.ok(!skipped('src/prod/ui/package.json'))
  assert.ok(!skipped('src/prod/ui/src/index.css'))
})
