// Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import type { Tone } from '../core/setup/hardware.ts'
import { STEP_LABEL, STEP_TONE, uploadView, type TrackedUpload } from '../core/setup/resumeUpload.ts'
import { useResumeUploadsIfAny } from './resumeUploads.ts'

const MARK: Record<Tone, string> = { ok: '✓', warn: '!', bad: '✕', neutral: '–' }

/**
 * Not in the Hardware mockup: shows the processing of every resume loaded this session, step by
 * step, as the server reports it (PROPOSAL; the contract has no shape for this). Renders nothing
 * until a resume has been loaded.
 */
export function ResumeUploadCard() {
  const uploads = useResumeUploadsIfAny()
  if (!uploads || uploads.uploads.length === 0) return null
  return (
    <section aria-labelledby="uploads-title" className="card" data-testid="resume-uploads">
      <h2 id="uploads-title">Resume processing</h2>
      <p className="muted">The interviewer is reading what you loaded. You can keep going; this finishes on its own.</p>
      {uploads.uploads.map((upload) => (
        <UploadRow key={upload.resumeId} upload={upload} />
      ))}
    </section>
  )
}

function UploadRow({ upload }: { upload: TrackedUpload }) {
  const view = uploadView(upload)
  return (
    <div className="stack" data-testid={`resume-upload-${upload.resumeId}`}>
      <div className="row row-between">
        <h3>{upload.displayName}</h3>
        <span className={`chip chip-${view.tone}`}>
          <span aria-hidden="true">{MARK[view.tone]}</span>
          {view.chip}
        </span>
      </div>
      <p role="status">{view.summary}</p>
      {upload.progress && (
        <ol className="checklist" aria-label={`Steps for ${upload.displayName}`}>
          {upload.progress.steps.map((step) => (
            <li key={step.name}>
              <span aria-hidden="true" className={`mark mark-${STEP_TONE[step.status]}`}>
                {MARK[STEP_TONE[step.status]]}
              </span>
              <span>
                {step.name} · {STEP_LABEL[step.status]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
