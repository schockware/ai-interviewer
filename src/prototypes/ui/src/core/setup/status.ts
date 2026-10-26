// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { PrepProgress } from '../contract/pageFlow.ts'

// The two shared components of specs/page-flow.md, "Status banner and preparation progress":
// design/mockups/ui/StatusBanner.dc.html and PrepProgress.dc.html. Words and rules only; no markup.

/** What the uploading banner names. */
export type Uploading = 'none' | 'resume' | 'role' | 'both'

export const uploadingOf = (resume: boolean, role: boolean): Uploading => (resume && role ? 'both' : resume ? 'resume' : role ? 'role' : 'none')

export type BannerKind = 'uploading' | 'waiting' | 'retrying' | 'problem' | 'ready' | 'hidden'
export type BannerTone = 'warn' | 'bad' | 'ok'
export type BannerIcon = 'wait' | 'problem' | 'ready'

export interface BannerView {
  kind: Exclude<BannerKind, 'hidden'>
  title: string
  body: string
  tone: BannerTone
  icon: BannerIcon
}

/** One banner at a time. If several apply, the most urgent wins: problem, then uploading, then waiting or retrying, then ready. */
export function bannerKind(uploading: Uploading, prep: PrepProgress | null): BannerKind {
  if (prep === 'diagnosing') return 'problem'
  if (uploading !== 'none') return 'uploading'
  if (prep === 'preparing') return 'waiting'
  if (prep === 'retrying') return 'retrying'
  if (prep === 'ready') return 'ready'
  return 'hidden'
}

const SUBJECT: Record<Exclude<Uploading, 'none'>, string> = { resume: 'your resume', role: 'your role', both: 'your resume and role' }

/** The banner's words. `body` replaces the default second line, as the Waiting room does. */
export function bannerView(kind: BannerKind, what: Uploading = 'both', body?: string): BannerView | null {
  if (kind === 'hidden') return null
  const subject = SUBJECT[what === 'none' ? 'both' : what]
  const table: Record<Exclude<BannerKind, 'hidden'>, Omit<BannerView, 'kind'>> = {
    uploading: { title: `Uploading ${subject}…`, body: 'This can take a moment. You can keep going while it finishes.', tone: 'warn', icon: 'wait' },
    waiting: { title: 'Waiting for host…', body: 'The interviewer is building your interview. You can keep going while you wait.', tone: 'warn', icon: 'wait' },
    retrying: { title: 'Waiting for host…', body: 'This is taking a little longer than usual. We are retrying quietly, and you can keep going.', tone: 'warn', icon: 'wait' },
    problem: { title: 'The host ran into a problem', body: 'We tried again and it did not work. The interviewer is checking what went wrong.', tone: 'bad', icon: 'problem' },
    ready: { title: 'The host is ready', body: 'Your interview is prepared.', tone: 'ok', icon: 'ready' },
  }
  const t = table[kind]
  return { kind, title: t.title, body: body ?? t.body, tone: t.tone, icon: t.icon }
}

export interface ProgressView {
  label: string
  note: string
  /** null is indeterminate: no value is claimed while the problem is diagnosed. */
  now: number | null
  tone: 'preparing' | 'retrying' | 'ready'
}

/** The shared "Preparing your interview" bar. `note` replaces the default right-hand text. */
export function progressView(prep: PrepProgress, percent: number, note?: string): ProgressView {
  const pct = prep === 'ready' ? 100 : Math.max(0, Math.min(100, Math.round(percent)))
  switch (prep) {
    case 'preparing':
      return { label: 'Preparing your interview', note: note ?? `${pct}%`, now: pct, tone: 'preparing' }
    case 'retrying':
      return { label: 'Preparing your interview', note: note ?? 'Taking longer than usual. Retrying', now: pct, tone: 'retrying' }
    case 'diagnosing':
      return { label: 'Preparing your interview', note: note ?? 'Checking what went wrong', now: null, tone: 'retrying' }
    case 'ready':
      return { label: 'Your interview is ready', note: note ?? '', now: 100, tone: 'ready' }
  }
}
