# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
"""Settings, from the environment. Every value here is a PROPOSAL until measured (decision 0001)."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class ModelSettings:
    """One faster-whisper model: its size or repository id, where it runs, and in what precision."""

    model: str
    device: str  # cpu, cuda, or auto (cuda when CTranslate2 sees one, else cpu)
    compute_type: str  # int8 on cpu; float16 or int8_float16 on cuda


@dataclass(frozen=True)
class Settings:
    port: int
    language: str
    realtime: ModelSettings
    post_question: ModelSettings
    # How much new audio arrives before the real-time pass runs again, and how much it keeps
    # re-reading before committing text as final (transcriber/realtime.py).
    step_seconds: float
    window_seconds: float

    @staticmethod
    def from_env() -> "Settings":
        return Settings(
            port=int(_env("TRANSCRIBER_PORT", "50051")),
            language=_env("TRANSCRIBER_LANGUAGE", "en"),
            # Tier 1 minimum from decision 0001: whisper base, int8, on the CPU.
            realtime=ModelSettings(
                model=_env("REALTIME_MODEL", "base"),
                device=_env("REALTIME_DEVICE", "cpu"),
                compute_type=_env("REALTIME_COMPUTE", "int8"),
            ),
            # The large GPU-backed pass over the finished file (Steven, 2026-10-27).
            post_question=ModelSettings(
                model=_env("POST_MODEL", "mobiuslabsgmbh/faster-whisper-large-v3-turbo"),
                device=_env("POST_DEVICE", "auto"),
                compute_type=_env("POST_COMPUTE", "float16"),
            ),
            step_seconds=float(_env("REALTIME_STEP_SECONDS", "2")),
            window_seconds=float(_env("REALTIME_WINDOW_SECONDS", "8")),
        )
