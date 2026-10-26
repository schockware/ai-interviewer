// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import { useMemo } from 'react'
import type { PrepProgress } from '../core/contract/pageFlow.ts'
import { uploadingOf, type Uploading } from '../core/setup/status.ts'
import { nowText, percentDone, roomState, stepList, stepViews, type RoomState, type StepView } from '../core/setup/waitingRoom.ts'
import type { TrackedUpload } from '../core/setup/resumeUpload.ts'
import { usePreparationIfAny } from './preparation.ts'
import { useResumeUploadsIfAny } from './resumeUploads.ts'

const NO_UPLOADS: readonly TrackedUpload[] = []

export interface PreparationSteps {
  /** null before Prepare interview was asked for. */
  prep: PrepProgress | null
  views: StepView[]
  percent: number
  now: string
  state: RoomState
  /** Whether a resume loaded this session is still being processed, for the uploading banner. */
  uploading: Uploading
}

/** Joins the preparation reports and this session's resume processing into the step list every setup page reads. */
export function usePreparationSteps(): PreparationSteps {
  const preparation = usePreparationIfAny()
  const uploads = useResumeUploadsIfAny()
  const request = preparation?.request ?? null
  const materials = preparation?.materials ?? null
  const report = preparation?.report ?? null
  const all = uploads?.uploads ?? NO_UPLOADS

  return useMemo(() => {
    const hotResumeId = request?.form.interviewType.type === 'hot' ? request.form.interviewType.resumeId : null
    const resumeUpload = hotResumeId === null ? null : (all.find((u) => u.resumeId === hotResumeId) ?? null)
    const views = materials ? stepViews(stepList(materials), { report, resumeUpload }) : []
    const resumeRunning = all.some((u) => !u.error && (u.progress === null || u.progress.status === 'running'))
    return {
      prep: request ? (report?.progress ?? 'preparing') : null,
      views,
      percent: percentDone(views),
      now: nowText(views),
      state: roomState(views),
      uploading: uploadingOf(resumeRunning, false),
    }
  }, [request, materials, report, all])
}
