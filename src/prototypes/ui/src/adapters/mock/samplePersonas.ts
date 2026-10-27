// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
// The sample personas (mocked-samples/ai-interviewer-test-personas/output), read straight from the
// repo so the mock host offers the same roles, descriptions and questions the API loads (its
// Adapters/Samples). Data only: the markdown and the bank are parsed, never run. Vite serves the
// folder in development through server.fs.allow (vite.config.ts) and bundles it in a build.
/// <reference types="vite/client" />
import bank from '../../../../../../mocked-samples/ai-interviewer-test-personas/output/questions/question_bank.json' with { type: 'json' }

const descriptions = import.meta.glob('../../../../../../mocked-samples/ai-interviewer-test-personas/output/job_descriptions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface SamplePersona {
  /** The bank's persona id, such as "TEC-02". */
  id: string
  /** The role title, which is the role's display name. */
  role: string
  /** The job description markdown, which is the role's description. */
  description: string
  /** The bank's core questions, in order. */
  questions: readonly string[]
}

interface Bank {
  roles: Array<{ persona_id: string; role: string; core: Array<{ text: string }> }>
}

/** Every persona with a job description, in the bank's order. */
export const SAMPLE_PERSONAS: readonly SamplePersona[] = (bank as unknown as Bank).roles.flatMap((role) => {
  const path = Object.keys(descriptions).find((p) => p.includes(`/job_descriptions/${role.persona_id}-`))
  if (!path) return []
  return [{ id: role.persona_id, role: role.role, description: descriptions[path].trim(), questions: role.core.map((q) => q.text) }]
})
