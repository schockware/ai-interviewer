// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './qa.css'
import { profileFromSearch, profiles } from './profiles.ts'
import { QaCanvas } from './QaCanvas.tsx'

const profileId = profileFromSearch(window.location.search)
const profile = profiles.find((p) => p.id === profileId)
if (profile) document.title = `${profile.name}: QA accommodation profiles`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QaCanvas profileId={profileId} />
  </StrictMode>,
)
