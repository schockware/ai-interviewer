# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
"""The models behind the two passes, behind one small interface so the tests can stand in."""

from __future__ import annotations

import logging
import os
import sys
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import numpy as np

from .config import ModelSettings

log = logging.getLogger(__name__)

_CUDA_LIBRARY_HINTS = ("cublas", "cudnn", "cuda")


def _add_cuda_dll_directories() -> None:
    """On Windows, CTranslate2 loads cuBLAS and cuDNN from the PATH. The pip packages
    nvidia-cublas-cu12 and nvidia-cudnn-cu12 put them under site-packages/nvidia/*/bin, so point
    the loader there when they are installed. No-op elsewhere."""
    if sys.platform != "win32":
        return
    for site in map(Path, sys.path):
        nvidia = site / "nvidia"
        if not nvidia.is_dir():
            continue
        for bin_dir in nvidia.glob("*/bin"):
            try:
                os.add_dll_directory(str(bin_dir))
                os.environ["PATH"] = f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"
            except OSError:
                pass


def _is_cuda_library_error(e: BaseException) -> bool:
    text = str(e).lower()
    return any(hint in text for hint in _CUDA_LIBRARY_HINTS) and ("not found" in text or "cannot be loaded" in text or "no such" in text)


@dataclass(frozen=True)
class Piece:
    """What a model says about one stretch of audio, in seconds from the start of that audio."""

    start: float
    end: float
    text: str


@dataclass(frozen=True)
class ModelInfo:
    model: str
    device: str
    compute_type: str


class Transcriber(Protocol):
    def info(self) -> ModelInfo: ...

    def warm_up(self) -> None: ...

    def transcribe(self, audio: np.ndarray, *, language: str, quick: bool) -> list[Piece]:
        """`audio` is float32 at 16 kHz mono. `quick` asks for speed over accuracy (the live pass)."""
        ...


class WhisperTranscriber:
    """faster-whisper (CTranslate2). `auto` picks CUDA when CTranslate2 sees a device, else the CPU;
    a CUDA load that fails falls back to the CPU in int8 and says so."""

    def __init__(self, settings: ModelSettings) -> None:
        self._settings = settings
        self._model = None
        self._info = ModelInfo(settings.model, settings.device, settings.compute_type)
        self._lock = threading.Lock()

    def info(self) -> ModelInfo:
        return self._info

    def warm_up(self) -> None:
        self._load()

    def _load(self):
        with self._lock:
            if self._model is not None:
                return self._model
            from faster_whisper import WhisperModel  # imported late: it is heavy

            device = self._settings.device
            compute = self._settings.compute_type
            if device == "auto":
                import ctranslate2

                device = "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
                if device == "cpu" and compute not in ("int8", "int8_float32", "float32"):
                    compute = "int8"
            if device == "cuda":
                _add_cuda_dll_directories()
            try:
                self._model = WhisperModel(self._settings.model, device=device, compute_type=compute)
            except Exception as e:  # noqa: BLE001 - CUDA set-ups fail in many ways; the CPU is the honest fallback
                if device == "cuda":
                    log.warning("CUDA load failed for %s (%s); falling back to the CPU in int8.", self._settings.model, e)
                    device, compute = "cpu", "int8"
                    self._model = WhisperModel(self._settings.model, device=device, compute_type=compute)
                else:
                    raise
            self._info = ModelInfo(self._settings.model, device, compute)
            log.info("loaded %s on %s (%s)", self._info.model, self._info.device, self._info.compute_type)
            return self._model

    def transcribe(self, audio: np.ndarray, *, language: str, quick: bool) -> list[Piece]:
        try:
            return self._run(self._load(), audio, language=language, quick=quick)
        except RuntimeError as e:
            # cuBLAS or cuDNN missing shows up here, at the first compute, not at load time.
            if self._info.device == "cuda" and _is_cuda_library_error(e):
                log.warning("CUDA libraries are missing for %s (%s); falling back to the CPU in int8.", self._settings.model, e)
                with self._lock:
                    from faster_whisper import WhisperModel

                    self._model = WhisperModel(self._settings.model, device="cpu", compute_type="int8")
                    self._info = ModelInfo(self._settings.model, "cpu", "int8")
                return self._run(self._model, audio, language=language, quick=quick)
            raise

    @staticmethod
    def _run(model, audio: np.ndarray, *, language: str, quick: bool) -> list[Piece]:
        segments, _ = model.transcribe(
            audio,
            language=language,
            beam_size=1 if quick else 5,
            vad_filter=not quick,
            condition_on_previous_text=False,
            without_timestamps=False,
        )
        return [Piece(float(s.start), float(s.end), s.text.strip()) for s in segments if s.text.strip()]


@dataclass
class FakeTranscriber:
    """For tests: says a word for every second of audio, so lengths and timings are checkable."""

    word: str = "word"
    calls: list[tuple[int, bool]] = field(default_factory=list)

    def info(self) -> ModelInfo:
        return ModelInfo("fake", "none", "none")

    def warm_up(self) -> None:
        return None

    def transcribe(self, audio: np.ndarray, *, language: str, quick: bool) -> list[Piece]:
        self.calls.append((len(audio), quick))
        seconds = len(audio) / 16_000
        pieces: list[Piece] = []
        whole = int(seconds)
        for i in range(whole):
            pieces.append(Piece(float(i), float(i + 1), f"{self.word}{i + 1}"))
        if seconds - whole >= 0.5:
            pieces.append(Piece(float(whole), round(seconds, 2), f"{self.word}{whole + 1}"))
        return pieces
