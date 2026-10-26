// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { createContext, useContext } from 'react'
import type { DisplayName, ResumeId } from '../core/contract/pageFlow.ts'
import type { TrackedUpload } from '../core/setup/resumeUpload.ts'

/** The resume uploads context: what every page can see about resumes loaded this session. */
export interface ResumeUploads {
  /** Newest first. */
  uploads: readonly TrackedUpload[]
  /** Starts following a resume the host just processed. Following the same resume twice does nothing. */
  track: (resumeId: ResumeId, displayName: DisplayName) => void
}

export const ResumeUploadsContext = createContext<ResumeUploads | null>(null)

export function useResumeUploads(): ResumeUploads {
  const value = useContext(ResumeUploadsContext)
  if (!value) throw new Error('useResumeUploads needs a ResumeUploadProvider above it.')
  return value
}

/** For a component that may render without the provider (a page on its own): then nothing is tracked. */
export function useResumeUploadsIfAny(): ResumeUploads | null {
  return useContext(ResumeUploadsContext)
}
