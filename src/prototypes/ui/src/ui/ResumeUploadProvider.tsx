// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DisplayName, ResumeId } from '../core/contract/pageFlow.ts'
import type { SetupHost } from '../core/ports.ts'
import type { TrackedUpload } from '../core/setup/resumeUpload.ts'
import { ResumeUploadsContext } from './resumeUploads.ts'

/**
 * Resume processing outlives the Application setup page: the user loads a resume, moves on to
 * Hardware setup, and the server keeps reporting. So the watching lives above the pages, here,
 * and every page can show it through `useResumeUploads`. Watching stops when this unmounts.
 */
export function ResumeUploadProvider({ host, children }: { host: SetupHost; children: ReactNode }) {
  const [uploads, setUploads] = useState<readonly TrackedUpload[]>([])
  const stops = useRef(new Map<ResumeId, () => void>())

  const track = useCallback(
    (resumeId: ResumeId, displayName: DisplayName) => {
      if (stops.current.has(resumeId)) return
      setUploads((all) => [{ resumeId, displayName, progress: null, error: null }, ...all])
      const patch = (change: Partial<TrackedUpload>) => setUploads((all) => all.map((u) => (u.resumeId === resumeId ? { ...u, ...change } : u)))
      stops.current.set(
        resumeId,
        host.watchResumeUpload(
          resumeId,
          (progress) => patch({ progress, error: null }),
          (error) => patch({ error }),
        ),
      )
    },
    [host],
  )

  useEffect(() => {
    const watching = stops.current
    return () => {
      watching.forEach((stop) => stop())
      watching.clear()
    }
  }, [])

  const value = useMemo(() => ({ uploads, track }), [uploads, track])
  return <ResumeUploadsContext.Provider value={value}>{children}</ResumeUploadsContext.Provider>
}
