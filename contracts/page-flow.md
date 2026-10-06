*Authored by Steven Chock, with Claude Sonnet 5.5 (Anthropic) as co-author.*

# Developer pseudo contracts

"NULLs and NILs are evil. Explicit declarations only. Avoid booleans if possible."

- "default" is the first item in the options.
- {custom-local} requires advanced settings to pop up.
- {cloud} only allows supported integration selections.
  - We don't offer this for things that need real-time local processing. They bog down the pipeline with additional latency.

## Common contracts

```
SessionId: string
ResumeId: string
RoleId: string
DisplayName: string
Milliseconds: integer
```

## Application setup

```
ApplicationSetupForm:
{
  ai:
  {
    listener: "default" | "Silero VAD + Smart Turn" | {custom-local},
    transcriber: "default" | "whisper.cpp" | {custom-local},
    followUp: "interviewer" | {custom-local} | {cloud},
    interviewer: "default" | "Qwen3.5 ladder" | {custom-local} | {cloud},
    evaluator: "interviewer" | {custom-local} | {cloud},
    speaker: "default" | "Kokoro" | "Inflect-Nano-v1" | {custom-local}
  },
  interviewType: { type: "cold" } | { type: "hot-incomplete=>cold" } | { type: "hot", resumeId: ResumeId },
  roleFocus: "unanswered" | RoleId /* Server requires an answered RoleId */
}

LoadedResumes: {
    type: "none"
}
| {
    type: "ready",
    all: Array<[ResumeId, DisplayName]>
}

LoadedRoles: {
    type: "none"
}
| {
    type: "ready",
    all: Array<[RoleId, DisplayName]>
}

ApplicationSetupPage:
{
  type: "loading"
}
| {
  type: "error",
  message: string
}
| {
  type: "ready"
  form: ApplicationSetupForm,
  resumes: LoadedResumes,
  roles: LoadedRoles
}
/* 
  Stored as local state until the upload returns the ResumeProcessed 
  "hot-incomplete=>cold" 
*/
ResumeValidation: { type: "hot-incomplete=>cold" } | { type: "hot", resumeId: ResumeId }

/* Synchronous. Needs to wait for the file to completely upload and process. */
UploadResume:
{
  displayName: DisplayName,
  fileName: string,
  payload: byte[]
}
ResumeProcessed:
{
  resumeId: ResumeId,
  displayName: DisplayName
}

/* 
Stored as local state until the upload/paste returns the JobDescriptionProcessed 
- `required` is used if and only if the server didn't have any roles.
  - it should block any save
- `unanswered` is used if there are roles
*/
JobDescriptionValidation: { type: "required" | "unanswered" | "loading" } | { type: "ready", roleId: RoleId }

/* Synchronous. Needs to wait for the file to completely upload and process. */
JobDescriptionUpload:
{
  displayName: DisplayName,
  fileName: string,
  payload: byte[]
}

/* Synchronous. Needs to wait for the text to completely upload and process. */
JobDescriptionPaste:
{
  displayName: DisplayName,
  text: string
}

JobDescriptionProcessed:
{
  roleId: RoleId,
  displayName: DisplayName
}

/* Server should reject if required fields are not ready. */
PrepareInterview:
{
  form: ApplicationSetupForm,
  sessionId: SessionId // we need to warm up any real-time protocol to pair it with the interview thread.
}
```

## Hardware setup and verification

```
/*
Server owns this.
Handled via real-time connection (planned Websocket).
Because this is asynchronous, we do not want to interrupt the user.
A separate workflow should kick off if there is an error. The progress bar
should slow down if possible.

The hope is a transient error occurred (which cloud AI are known for), and
retry is possible.
*/
InterviewPrepared:
{
  sessionId: SessionId,
  status: "ok" | "error",
  logId: string
}

/*
If retry is not possible because of a setup or uncaught error, the existing
AI models will try to diagnose the error for the user to fix.
*/
CheckErroredInterview:
{
  sessionId: SessionId,
  logId: string
}

AdvancedTrainingOptions:
{
  captions: "disabled" | "enabled" // default: disabled
}

HardwareStatus: "pending" | "skipped" | "verified" | "errored"
HardwareQuality: "pending" | "skipped" | "clear" | "intermittent" | "readable" | "unreadable"
HardwareCheck: { status: HardwareStatus, quality: HardwareQuality }
HardwareSetupForm:
{
  audio: HardwareCheck,
  video: HardwareCheck,
  training: AdvancedTrainingOptions
}

/* 
Stored locally. I'm still not sure how the streams work.
TODO: How do we stream from the UI to the server to verify the hardware.
 */
VerifyHardware: { type: "audio" | "video" }
/*
Server owns this. Sent once it can estimate the stream quality.
*/
HardwareVerified: { type: "audio" | "video", quality: HardwareQuality }

StartInterview:
{
  form: HardwareSetupForm,
  sessionId: SessionId
}
```

## Interview

```
/* Comes from the server to make sure the cadence and latency emulation is properly managed on both sides. */
CueSettings:
{
  emulation:
  {
    // Used to lengthen or shorten the interviewer's speech patterns.
    cadences:
    {
      speaking: Milliseconds,
      listening: Milliseconds,
      thinking: Milliseconds,
      variances:
      {
        floor: float,
        ceiling: float
      }
    },
    latencies:
    {
      network: Milliseconds,
      // Used to randomize packet loss emulation. It's the chance loss occurs per second.
      packetLossVariancePerSecond: float,
      // Used to emulate the audio being clipped at the beginning, end or both.
      audioRamp: "clipped-beginning" | "clipped-ending" | "both"
    }
  }
}

/*
Interrupted should be displayed as "listening". It takes a while for the AI to
figure out how to resolve the interruption, so the UI state will need to hold or
obfuscate the captions or any other indicators it was displaying.

A pause request needs to interrupt the AI if they are not in listening mode.
*/
CueType: "speech-ready" | "speaking" | "speech-ended" | "listening" | "thinking" | "interrupted" | "pausing" | "paused" | "resuming"

/* Transitions */
"interrupted" => "listening" | "paused"
"speech-ready" => "speaking" | "interrupted"
"speaking" => "speech-ended" | "interrupted"
"speech-ended" => "listening"
"listening" => "thinking" | "pausing"
"thinking" => "speech-ready" | "interrupted"
"pausing" => "paused"
"paused" => "resuming"
"resuming" => "listening"

ServerCue:
{
  type: "speech-ready",
  cadence: Milliseconds // when the AI is expected to start talking. This allows the lead-in cues to trigger.
}
| {
  type: "speaking",
  transcript: string,
  audioStream: Stream
}
| {
  type: "listening",
  waitCadence: Milliseconds // used by the server to wait for the user speech to naturally end.
}
| {
  type: "thinking" // this cue is intended to reduce the user's proclivity to interrupt during silence.
}
| {
  type: "interrupted" // the server is the only one capable of interpreting where in the workflow it needs to re-enter.
}
| {
  type: "paused"
}

/*
Triggers after the last frame plays.

Used by the UI to start the transitions.

Used by the server to let the Listener know the response prompt versus an
interrupt prompt is ready to start.

Must have a server response of "listening" before the guards can release.

TODO: We might need a faux "thinking" transition here if we are at risk of the
AI not being ready to listen.
*/
ClientCue:
{
  type: "speech-ended",
  guard: Milliseconds, // used to distinguish from a speech cadence.
  transition: Milliseconds, // used to let the audio and visual cues finish.
  screenReaderPadding: Milliseconds // used if the user has added screen reader padding in their accessibility settings.
}
| {
  type: "pausing" // Should trigger a thinking. Gives the AI time to confirm it's entered a paused state.
}
| {
  type: "resuming" // Should trigger a thinking transition while the AI gets back to where it needs to be.
}
```

## OpenAPI 3.1

Draft conversion of the contracts above. The schemas are converted one to one; the paths, status codes and `Error` shape are **proposals** for Steven's judgment. Notes:

- Discriminated unions use `oneOf` with a `const` on `type`.
- `{custom-local}` and `{cloud}` are placeholder object schemas until their shapes are defined.
- `InterviewPrepared`, `VerifyHardware`, `HardwareVerified`, `ServerCue` and `ClientCue` have no path. They travel over a push or real-time channel that OpenAPI cannot describe, so they stay as message schemas.
- `ResumeValidation` and `JobDescriptionValidation` are client-side state, kept as schemas for reference.
- The cue transitions are kept as an `x-transitions` extension on `CueType`.
- Checked with `openapi-spec-validator`; it validates structure, not behavior.

```yaml
openapi: 3.1.0
info:
  title: AI Interviewer page flow
  version: 0.1.0-draft
  description: >
    Draft conversion of the pseudo contracts above. Paths, status codes and the
    Error schema are proposals; the schemas are converted one to one.
paths:
  /application-setup:
    get:
      operationId: getApplicationSetupPage
      summary: Load the application setup page
      responses:
        "200":
          description: The page in one of its explicit states.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ApplicationSetupPage"
  /resumes:
    post:
      operationId: uploadResume
      summary: Upload a resume. Synchronous, responds once processed.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/UploadResume"
      responses:
        "200":
          description: Resume processed.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ResumeProcessed"
        default:
          $ref: "#/components/responses/Failure"
  /job-descriptions/uploads:
    post:
      operationId: uploadJobDescription
      summary: Upload a job description file. Synchronous, responds once processed.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/JobDescriptionUpload"
      responses:
        "200":
          description: Job description processed.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/JobDescriptionProcessed"
        default:
          $ref: "#/components/responses/Failure"
  /job-descriptions/pastes:
    post:
      operationId: pasteJobDescription
      summary: Submit pasted job description text. Synchronous, responds once processed.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/JobDescriptionPaste"
      responses:
        "200":
          description: Job description processed.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/JobDescriptionProcessed"
        default:
          $ref: "#/components/responses/Failure"
  /interviews/prepare:
    post:
      operationId: prepareInterview
      summary: Start building the interview. Completion is reported by InterviewPrepared.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/PrepareInterview"
      responses:
        "202":
          description: Preparation started. The client moves on to hardware setup.
        "422":
          description: Required fields are not ready.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
  /interviews/error-checks:
    post:
      operationId: checkErroredInterview
      summary: Ask the existing models to diagnose a failed preparation.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CheckErroredInterview"
      responses:
        "200":
          description: Diagnosis for the user to act on.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        default:
          $ref: "#/components/responses/Failure"
  /interviews/start:
    post:
      operationId: startInterview
      summary: Start the interview once preparation and hardware checks are done.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/StartInterview"
      responses:
        "200":
          description: Interview started. Cues flow over the real-time channel.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CueSettings"
        default:
          $ref: "#/components/responses/Failure"
components:
  responses:
    Failure:
      description: The request failed.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Error"
  schemas:
    # Proposal: the pseudo contracts have no error shape beyond ApplicationSetupPage.error.
    Error:
      type: object
      required: [message]
      properties:
        message: { type: string }

    # Common contracts
    SessionId: { type: string }
    ResumeId: { type: string }
    RoleId: { type: string }
    DisplayName: { type: string }
    Milliseconds: { type: integer, minimum: 0 }

    # Application setup
    CustomLocal:
      description: "{custom-local}. Requires advanced settings. Shape not yet defined."
      type: object
    Cloud:
      description: "{cloud}. Supported integrations only. Shape not yet defined."
      type: object
    ApplicationSetupForm:
      type: object
      required: [ai, interviewType, roleFocus]
      properties:
        ai:
          type: object
          required: [listener, transcriber, followUp, interviewer, evaluator, speaker]
          properties:
            listener:
              oneOf:
                - { type: string, enum: [default, Silero VAD + Smart Turn] }
                - { $ref: "#/components/schemas/CustomLocal" }
            transcriber:
              oneOf:
                - { type: string, enum: [default, whisper.cpp] }
                - { $ref: "#/components/schemas/CustomLocal" }
            followUp:
              oneOf:
                - { type: string, enum: [interviewer] }
                - { $ref: "#/components/schemas/CustomLocal" }
                - { $ref: "#/components/schemas/Cloud" }
            interviewer:
              oneOf:
                - { type: string, enum: [default, Qwen3.5 ladder] }
                - { $ref: "#/components/schemas/CustomLocal" }
                - { $ref: "#/components/schemas/Cloud" }
            evaluator:
              oneOf:
                - { type: string, enum: [interviewer] }
                - { $ref: "#/components/schemas/CustomLocal" }
                - { $ref: "#/components/schemas/Cloud" }
            speaker:
              oneOf:
                - { type: string, enum: [default, Kokoro, Inflect-Nano-v1] }
                - { $ref: "#/components/schemas/CustomLocal" }
        interviewType:
          $ref: "#/components/schemas/InterviewType"
        roleFocus:
          description: The server requires an answered RoleId.
          oneOf:
            - { type: string, const: unanswered }
            - { $ref: "#/components/schemas/RoleId" }
    InterviewTypeCold:
      type: object
      required: [type]
      properties:
        type: { const: cold }
    InterviewTypeHotIncompleteToCold:
      type: object
      required: [type]
      properties:
        type: { const: "hot-incomplete=>cold" }
    InterviewTypeHot:
      type: object
      required: [type, resumeId]
      properties:
        type: { const: hot }
        resumeId: { $ref: "#/components/schemas/ResumeId" }
    InterviewType:
      oneOf:
        - $ref: "#/components/schemas/InterviewTypeCold"
        - $ref: "#/components/schemas/InterviewTypeHotIncompleteToCold"
        - $ref: "#/components/schemas/InterviewTypeHot"
      discriminator:
        propertyName: type
        mapping:
          cold: "#/components/schemas/InterviewTypeCold"
          "hot-incomplete=>cold": "#/components/schemas/InterviewTypeHotIncompleteToCold"
          hot: "#/components/schemas/InterviewTypeHot"
    LoadedResumes:
      oneOf:
        - type: object
          required: [type]
          properties:
            type: { const: none }
        - type: object
          required: [type, all]
          properties:
            type: { const: ready }
            all:
              type: array
              items:
                type: array
                prefixItems:
                  - { $ref: "#/components/schemas/ResumeId" }
                  - { $ref: "#/components/schemas/DisplayName" }
                minItems: 2
                maxItems: 2
    LoadedRoles:
      oneOf:
        - type: object
          required: [type]
          properties:
            type: { const: none }
        - type: object
          required: [type, all]
          properties:
            type: { const: ready }
            all:
              type: array
              items:
                type: array
                prefixItems:
                  - { $ref: "#/components/schemas/RoleId" }
                  - { $ref: "#/components/schemas/DisplayName" }
                minItems: 2
                maxItems: 2
    ApplicationSetupPage:
      oneOf:
        - type: object
          required: [type]
          properties:
            type: { const: loading }
        - type: object
          required: [type, message]
          properties:
            type: { const: error }
            message: { type: string }
        - type: object
          required: [type, form, resumes, roles]
          properties:
            type: { const: ready }
            form: { $ref: "#/components/schemas/ApplicationSetupForm" }
            resumes: { $ref: "#/components/schemas/LoadedResumes" }
            roles: { $ref: "#/components/schemas/LoadedRoles" }
    ResumeValidation:
      description: Client-side state only. Kept until the upload returns ResumeProcessed.
      oneOf:
        - $ref: "#/components/schemas/InterviewTypeHotIncompleteToCold"
        - $ref: "#/components/schemas/InterviewTypeHot"
    UploadResume:
      type: object
      required: [displayName, fileName, payload]
      properties:
        displayName: { $ref: "#/components/schemas/DisplayName" }
        fileName: { type: string }
        payload: { type: string, format: byte, description: Base64 file bytes. }
    ResumeProcessed:
      type: object
      required: [resumeId, displayName]
      properties:
        resumeId: { $ref: "#/components/schemas/ResumeId" }
        displayName: { $ref: "#/components/schemas/DisplayName" }
    JobDescriptionValidation:
      description: >
        Client-side state only. Kept until the upload or paste returns
        JobDescriptionProcessed. "required" is used only when the server had no
        roles and blocks any save. "unanswered" is used when there are roles.
      oneOf:
        - type: object
          required: [type]
          properties:
            type: { enum: [required, unanswered, loading] }
        - type: object
          required: [type, roleId]
          properties:
            type: { const: ready }
            roleId: { $ref: "#/components/schemas/RoleId" }
    JobDescriptionUpload:
      type: object
      required: [displayName, fileName, payload]
      properties:
        displayName: { $ref: "#/components/schemas/DisplayName" }
        fileName: { type: string }
        payload: { type: string, format: byte, description: Base64 file bytes. }
    JobDescriptionPaste:
      type: object
      required: [displayName, text]
      properties:
        displayName: { $ref: "#/components/schemas/DisplayName" }
        text: { type: string }
    JobDescriptionProcessed:
      type: object
      required: [roleId, displayName]
      properties:
        roleId: { $ref: "#/components/schemas/RoleId" }
        displayName: { $ref: "#/components/schemas/DisplayName" }
    PrepareInterview:
      description: The server rejects this if required fields are not ready.
      type: object
      required: [form, sessionId]
      properties:
        form: { $ref: "#/components/schemas/ApplicationSetupForm" }
        sessionId: { $ref: "#/components/schemas/SessionId" }

    # Hardware setup and verification
    InterviewPrepared:
      description: >
        Asynchronous, so the user is not interrupted. Transport (push or poll) is
        not yet decided, so no path references this schema.
      type: object
      required: [sessionId, status, logId]
      properties:
        sessionId: { $ref: "#/components/schemas/SessionId" }
        status: { type: string, enum: [ok, error] }
        logId: { type: string }
    CheckErroredInterview:
      type: object
      required: [sessionId, logId]
      properties:
        sessionId: { $ref: "#/components/schemas/SessionId" }
        logId: { type: string }
    AdvancedTrainingOptions:
      type: object
      required: [captions]
      properties:
        captions: { type: string, enum: [disabled, enabled], default: disabled }
    HardwareStatus:
      type: string
      enum: [pending, skipped, verified, errored]
    HardwareQuality:
      type: string
      enum: [pending, skipped, clear, intermittent, readable, unreadable]
    HardwareCheck:
      type: object
      required: [status, quality]
      properties:
        status: { $ref: "#/components/schemas/HardwareStatus" }
        quality: { $ref: "#/components/schemas/HardwareQuality" }
    HardwareSetupForm:
      type: object
      required: [audio, video, training]
      properties:
        audio: { $ref: "#/components/schemas/HardwareCheck" }
        video: { $ref: "#/components/schemas/HardwareCheck" }
        training: { $ref: "#/components/schemas/AdvancedTrainingOptions" }
    VerifyHardware:
      description: Client-side hardware check; no path references it yet.
      type: object
      required: [type]
      properties:
        type: { type: string, enum: [audio, video] }
    HardwareVerified:
      type: object
      required: [type, quality]
      properties:
        type: { type: string, enum: [audio, video] }
        quality: { $ref: "#/components/schemas/HardwareQuality" }
    StartInterview:
      type: object
      required: [form, sessionId]
      properties:
        form: { $ref: "#/components/schemas/HardwareSetupForm" }
        sessionId: { $ref: "#/components/schemas/SessionId" }

    # Interview
    CueSettings:
      description: Comes from the server so cadence and latency emulation are managed the same on both sides.
      type: object
      required: [emulation]
      properties:
        emulation:
          type: object
          required: [cadences, latencies]
          properties:
            cadences:
              description: Lengthens or shortens the interviewer's speech patterns.
              type: object
              required: [speaking, listening, thinking, variances]
              properties:
                speaking: { $ref: "#/components/schemas/Milliseconds" }
                listening: { $ref: "#/components/schemas/Milliseconds" }
                thinking: { $ref: "#/components/schemas/Milliseconds" }
                variances:
                  type: object
                  required: [floor, ceiling]
                  properties:
                    floor: { type: number, format: float }
                    ceiling: { type: number, format: float }
            latencies:
              type: object
              required: [network, packetLossVariancePerSecond, audioRamp]
              properties:
                network: { $ref: "#/components/schemas/Milliseconds" }
                packetLossVariancePerSecond:
                  description: Randomizes packet loss emulation. The chance loss occurs per second.
                  type: number
                  format: float
                audioRamp:
                  description: Emulates audio being clipped at the beginning, end or both.
                  type: string
                  enum: [clipped-beginning, clipped-ending, both]
    CueType:
      description: >
        Interrupted is displayed as "listening". A pause request must interrupt the
        AI if it is not listening. Allowed transitions are listed in x-transitions.
      type: string
      enum:
        - speech-ready
        - speaking
        - speech-ended
        - listening
        - thinking
        - interrupted
        - pausing
        - paused
        - resuming
      x-transitions:
        interrupted: [listening, paused]
        speech-ready: [speaking, interrupted]
        speaking: [speech-ended, interrupted]
        speech-ended: [listening]
        listening: [thinking, pausing]
        thinking: [speech-ready, interrupted]
        pausing: [paused]
        paused: [resuming]
        resuming: [listening]
    # ServerCue and ClientCue travel over the real-time channel, which OpenAPI cannot
    # describe. They are kept here as message schemas.
    ServerCue:
      oneOf:
        - type: object
          required: [type, cadence]
          properties:
            type: { const: speech-ready }
            cadence:
              description: When the AI is expected to start talking, so lead-in cues can trigger.
              $ref: "#/components/schemas/Milliseconds"
        - type: object
          required: [type, transcript, audioStream]
          properties:
            type: { const: speaking }
            transcript: { type: string }
            audioStream:
              description: Out-of-band audio stream; the real-time channel defines its encoding.
              type: string
              format: binary
        - type: object
          required: [type, waitCadence]
          properties:
            type: { const: listening }
            waitCadence:
              description: Used by the server to wait for the user's speech to end naturally.
              $ref: "#/components/schemas/Milliseconds"
        - type: object
          required: [type]
          properties:
            type: { const: thinking }
        - type: object
          required: [type]
          properties:
            type: { const: interrupted }
        - type: object
          required: [type]
          properties:
            type: { const: paused }
    ClientCue:
      oneOf:
        - type: object
          description: Triggers after the last frame plays. The guards release only after the server answers "listening".
          required: [type, guard, transition, screenReaderPadding]
          properties:
            type: { const: speech-ended }
            guard:
              description: Distinguishes this from a speech cadence.
              $ref: "#/components/schemas/Milliseconds"
            transition:
              description: Lets the audio and visual cues finish.
              $ref: "#/components/schemas/Milliseconds"
            screenReaderPadding:
              description: Applies if the user added screen reader padding in accessibility settings.
              $ref: "#/components/schemas/Milliseconds"
        - type: object
          description: Triggers a thinking cue while the AI confirms it entered a paused state.
          required: [type]
          properties:
            type: { const: pausing }
        - type: object
          description: Triggers a thinking cue while the AI returns to where it needs to be.
          required: [type]
          properties:
            type: { const: resuming }
```
