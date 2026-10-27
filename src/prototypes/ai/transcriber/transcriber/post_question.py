# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
"""The post-question pass: the large model over one question's finished audio file."""

from __future__ import annotations

from pathlib import Path

from .decode import decode_file
from .models import Piece, Transcriber


def transcribe_file(path: str, transcriber: Transcriber, *, language: str) -> list[Piece]:
    """Every piece of the file, final by nature. The whole file is one read, so the model has all the context."""
    file = Path(path)
    if not file.is_file():
        raise FileNotFoundError(f"No audio file at {path}.")
    audio = decode_file(str(file))
    if len(audio) == 0:
        return []
    return transcriber.transcribe(audio, language=language, quick=False)
