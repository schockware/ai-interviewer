*Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.*

# transcriber (prototype)

The transcription worker: Python, hosting the model-backed transcription layer (decision 0002), spoken to by the C# coordinator over gRPC (decision 0003). **Prototype zone: nothing here is verified.** One process serves both passes Steven asked for on 2026-10-27:

| Service | What it does | Model (PROPOSAL, decision 0001) |
|---|---|---|
| `RealTimeTranscriber.Transcribe` | Takes the browser's recorder chunks as they arrive (WebM with Opus), decodes them with ffmpeg as a live pipe, and answers with partial text while the user speaks and final text as segments settle. Each final names the partials it replaces (specs/transcription STT-STR-001, STT-STR-002) | whisper `base`, int8, CPU: the Tier 1 minimum |
| `PostQuestionTranscriber.TranscribeFile` | Reads one question's finished audio file with the large model, in one pass with all the context | `faster-whisper-large-v3-turbo`, float16 on the GPU; falls back to the CPU in int8 and says so |

Both report `Health` with the model, device and precision actually in use. The contract is [`contracts/ai/transcription.proto`](../../../../contracts/ai/transcription.proto); the C# client is generated from the same file.

## Run

Needs Python 3.12, `ffmpeg` on the PATH, and the models. Everything below runs in this folder.

```
python -m venv .venv
.venv\Scripts\pip install -e ".[dev]"
.venv\Scripts\python -m transcriber.gen        # the gRPC stubs, from the proto; rerun after a proto change
.venv\Scripts\python -m transcriber.server     # listens on 127.0.0.1:50051, then loads both models
```

The first run downloads whisper `base` (about 150 MB). The post-question model loads on the GPU when CTranslate2 sees one; on Windows it needs cuBLAS and cuDNN on the PATH, which `pip install nvidia-cublas-cu12 nvidia-cudnn-cu12` provides and the worker finds by itself. Without them it falls back to the CPU and logs that it did.

| Variable | Default | Meaning |
|---|---|---|
| `TRANSCRIBER_PORT` | `50051` | Where it listens (loopback only) |
| `TRANSCRIBER_LANGUAGE` | `en` | Passed to both models |
| `REALTIME_MODEL`, `REALTIME_DEVICE`, `REALTIME_COMPUTE` | `base`, `cpu`, `int8` | The live pass |
| `POST_MODEL`, `POST_DEVICE`, `POST_COMPUTE` | `mobiuslabsgmbh/faster-whisper-large-v3-turbo`, `auto`, `float16` | The post-question pass |
| `REALTIME_STEP_SECONDS`, `REALTIME_WINDOW_SECONDS` | `2`, `8` | How often the live pass re-reads, and how much it re-reads before committing finals |

## The live policy (PROPOSAL)

Every `step` seconds of new audio, the model reads everything since the last committed point and the result goes out as partials, replacing the previous ones. Once that stretch is longer than `window`, the pieces ending more than a second before its end become finals and reading starts again after them. The model never sees more than one window at a time, which is what keeps the live pass cheap enough for the 4-core minimum. Targets STT-TGT-001 and STT-TGT-002 are still to be set; nothing here has been measured on 4 cores.

## Tests

```
.venv\Scripts\python -m pytest                       # fast: ffmpeg decoding, the live policy with a fake model, both services in-process
AI_INTEGRATION=1 .venv\Scripts\python -m pytest -s   # the real models on speech Windows synthesizes, so the expected words are known
```

The integration run skips loudly elsewhere (decision 0004). On this machine it transcribed the synthesized sentence word for word with the live pass.

## Layout

```
transcriber/config.py          settings, from the environment
transcriber/decode.py          ffmpeg: a live pipe for the stream, a whole-file decode for the post pass
transcriber/models.py          faster-whisper behind one small interface, with the CPU fallback; a fake for tests
transcriber/realtime.py        the live policy: partials, finals, replaces
transcriber/post_question.py   the large model over a file
transcriber/server.py          both gRPC services, one process
transcriber/gen.py             stub generation from the proto (output ignored by git)
tests/                         pytest
```

## Not here yet

Containers (deferred, `TASKS.MD`); supervision by C# (decision 0003, open item 4); the first-pass and post-question summaries and their accuracy comparison, which read what this worker produces; a WAV through the live pipe (ffmpeg holds it until the end; the browser never sends one).
