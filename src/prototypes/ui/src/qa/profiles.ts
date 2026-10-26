// Authored by Claude Opus 5.5 (Anthropic), with Steven Chock as co-author.
// Content for the QA accommodation canvas. Every key command and menu path here is written from
// memory and marked as a proposal: check it against the vendor's own list (linked) before a formal run.

export type ProfileId = 'blind' | 'deaf' | 'color' | 'low-vision' | 'dyslexia'

export type Profile = { id: ProfileId; name: string; summary: string }

export const profiles: Profile[] = [
  { id: 'blind', name: 'Blind (screen reader)', summary: 'Set up a screen reader, prove it works, then use the interviewer with the screen blacked out.' },
  { id: 'deaf', name: 'Deaf or hard of hearing', summary: 'Set up speech to text captions, prove they pick up the interviewer, then use it without sound.' },
  { id: 'color', name: 'Color vision deficiency', summary: 'Use the interviewer through a color filter: protanopia, deuteranopia, tritanopia or achromatopsia.' },
  { id: 'low-vision', name: 'Low vision', summary: 'Use the interviewer blurred, at low contrast, zoomed and magnified.' },
  { id: 'dyslexia', name: 'Dyslexia', summary: 'Check the interviewer with wider text spacing, plus an optional word-scramble approximation.' },
]

export const profileFromSearch = (search: string): ProfileId | null => {
  const wanted = new URLSearchParams(search).get('profile')
  return profiles.some((p) => p.id === wanted) ? (wanted as ProfileId) : null
}

export type KeyCommand = { keys: string; action: string; unverified?: boolean }

export type ScreenReaderId = 'nvda' | 'jaws' | 'voiceover' | 'narrator' | 'talkback' | 'orca'

export type ScreenReader = {
  id: ScreenReaderId
  name: string
  platform: string
  /** In the top three by WebAIM's Screen Reader User Survey #10 (2024), primary desktop reader. */
  top3: boolean
  browser: string
  docs: string
  setup: string[]
  commands: KeyCommand[]
}

export const screenReaders: ScreenReader[] = [
  {
    id: 'nvda',
    name: 'NVDA',
    platform: 'Windows, free',
    top3: true,
    browser: 'Firefox or Chrome',
    docs: 'https://www.nvaccess.org/files/nvda/documentation/keyCommands.html',
    setup: [
      'Download NVDA from nvaccess.org and run the installer. Choose Install (a portable copy also works).',
      'Keep "Use NVDA during sign-in" off. Turn on "Create desktop shortcut" so Ctrl+Alt+N starts it.',
      'Start NVDA with Ctrl+Alt+N. You hear a start-up sound and "NVDA started".',
      'The NVDA key is Insert. Laptop users can also set Caps Lock as the NVDA key in the welcome dialog.',
      'Open this page in Firefox or Chrome.',
    ],
    commands: [
      { keys: 'Ctrl', action: 'Stop speaking' },
      { keys: 'NVDA+Down arrow', action: 'Read everything from here' },
      { keys: 'H / Shift+H', action: 'Next / previous heading' },
      { keys: 'D / Shift+D', action: 'Next / previous landmark' },
      { keys: 'B', action: 'Next button' },
      { keys: 'F', action: 'Next form field' },
      { keys: 'Tab', action: 'Next focusable control' },
      { keys: 'NVDA+Space', action: 'Switch browse mode and focus mode' },
      { keys: 'NVDA+F7', action: 'Elements list (headings, links, landmarks)' },
      { keys: 'NVDA+Q', action: 'Quit NVDA' },
    ],
  },
  {
    id: 'jaws',
    name: 'JAWS',
    platform: 'Windows, paid (demo mode available)',
    top3: true,
    browser: 'Chrome or Edge',
    docs: 'https://www.freedomscientific.com/training/jaws/hotkeys/',
    setup: [
      'Download JAWS from freedomscientific.com and install it. Without a license it runs in demo mode, which stops after about 40 minutes until Windows restarts (proposal: confirm the current demo limit).',
      'Start JAWS from the Start menu or its desktop shortcut. You hear "JAWS is running".',
      'The JAWS key is Insert. Laptop layout can use Caps Lock.',
      'Open this page in Chrome or Edge.',
    ],
    commands: [
      { keys: 'Ctrl', action: 'Stop speaking' },
      { keys: 'Insert+Down arrow', action: 'Read everything from here' },
      { keys: 'H / Shift+H', action: 'Next / previous heading' },
      { keys: 'R / Shift+R', action: 'Next / previous landmark (region)' },
      { keys: 'B', action: 'Next button' },
      { keys: 'F', action: 'Next form field' },
      { keys: 'Enter on a field', action: 'Start typing in it (forms mode)' },
      { keys: 'Insert+Z', action: 'Turn the virtual cursor off or on' },
      { keys: 'Insert+F6', action: 'Headings list' },
      { keys: 'Insert+F4', action: 'Quit JAWS' },
    ],
  },
  {
    id: 'voiceover',
    name: 'VoiceOver (macOS)',
    platform: 'macOS, built in',
    top3: true,
    browser: 'Safari',
    docs: 'https://support.apple.com/guide/voiceover/welcome/mac',
    setup: [
      'Turn VoiceOver on with Command+F5, or System Settings > Accessibility > VoiceOver.',
      'The first time, macOS offers the VoiceOver welcome. Choose "Use VoiceOver".',
      'The VO keys are Control+Option. You can also set Caps Lock as the VO key in VoiceOver Utility.',
      'Open this page in Safari. VoiceOver works best with Safari.',
    ],
    commands: [
      { keys: 'Control', action: 'Stop speaking' },
      { keys: 'VO+A', action: 'Read everything from here' },
      { keys: 'VO+Right / VO+Left', action: 'Next / previous item' },
      { keys: 'VO+Command+H', action: 'Next heading' },
      { keys: 'VO+Space', action: 'Activate (press) the item' },
      { keys: 'VO+U', action: 'Rotor: lists of headings, landmarks, form controls' },
      { keys: 'VO+Shift+Down / Up', action: 'Go into / out of a group or frame' },
      { keys: 'Tab', action: 'Next focusable control' },
      { keys: 'Command+F5', action: 'Turn VoiceOver off' },
    ],
  },
  {
    id: 'narrator',
    name: 'Narrator',
    platform: 'Windows, built in',
    top3: false,
    browser: 'Edge',
    docs: 'https://support.microsoft.com/windows/complete-guide-to-narrator-e4397a0d-ef4f-b386-d8ae-c172f109bdb1',
    setup: [
      'Turn Narrator on with Ctrl+Windows+Enter, or Settings > Accessibility > Narrator.',
      'The Narrator key is Caps Lock or Insert.',
      'Turn scan mode on with Narrator+Space if it is not on already. Scan mode lets you move with arrow keys and single letters.',
      'Open this page in Edge.',
    ],
    commands: [
      { keys: 'Ctrl', action: 'Stop speaking' },
      { keys: 'Narrator+Space', action: 'Scan mode on or off' },
      { keys: 'H / Shift+H', action: 'Next / previous heading (scan mode)' },
      { keys: 'D / Shift+D', action: 'Next / previous landmark (scan mode)', unverified: true },
      { keys: 'Narrator+M', action: 'Start reading from here', unverified: true },
      { keys: 'Tab', action: 'Next focusable control' },
      { keys: 'Narrator+F1', action: 'List of Narrator commands' },
      { keys: 'Ctrl+Windows+Enter', action: 'Turn Narrator off' },
    ],
  },
  {
    id: 'talkback',
    name: 'TalkBack',
    platform: 'Android, built in',
    top3: false,
    browser: 'Chrome',
    docs: 'https://support.google.com/accessibility/android/answer/6283677',
    setup: [
      'Open Settings > Accessibility > TalkBack and turn it on. Confirm with a double-tap.',
      'Optional: turn on the TalkBack shortcut, so holding both volume keys for 3 seconds turns it on or off.',
      'Open this page in Chrome on the phone or tablet. The cheat sheet lists gestures, not keys.',
    ],
    commands: [
      { keys: 'Swipe right / left', action: 'Next / previous item' },
      { keys: 'Double-tap', action: 'Activate the item' },
      { keys: 'Two-finger swipe', action: 'Scroll' },
      { keys: 'Swipe up or down', action: 'Change what swipes move by (headings, controls, links)', unverified: true },
      { keys: 'Two-finger tap', action: 'Pause or resume speech', unverified: true },
      { keys: 'Hold both volume keys', action: 'Turn TalkBack off (if the shortcut is on)' },
    ],
  },
  {
    id: 'orca',
    name: 'Orca',
    platform: 'Linux (GNOME), built in',
    top3: false,
    browser: 'Firefox',
    docs: 'https://help.gnome.org/orca/commands_reading.html',
    setup: [
      'Turn Orca on with Super+Alt+S, or Settings > Accessibility > Screen Reader.',
      'The Orca key is Insert on the desktop layout, or Caps Lock on the laptop layout (Orca+Space opens preferences).',
      'Open this page in Firefox.',
    ],
    commands: [
      { keys: 'H / Shift+H', action: 'Next / previous heading' },
      { keys: 'M / Shift+M', action: 'Next / previous landmark', unverified: true },
      { keys: 'B', action: 'Next button', unverified: true },
      { keys: 'Tab', action: 'Next focusable control' },
      { keys: 'Orca+A', action: 'Switch browse mode and focus mode', unverified: true },
      { keys: 'Keypad Plus (desktop)', action: 'Read everything from here', unverified: true },
      { keys: 'Orca+Space', action: 'Orca preferences' },
      { keys: 'Super+Alt+S', action: 'Turn Orca off' },
    ],
  },
]

export type CaptionService = { id: string; name: string; steps: string[] }

export const captionServices: CaptionService[] = [
  {
    id: 'windows',
    name: 'Windows 11: Live captions',
    steps: [
      'Press Windows+Ctrl+L, or open Quick Settings > Accessibility > Live captions.',
      'The first time, agree to download the speech files. Captions run on the device.',
      'In the caption window settings, keep "Include microphone audio" off, so it captions the interviewer and not you.',
      'Choose where the caption window sits (floating, top or bottom) so it does not cover the interviewer controls.',
    ],
  },
  {
    id: 'macos',
    name: 'macOS: Live Captions',
    steps: [
      'Open System Settings > Accessibility > Live Captions and turn it on. It needs a Mac with Apple silicon.',
      'Keep it captioning computer audio. Leave the microphone option off.',
      'Drag the caption window away from the interviewer controls.',
    ],
  },
  {
    id: 'chrome',
    name: 'Chrome: Live Caption',
    steps: [
      'Open Chrome Settings > Accessibility and turn on Live Caption (or go to chrome://settings/accessibility).',
      'It captions media playing in Chrome, on Windows, macOS, Linux and ChromeOS.',
      'It may not caption the browser speech used by the test phrase below (proposal: check this).',
    ],
  },
  {
    id: 'android',
    name: 'Android: Live Caption',
    steps: [
      'Press a volume key and tap the caption icon under the volume slider, or open Settings > Accessibility > Live Caption.',
      'Open this page in Chrome on the device.',
    ],
  },
  {
    id: 'ios',
    name: 'iPhone and iPad: Live Captions',
    steps: ['Open Settings > Accessibility > Live Captions and turn it on.', 'Open this page in Safari on the device.'],
  },
  {
    id: 'own',
    name: 'Your own service',
    steps: [
      'Many deaf candidates bring their own speech to text: a captioning app on a second device listening to the speakers, or a human captioner (CART).',
      'Set it up so it hears this computer’s speakers, then run the check below.',
    ],
  },
]
