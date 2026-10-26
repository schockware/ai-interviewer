*Authored by Steven Chock, with Claude Sonnet 5.5 (Anthropic) as co-author.*

# Basic Flow

Accessibility is always visible and is the first button focused, in case someone with an accessibility device is reading the page.

## Status banner and preparation progress (shared)

Two shared components, so every page looks and behaves the same.

- **Status banner.** A slot under the header on every page. It is empty and takes no space when there is nothing to say. One banner at a time; if several apply, the most urgent wins: problem, then uploading, then waiting or retrying, then ready.
  - **Uploading:** says only what is being uploaded: "Uploading your resume…", "Uploading your role…" or "Uploading your resume and role…". The step-by-step detail lives in the waiting room.
  - **Waiting for host…:** the pacifier banner, while the AI prepares the interview. A slower version says it is taking longer and is retrying quietly.
  - **The host ran into a problem:** nothing interrupts the user. The AI models diagnose it.
  - **The host is ready.**
  - It is a status message (polite). It is announced when it appears or changes, never moves focus, and has a text label as well as an icon and colour.
- **Preparing your interview** progress bar. At the bottom of every setup page (Application setup, Hardware setup and the waiting room), once preparation has started. It slows if preparation is retrying, and shows no percentage while the problem is diagnosed. It has a name and a fixed text value, and its movement is not announced.

## 1. Application setup

*Required settings to generate an interview experience, with standard AI disclaimers.*

- **Application Settings**
  - Lets the user switch available AI models and set up access to cloud models.
- **Interview type toggle: Cold or Hot**
  - **Cold interview** (*default*)
    - *The AI ignores any loaded resumes and goes off boilerplate questions. Many AI pre-screens are Cold interviews only.*
  - **Hot interview**
    - Prevents the form from saving until a resume is selected.
      - Make sure that if the form bypasses the resume validation, it describes that it will fall back to a cold interview.
    - Select Existing Resume
      - *Do not show if no resumes available.*
      - Sorted by processed time.
      - Defaults to the last picked resume if it still exists.
      - Falls back to the most recent resume.
    - Load Resume
      - *Required*
      - The user can load and select a resume that the interviewer will go off of, for a few questions or for interview flavor.
      - Selects the resume once it is processed.
- **Role Focus**
  - *Required*
  - The user can select industry-standard titles.
  - The user may upload a job description.
- **Prepare Interview button**
  - The AI needs time to build out an interview based on the Role and Resume (if provided).
  - *Disabled while anything is missing or still processing, with a list that says what is missing.*
  - It takes the user to the Hardware setup and verification screen right away, with a progress bar at the bottom of the screen.
  - If the user comes back to this page while the interview is preparing, the status banner and the progress bar show here too.
  - While a resume or role is uploading, the status banner says so, and Prepare interview stays disabled.

## 2. Hardware setup and verification

*This is what a user would normally experience during interview prep.*

- Hardware check (audio, optional video).
- Advanced training options in the bottom right.
  - Lets the user turn on training modules, turn on captions by default, turn on simulated network latency and packet loss, etc.
- To add some immersion, display a "Waiting for host..." message with a pacifier icon while the AI prepares the interview. The progress bar stays visible.
  - This is the shared status banner. It also says when a resume or role is still uploading.
- **Ready for interview**
  - *Disabled until the required hardware settings are verified and rated clear, intermittent or readable.*
  - It no longer waits for the interview to be prepared. The waiting room (next) covers that.

## 3. Waiting room

*An interstitial between Hardware setup and the Interview. It mimics "Waiting for host...", with the same banner and progress bar as the earlier pages.*

- Shows each step of the preparation, so the user can see their resume and role being uploaded and processed:
  - **Your materials:** uploading and reading the resume (hot interviews only), uploading and reading the job description (if any) or looking up the role, and preparing the role review.
  - **Interview scripts, written by the AI:** planning the questions, writing the opening, preparing the follow-up questions, preparing the scoring guide, and writing the closing.
  - **Voice and connection:** warming up the interviewer's voice and connecting to the interview room.
  - *The exact step list is a proposal. The server would need to send progress for each step.*
- If preparation fails, nothing interrupts the user. The progress bar slows and the system retries quietly. If it still fails, the AI models diagnose the problem, and the user can try again or change the application setup.
- **When everything is ready**
  - The steps gently collapse into a one-line summary, still open to read.
  - A countdown then starts the interview. *The length of the countdown is a placeholder.*
  - Each tick is not announced. The start of the countdown, a pause and a resume are.
- **Training options**
  - Lets the user pause the countdown. This is an anxiety accommodation, and it also covers being interrupted during a test interview.
  - If it is on before the interview is ready, the countdown starts paused. The interview starts only when it is turned off.
- **While you wait** (the "Pez dispenser")
  - Optional, and one piece at a time. Offers interview tips, a battery of frequently asked questions, or a review of the role.
  - It is a proactive pacifier for anxious users, so it never pressures the user or interrupts them.
- **When you join**
  - Tells the user the interview starts with the opening, and that the interviewer is not listening during it.
- A "Leave the waiting room" link goes back to Hardware setup.

## 4. Interview

- A status section describing different visual and audio cues:
  - AI Listening (Your turn)
    - User is speaking
    - Server has been interrupted by the user speaking
  - AI Thinking
    - Interviewer is thinking or finished thinking
    - Speech has ended on the Client, until the server answers that it is listening
    - Session is pausing
    - Session is resuming
    - Waiting on the server (see Recovery below)
  - AI Talking (Interviewer is speaking)
  - AI Not listening (Uninterruptible)
    - The opening and the closing of the interview. An ear with a slash, and a text label.
    - A banner and one polite announcement say: "The interviewer is not listening during this portion of the interview."
    - Before the voice starts, the notice stays on screen and the voice is held behind a progress bar, so text and braille readers do not collide with the interviewer's speech. Everyone sees it. There is no skip control. *The length of the hold is a placeholder.*
    - After a pause during the opening or closing, resuming repeats the notice and the hold once.
  - AI Idle
    - Session not started, paused, or closed
- Recovery, when the client waits on the server (after speech ends, pausing or resuming):
  - After 5 seconds, a warning: "The Interviewer isn't ready yet."
  - 10 seconds later (15 elapsed), a second warning: "The Interviewer is struggling to reconnect."
  - 15 seconds later (30 elapsed), an error: "The Interviewer has timed out. We are logging the error now. We will notify you when the session is ready to continue."
  - The client resends the waited-on cue at each warning. When the server recovers, the session is paused until the user resumes.
- Optional caption section
  - Off by default, because most interviews do not have caption systems, so people wanting an experience close to what they would expect get it off. Those who want the accommodation can turn it on in the caption panel.
- Microphone control.
- Pause. In any running state, including the opening and closing, it goes to pausing and shows Thinking until the server confirms.
- **End interview**
  - Sits below the control group, apart from the other buttons, so it is not hit by mistake.
  - Asks for confirmation first, and the safe choice ("Keep going") takes focus.
  - Closes the session straight away, without the interviewer's closing.
- Interview Control Panel
  - *Normally hidden.*
  - Gives access to training features and call conditions (if the user wants to experience lag or packet loss).
