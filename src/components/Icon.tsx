import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'overview'
  | 'tutorials'
  | 'algorithms'
  | 'ai'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'step-back'
  | 'play'
  | 'pause'
  | 'step-forward'
  | 'save'
  | 'save-copy'
  | 'star'
  | 'star-filled'
  | 'message'
  | 'wand'
  | 'chevron-down'
  | 'check'
  | 'code'
  | 'eye'

export type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
  /** Rendered size in px; also sets stroke optical weight. Default 20. */
  size?: number
}

/**
 * Shared icon geometry — 24×24 grid, stroke 1.6, round caps.
 * Size only via the `size` prop / CSS width+height so scaling stays even.
 */
const PATHS: Record<IconName, ReactNode> = {
  overview: (
    <>
      <circle cx="12" cy="12" r="3.25" />
      <circle cx="12" cy="12" r="8" opacity="0.45" />
    </>
  ),
  tutorials: (
    <>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H11v16H6.5A1.5 1.5 0 0 1 5 18.5v-13Z" />
      <path d="M19 5.5A1.5 1.5 0 0 0 17.5 4H13v16h4.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" opacity="0.55" />
    </>
  ),
  algorithms: (
    <>
      <rect x="3.5" y="14" width="4.5" height="6.5" rx="1.25" />
      <rect x="9.75" y="9" width="4.5" height="11.5" rx="1.25" />
      <rect x="16" y="4.5" width="4.5" height="16" rx="1.25" />
    </>
  ),
  ai: (
    <path
      d="M12 3.5 13.7 8.3 18.5 10 13.7 11.7 12 16.5 10.3 11.7 5.5 10 10.3 8.3 12 3.5Z"
      strokeLinejoin="round"
    />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.75v2M12 18.25v2M3.75 12h2M18.25 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.75" />
      <path d="M12 2.75v2.1M12 19.15v2.1M4.57 4.57l1.48 1.48M17.95 17.95l1.48 1.48M2.75 12h2.1M19.15 12h2.1M4.57 19.43l1.48-1.48M17.95 6.05l1.48-1.48" />
    </>
  ),
  moon: <path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5 7.2 7.2 0 1 0 20.5 14.2Z" strokeLinejoin="round" />,
  'step-back': (
    <>
      <path d="M6.5 5.5v13" strokeLinecap="round" />
      <path d="M18 6.8v10.4a.8.8 0 0 1-1.25.65L9.5 12.65a.8.8 0 0 1 0-1.3l7.25-5.2A.8.8 0 0 1 18 6.8Z" strokeLinejoin="round" />
    </>
  ),
  play: (
    <path
      d="M8.5 6.2v11.6a.75.75 0 0 0 1.15.63l9.2-5.8a.75.75 0 0 0 0-1.26l-9.2-5.8a.75.75 0 0 0-1.15.63Z"
      strokeLinejoin="round"
    />
  ),
  pause: (
    <>
      <rect x="7" y="5.5" width="3.5" height="13" rx="1.2" />
      <rect x="13.5" y="5.5" width="3.5" height="13" rx="1.2" />
    </>
  ),
  'step-forward': (
    <>
      <path d="M17.5 5.5v13" strokeLinecap="round" />
      <path d="M6 6.8v10.4a.8.8 0 0 0 1.25.65l7.25-5.2a.8.8 0 0 0 0-1.3L7.25 6.15A.8.8 0 0 0 6 6.8Z" strokeLinejoin="round" />
    </>
  ),
  save: (
    <>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h9.1L20 8.4v10.1A1.5 1.5 0 0 1 18.5 20h-12A1.5 1.5 0 0 1 5 18.5v-13Z" strokeLinejoin="round" />
      <path d="M8 4v5h7V4.5M8.5 20v-5.5h7V20" />
    </>
  ),
  'save-copy': (
    <>
      <rect x="8" y="4.5" width="11.5" height="13" rx="1.5" />
      <path d="M5.5 8.5v10A1.5 1.5 0 0 0 7 20h8.5" />
      <path d="M11.5 8.5h5M11.5 12h5M11.5 15.5h3" />
    </>
  ),
  star: (
    <path d="m12 4.2 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 16.2l-4.7 2.45.9-5.23-3.8-3.7 5.25-.76L12 4.2Z" strokeLinejoin="round" />
  ),
  'star-filled': (
    <path
      d="m12 4.2 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 16.2l-4.7 2.45.9-5.23-3.8-3.7 5.25-.76L12 4.2Z"
      fill="currentColor"
      strokeLinejoin="round"
    />
  ),
  message: (
    <path
      d="M5.5 6.5A1.5 1.5 0 0 1 7 5h10a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 17 16H10l-3.5 3v-3H7a1.5 1.5 0 0 1-1.5-1.5v-8Z"
      strokeLinejoin="round"
    />
  ),
  wand: (
    <>
      <path d="M4.5 19.5 14 10" strokeLinecap="round" />
      <path d="M15.5 4.5 16.2 6.3 18 7l-1.8.7L15.5 9.5l-.7-1.8L13 7l1.8-.7.7-1.8ZM19.5 11.5l.45 1.05L21 13l-1.05.45L19.5 14.5l-.45-1.05L18 13l1.05-.45.45-1.05ZM8 4.5l.5 1.2L9.7 6.2 8.5 6.7 8 7.9l-.5-1.2L6.3 6.2l1.2-.5L8 4.5Z" />
    </>
  ),
  'chevron-down': <path d="M6.5 9.5 12 15l5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="m5.5 12.5 4 4 9-9" strokeLinecap="round" strokeLinejoin="round" />,
  code: (
    <>
      <path d="M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4M13 5.5 11 18.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  eye: (
    <>
      <path d="M2.75 12s3.5-6.25 9.25-6.25S21.25 12 21.25 12 17.75 18.25 12 18.25 2.75 12 2.75 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" />
    </>
  ),
}

export function Icon({ name, size = 20, className = '', ...rest }: IconProps) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

/** Vector brand mark — same motif as the app icon; scales without raster blur. */
export function WorktableMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`worktable-mark${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="14" fill="#0b1220" />
      <rect x="12" y="14" width="40" height="1.75" rx="0.85" fill="#3b82f6" opacity="0.35" />
      <rect x="14" y="34" width="7.5" height="16" rx="1.6" fill="#60a5fa" />
      <rect x="24.5" y="26" width="7.5" height="24" rx="1.6" fill="#34d399" />
      <rect x="35" y="40" width="7.5" height="10" rx="1.6" fill="#60a5fa" />
      <rect x="45.5" y="30" width="7.5" height="20" rx="1.6" fill="#60a5fa" />
      <rect x="33.25" y="22" width="1.5" height="20" rx="0.75" fill="#34d399" />
      <rect x="12" y="50" width="44" height="1.75" rx="0.85" fill="#60a5fa" opacity="0.7" />
    </svg>
  )
}
