# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
"""The real models on real speech. Opt-in: AI_INTEGRATION=1 (decision 0004: real integrations skip loudly).

Speech comes from Windows' own synthesizer (System.Speech), so no recording is needed and the
expected words are known. Elsewhere the test is skipped.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

import pytest

from transcriber.config import Settings
from transcriber.models import WhisperTranscriber
from transcriber.post_question import transcribe_file
from transcriber.realtime import RealtimeSession

pytestmark = pytest.mark.skipif(os.environ.get("AI_INTEGRATION") != "1", reason="set AI_INTEGRATION=1 to run the real models (skipped loudly)")

SENTENCE = "The quick brown fox jumps over the lazy dog, and the interview begins now."
EXPECTED = ["quick", "brown", "fox", "lazy", "dog", "interview"]


@pytest.fixture(scope="module")
def spoken_wav(tmp_path_factory):
    if sys.platform != "win32" or not shutil.which("powershell"):
        pytest.skip("speech synthesis for the test audio needs Windows")
    path = tmp_path_factory.mktemp("speech") / "sentence.wav"
    script = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        f"$s.SetOutputToWaveFile('{path}'); $s.Speak('{SENTENCE}'); $s.Dispose()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", script], check=True, capture_output=True)
    return path


def words_of(text: str) -> set[str]:
    return {w.strip(".,!?").lower() for w in text.split()}


def test_the_post_question_model_transcribes_synthesized_speech(spoken_wav):
    settings = Settings.from_env()
    model = WhisperTranscriber(settings.post_question)
    pieces = transcribe_file(str(spoken_wav), model, language=settings.language)
    text = " ".join(p.text for p in pieces)
    print(f"\npost-question ({model.info()}): {text}")
    missing = [w for w in EXPECTED if w not in words_of(text)]
    assert not missing, f"missing {missing} in: {text}"


def test_the_realtime_model_transcribes_synthesized_speech_fed_in_chunks(spoken_wav):
    settings = Settings.from_env()
    model = WhisperTranscriber(settings.realtime)
    session = RealtimeSession(model, language=settings.language, step_seconds=settings.step_seconds, window_seconds=settings.window_seconds)
    # As the browser sends it: WebM with Opus, in chunks.
    webm = spoken_wav.with_suffix(".webm")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(spoken_wav), "-c:a", "libopus", "-b:a", "32k", str(webm)], check=True)
    data = webm.read_bytes()
    seen = []
    for i in range(0, len(data), 8000):
        session.push(data[i : i + 8000])
        seen += session.poll()
    seen += session.finish()
    finals = [s for s in seen if s.final]
    text = " ".join(s.text for s in finals)
    print(f"\nrealtime ({model.info()}): {text}")
    partials = [s for s in seen if not s.final]
    assert finals, "no final text"
    missing = [w for w in EXPECTED if w not in words_of(text)]
    assert len(missing) <= 1, f"missing {missing} in: {text}"
    assert len(partials) + len(finals) == len(seen)
