# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
"""The real-time pass: partial text while the user speaks, final text as the audio settles.

Policy (PROPOSAL, specs/transcription STT-STR-001 and STT-STR-002): audio is decoded as it
arrives. Every `step_seconds` of new audio, the model reads everything since the last committed
point and the result goes out as partials, replacing the previous partials. Once that uncommitted
stretch is longer than `window_seconds`, the pieces that end more than a second before its end
are committed as finals, each naming the partials it replaces, and reading starts again after
them. finish() commits whatever remains. The model never sees more than one window at a time, so
the live pass stays cheap enough for a 4-core machine; the post-question pass reads the whole
file with the large model.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .decode import SAMPLE_RATE, StreamDecoder
from .models import Piece, Transcriber

TAIL_SECONDS = 1.0  # the trailing second is never committed: a word may still be forming


@dataclass(frozen=True)
class Segment:
    id: str
    start: float
    end: float
    text: str
    final: bool
    replaces: tuple[str, ...] = ()


@dataclass
class _State:
    audio: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=np.float32))
    committed_seconds: float = 0.0
    read_until_seconds: float = 0.0
    next_id: int = 1
    partial_ids: list[str] = field(default_factory=list)


class RealtimeSession:
    """One question's live transcription. Not thread-safe: drive it from one task."""

    def __init__(self, transcriber: Transcriber, *, language: str, step_seconds: float, window_seconds: float, decoder: StreamDecoder | None = None) -> None:
        self._transcriber = transcriber
        self._language = language
        self._step = step_seconds
        self._window = window_seconds
        self._decoder = decoder if decoder is not None else StreamDecoder()
        self._state = _State()
        self._finished = False

    @property
    def seconds_received(self) -> float:
        return len(self._state.audio) / SAMPLE_RATE

    def push(self, chunk: bytes) -> None:
        """One container chunk from the browser."""
        self._decoder.feed(chunk)

    def push_pcm(self, samples: np.ndarray) -> None:
        """Already-decoded audio, for tests and for callers that decode themselves."""
        self._state.audio = np.concatenate([self._state.audio, samples.astype(np.float32)])

    def poll(self) -> list[Segment]:
        """Takes whatever has been decoded and transcribes if a step's worth is new. Cheap when nothing is."""
        self._absorb()
        s = self._state
        if self.seconds_received - s.read_until_seconds < self._step:
            return []
        return self._read(final_before=self.seconds_received - TAIL_SECONDS if self.seconds_received - s.committed_seconds >= self._window else None)

    def finish(self) -> list[Segment]:
        """No more audio: whatever is left becomes final."""
        if self._finished:
            return []
        self._finished = True
        self._state.audio = np.concatenate([self._state.audio, self._decoder.close()])
        if self.seconds_received - self._state.committed_seconds <= 0.05:
            return self._retire_partials()
        return self._read(final_before=float("inf"))

    def _absorb(self) -> None:
        fresh = self._decoder.take()
        if len(fresh):
            self._state.audio = np.concatenate([self._state.audio, fresh])

    def _read(self, *, final_before: float | None) -> list[Segment]:
        s = self._state
        start = int(s.committed_seconds * SAMPLE_RATE)
        audio = s.audio[start:]
        s.read_until_seconds = self.seconds_received
        pieces = self._transcriber.transcribe(audio, language=self._language, quick=True)
        out: list[Segment] = []
        replaced = tuple(s.partial_ids)
        s.partial_ids = []
        committed_to = s.committed_seconds
        for piece in pieces:
            absolute = Piece(piece.start + s.committed_seconds, piece.end + s.committed_seconds, piece.text)
            final = final_before is not None and absolute.end <= final_before
            seg_id = f"rt-{s.next_id}"
            s.next_id += 1
            # The first piece of a read, final or not, names the previous partials: a re-read replaces them whole.
            names = replaced if not out else ()
            if final:
                out.append(Segment(seg_id, absolute.start, absolute.end, absolute.text, True, names))
                committed_to = absolute.end
            else:
                out.append(Segment(seg_id, absolute.start, absolute.end, absolute.text, False, names))
                s.partial_ids.append(seg_id)
        if final_before is not None and not pieces and final_before == float("inf"):
            return self._retire_partials(replaced)
        if final_before is not None and committed_to > s.committed_seconds:
            s.committed_seconds = committed_to
            # Whatever was read past the committed point is spoken again next time, so partials are not left stale.
            s.read_until_seconds = committed_to
        return out

    def _retire_partials(self, replaced: tuple[str, ...] | None = None) -> list[Segment]:
        """Nothing final to say, but outstanding partials must not linger: an empty final retires them."""
        ids = replaced if replaced is not None else tuple(self._state.partial_ids)
        self._state.partial_ids = []
        if not ids:
            return []
        s = self._state
        seg_id = f"rt-{s.next_id}"
        s.next_id += 1
        return [Segment(seg_id, s.committed_seconds, self.seconds_received, "", True, ids)]
