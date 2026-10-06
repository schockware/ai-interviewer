*Authored by Steven Chock, with Claude Sonnet 5.5 (Anthropic) as co-author.*

# Basic Flow

Accessibility is always visible and is the first button focused, in case someone with an accessibility device is reading the page.

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
  - It takes the user to the Hardware setup and verification screen right away, with a progress bar at the bottom of the screen.

## 2. Hardware setup and verification

*This is what a user would normally experience during interview prep.*

- Hardware check (audio, optional video).
- Advanced training options in the bottom right.
  - Lets the user turn on training modules, turn on captions by default, turn on simulated network latency and packet loss, etc.
- To add some immersion, display a "Waiting for host..." message with a pacifier icon while the AI prepares the interview. The progress bar stays visible.
- **Start Interview**
  - *Disabled until the interview is prepared and the required hardware settings are verified and rated clear, intermittent or readable.*

## 3. Interview

- A status section describing different visual and audio cues:
  - AI Listening (Your turn)
    - User is speaking
    - Server has been interrupted via speech or command, i.e. pausing
    - Speech has ended on the Client
  - AI Thinking
    - Interviewer is thinking or finished thinking
    - Session is pausing
    - Session is resuming
  - AI Talking (Interviewer is speaking)
  - AI Idle
    - Server paused or session not started
- Optional caption section
  - Off by default, because most interviews do not have caption systems, so people wanting an experience close to what they would expect get it off. Those who want the accommodation can turn it on in the caption panel.
- Microphone control.
- Interview Control Panel
  - *Normally hidden.*
  - Gives access to training features and call conditions (if the user wants to experience lag or packet loss).
