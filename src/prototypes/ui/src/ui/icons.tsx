// Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.
import type { ReactNode } from 'react'
import type { CueIcon } from '../core/cues/index.ts'

/** Line icons from the mockup. All are decoration: the words beside them carry the meaning (CUE-RED-002). */
function Svg({ size, children, width = 2 }: { size: number; children: ReactNode; width?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const AccessibilityIcon = () => (
  <Svg size={24}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="7" r="1.3" />
    <path d="M7.5 10h9" />
    <path d="M12 10v4" />
    <path d="m9.5 18 2.5-4 2.5 4" />
  </Svg>
)

export const SimulationIcon = () => (
  <Svg size={16}>
    <path d="M2 12h3l3-8 4 16 3-8h7" />
  </Svg>
)

export const SoundIcon = () => (
  <Svg size={16}>
    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </Svg>
)

export const CaptionsIcon = () => (
  <Svg size={20}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M10 10.5a2 2 0 1 0 0 3" />
    <path d="M16.5 10.5a2 2 0 1 0 0 3" />
  </Svg>
)

export const HelpIcon = () => (
  <Svg size={20}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </Svg>
)

export const MicrophoneIcon = () => (
  <Svg size={22} width={1.75}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </Svg>
)

/** The big icon in the status circle. */
export function StateIcon({ icon }: { icon: CueIcon }) {
  switch (icon) {
    case 'ear':
      return (
        <Svg size={64} width={1.75}>
          <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
          <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
        </Svg>
      )
    case 'thought':
      return (
        <Svg size={64} width={1.75}>
          <path d="M17.5 15H9a5.5 5.5 0 1 1 5.2-7.3A4 4 0 1 1 17.5 15Z" />
          <circle cx="8" cy="19" r="1.4" />
          <circle cx="4.5" cy="21.5" r="0.9" />
        </Svg>
      )
    case 'ellipsis':
      // Three dots that pulse. The animation stops under prefers-reduced-motion (index.css).
      return (
        <span className="dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      )
    case 'pause':
      return (
        <Svg size={56} width={1.75}>
          <path d="M9 5v14" />
          <path d="M15 5v14" />
        </Svg>
      )
    case 'neutral':
      return (
        <Svg size={56} width={1.75}>
          <circle cx="12" cy="12" r="6" />
        </Svg>
      )
  }
}
