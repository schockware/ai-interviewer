// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.

/**
 * Reads basic questions out of a pasted or uploaded document, the way the API prototype does
 * (its Business/Setup/Questions.cs): one question per line, blank lines and markdown headings
 * skipped, list markers dropped; or JSON as an array of strings, `{ questions: [...] }`, or one
 * role from the sample bank (`{ core: [{ text }] }`). The mock host uses this to stand in for the
 * server; the page never parses files itself. Returns the reason when nothing usable is found.
 */
export type ParsedQuestions = { type: 'ok'; questions: string[] } | { type: 'failed'; message: string }

const LIST_MARKER = /^(?:[-*•]|\d+[.)])\s+/

export function parseQuestions(text: string): ParsedQuestions {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { type: 'failed', message: 'The questions document is empty.' }
  const parsed = trimmed.startsWith('[') || trimmed.startsWith('{') ? parseJson(trimmed) : { type: 'ok' as const, questions: parseLines(trimmed) }
  if (parsed.type === 'ok' && parsed.questions.length === 0) return { type: 'failed', message: 'No questions were found. Put one question per line.' }
  return parsed
}

function parseLines(text: string): string[] {
  const questions: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const question = line.replace(LIST_MARKER, '').trim()
    if (question.length > 0) questions.push(question)
  }
  return questions
}

function parseJson(json: string): ParsedQuestions {
  let root: unknown
  try {
    root = JSON.parse(json)
  } catch (e) {
    return { type: 'failed', message: `The questions document is not valid JSON: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (Array.isArray(root)) return texts(root)
  if (typeof root !== 'object' || root === null) return { type: 'failed', message: 'A JSON questions document is an array, or an object with "questions" or "core".' }
  const record = root as Record<string, unknown>
  if ('roles' in record) return { type: 'failed', message: 'This file holds a whole question bank. Upload one role\'s questions: its "core" list.' }
  if ('questions' in record) return texts(record.questions)
  if ('core' in record) return texts(record.core)
  return { type: 'failed', message: 'A JSON questions document needs a "questions" or "core" array.' }
}

function texts(array: unknown): ParsedQuestions {
  if (!Array.isArray(array)) return { type: 'failed', message: 'The questions must be an array.' }
  const questions: string[] = []
  for (const item of array) {
    const text = typeof item === 'string' ? item : typeof item === 'object' && item !== null && typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : null
    if (text === null) return { type: 'failed', message: 'Each question must be a string, or an object with "text".' }
    if (text.trim().length > 0) questions.push(text.trim())
  }
  return { type: 'ok', questions }
}
