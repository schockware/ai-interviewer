#!/usr/bin/env node
// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
// Development Manager Review tool. Protocol: DEV_MANAGER_REVIEW/README.MD. No dependencies.
//
//   node tools/review.mjs status [dir]            what has been reviewed (default: src/prototypes)
//   node tools/review.mjs check                   the gate: every file under src/prod needs an approved review
//   node tools/review.mjs stamp <file> <approved|changes> <note...>
//                                                 record a review. For the reviewer (Steven) only.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROD_DIR = 'src/prod'
export const DEFAULT_STATUS_DIR = 'src/prototypes'
/** Generated or empty by nature, so there is nothing to read. Everything else is reviewed, config and CSS included. */
export const NOT_REVIEWED = [/(^|\/)package-lock\.json$/, /(^|\/)\.gitkeep$/]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER = join(root, 'DEV_MANAGER_REVIEW', 'LEDGER.LOG')
const HEADER = 'DEV MANAGER REVIEW LEDGER (newest first; see DEV_MANAGER_REVIEW/README.MD)'

/** Hash of the content, with line endings normalised, so Windows and Linux checkouts agree. */
export function contentHash(bytes) {
  const text = bytes.includes(0) ? bytes : Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/** Ledger line: `{date time} | {hash} | {approved|changes} | {path} | {reviewer} | {note}`. Newest first. */
export function parseLedger(text) {
  return text
    .split('\n')
    .map((line) => line.split(' | '))
    .filter((p) => p.length >= 6 && /^[0-9a-f]{16}$/.test(p[1]) && (p[2] === 'approved' || p[2] === 'changes'))
    .map(([at, hash, verdict, path, reviewer, ...note]) => ({ at, hash, verdict, path, reviewer, note: note.join(' | ') }))
}

/**
 * A file passes when the newest entry for its exact content is `approved`. The path does not
 * matter, so a file reviewed in the prototype and copied unchanged into prod passes, while any
 * edit at all (an import path included) needs a new review.
 */
export function stateOf(entries, path, hash) {
  const byHash = entries.find((e) => e.hash === hash)
  if (byHash) return byHash.verdict === 'approved' ? 'reviewed' : 'changes-requested'
  return entries.some((e) => e.path === path) ? 'changed-since-review' : 'unreviewed'
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
const tracked = (dir) =>
  git('ls-files', '-z', '--', dir)
    .split('\0')
    .filter((f) => f && existsSync(join(root, f)) && !NOT_REVIEWED.some((re) => re.test(f)))

const readLedger = () => (existsSync(LEDGER) ? parseLedger(readFileSync(LEDGER, 'utf8')) : [])

function inspect(dir) {
  const entries = readLedger()
  return tracked(dir).map((path) => {
    const bytes = readFileSync(join(root, path))
    return { path, lines: bytes.toString('utf8').split('\n').length, state: stateOf(entries, path, contentHash(bytes)) }
  })
}

function status(dir) {
  const rows = inspect(relative(root, resolve(root, dir)).replaceAll('\\', '/') || '.')
  const counts = {}
  for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1
  for (const r of rows) console.log(`${r.state.padEnd(21)} ${String(r.lines).padStart(5)}  ${r.path}`)
  const total = rows.reduce((n, r) => n + r.lines, 0)
  console.log(`\n${rows.length} files, ${total} lines. ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}`)
}

/** Exit code 1 if any prod file lacks an approved review of its current content. */
function check() {
  const bad = inspect(PROD_DIR).filter((r) => r.state !== 'reviewed')
  if (bad.length === 0) {
    console.log(`Review gate: every file under ${PROD_DIR} has an approved review of its current content.`)
    return 0
  }
  console.error(`Review gate FAILED: ${bad.length} file(s) under ${PROD_DIR} lack an approved review of their current content.`)
  for (const r of bad) console.error(`  ${r.state.padEnd(21)} ${r.path}`)
  console.error('A passing test run does not stand in for the review. See DEV_MANAGER_REVIEW/README.MD.')
  return 1
}

function stamp(file, verdict, note) {
  if (process.env.CLAUDECODE) {
    console.error('Refusing: this is the reviewer\'s command. Claude never records a review (DEV_MANAGER_REVIEW/README.MD).')
    return 2
  }
  if (verdict !== 'approved' && verdict !== 'changes') return usage('verdict must be "approved" or "changes"')
  if (!note.trim()) return usage('a note is required: say in your own words what the file does, and name any pattern IDs')
  const abs = resolve(process.cwd(), file)
  if (!existsSync(abs)) return usage(`no such file: ${file}`)
  const path = relative(root, abs).replaceAll('\\', '/')
  const hash = contentHash(readFileSync(abs))
  const reviewer = git('config', 'user.name').trim() || 'unknown'
  const at = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stampTime = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
  const line = `${stampTime} | ${hash} | ${verdict} | ${path} | ${reviewer} | ${note.replace(/\s+/g, ' ').trim()}`
  const lines = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n') : [HEADER, '---']
  writeFileSync(LEDGER, [...lines.slice(0, 2), line, ...lines.slice(2)].join('\n'))
  console.log(line)
  return 0
}

function usage(problem) {
  if (problem) console.error(`${problem}\n`)
  console.error('usage: node tools/review.mjs status [dir] | check | stamp <file> <approved|changes> <note...>')
  return 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2)
  const code =
    cmd === 'status' ? (status(rest[0] ?? DEFAULT_STATUS_DIR), 0)
    : cmd === 'check' ? check()
    : cmd === 'stamp' ? stamp(rest[0] ?? '', rest[1] ?? '', rest.slice(2).join(' '))
    : usage()
  process.exitCode = code
}
