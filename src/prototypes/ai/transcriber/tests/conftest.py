# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
"""Shared test audio: tones and silence, written as WAV, which ffmpeg decodes like anything else."""

from __future__ import annotations

import io
import math
import struct
import wave

import numpy as np
import pytest


def tone_pcm(seconds: float, hz: float = 440.0, sample_rate: int = 16_000) -> np.ndarray:
    t = np.arange(int(seconds * sample_rate)) / sample_rate
    return (0.3 * np.sin(2 * math.pi * hz * t)).astype(np.float32)


def wav_bytes(samples: np.ndarray, sample_rate: int = 16_000) -> bytes:
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples))
    return out.getvalue()


def webm_bytes(samples: np.ndarray, sample_rate: int = 16_000) -> bytes:
    """WebM with Opus, as the browser's recorder produces, made by ffmpeg from the samples."""
    import subprocess
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as folder:
        wav = Path(folder) / "in.wav"
        webm = Path(folder) / "out.webm"
        wav.write_bytes(wav_bytes(samples, sample_rate))
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", "32k", str(webm)], check=True)
        return webm.read_bytes()


@pytest.fixture
def three_second_wav() -> bytes:
    return wav_bytes(tone_pcm(3.0))


@pytest.fixture
def three_second_webm() -> bytes:
    return webm_bytes(tone_pcm(3.0))
