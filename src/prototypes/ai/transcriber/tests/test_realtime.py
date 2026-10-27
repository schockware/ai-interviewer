# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
"""The live policy, with a fake model that says one word per second (specs/transcription STT-STR-001, STT-STR-002)."""

from __future__ import annotations

import numpy as np

from transcriber.models import FakeTranscriber
from transcriber.realtime import RealtimeSession


class NoDecoder:
    """The session is fed PCM directly, so ffmpeg is out of the picture."""

    def feed(self, chunk: bytes) -> None:
        raise AssertionError("these tests push PCM")

    def take(self) -> np.ndarray:
        return np.zeros(0, dtype=np.float32)

    def close(self) -> np.ndarray:
        return np.zeros(0, dtype=np.float32)


def session(step=2.0, window=6.0):
    model = FakeTranscriber()
    return model, RealtimeSession(model, language="en", step_seconds=step, window_seconds=window, decoder=NoDecoder())  # type: ignore[arg-type]


def seconds(n: float) -> np.ndarray:
    return np.zeros(int(n * 16_000), dtype=np.float32)


def test_nothing_is_said_before_a_step_of_audio():
    model, s = session()
    s.push_pcm(seconds(1.0))
    assert s.poll() == []
    assert model.calls == []


def test_partials_appear_after_a_step_and_are_replaced_by_the_next_read():
    _, s = session()
    s.push_pcm(seconds(2.0))
    first = s.poll()
    assert [p.text for p in first] == ["word1", "word2"]
    assert all(not p.final for p in first)

    s.push_pcm(seconds(2.0))
    second = s.poll()
    assert [p.text for p in second] == ["word1", "word2", "word3", "word4"]
    assert all(not p.final for p in second)
    assert {p.id for p in first}.isdisjoint({p.id for p in second})
    assert second[0].replaces == tuple(p.id for p in first), "a re-read names the partials it supersedes, so none linger"
    assert second[1].replaces == ()


def test_text_older_than_the_window_becomes_final_and_names_the_partials_it_replaces():
    _, s = session(step=2.0, window=6.0)
    s.push_pcm(seconds(2.0))
    partial_ids = [p.id for p in s.poll()]
    s.push_pcm(seconds(4.0))  # six seconds since the last commit: the window is full
    out = s.poll()
    finals = [p for p in out if p.final]
    partials = [p for p in out if not p.final]
    assert [p.text for p in finals] == ["word1", "word2", "word3", "word4", "word5"], "the trailing second stays open"
    assert finals[0].replaces == tuple(partial_ids)
    assert [p.text for p in partials] == ["word6"]
    assert finals[-1].end == 5.0


def test_after_a_commit_the_model_reads_from_the_committed_point():
    model, s = session(step=2.0, window=6.0)
    s.push_pcm(seconds(6.0))
    s.poll()  # commits up to five seconds
    s.push_pcm(seconds(2.0))
    out = s.poll()
    assert model.calls[-1][0] == 3 * 16_000, "three seconds: the uncommitted one plus two new"
    assert [p.text for p in out] == ["word1", "word2", "word3"]
    assert [round(p.start, 1) for p in out] == [5.0, 6.0, 7.0], "timings are absolute"


def test_finish_makes_everything_final_and_retires_partials():
    _, s = session()
    s.push_pcm(seconds(2.0))
    partial_ids = [p.id for p in s.poll()]
    s.push_pcm(seconds(1.0))
    out = s.finish()
    assert all(p.final for p in out)
    assert [p.text for p in out] == ["word1", "word2", "word3"]
    assert out[0].replaces == tuple(partial_ids)
    assert s.finish() == [], "finishing twice says nothing more"


def test_finish_with_nothing_new_retires_outstanding_partials_with_an_empty_final():
    _, s = session()
    s.push_pcm(seconds(2.0))
    partial_ids = [p.id for p in s.poll()]
    out = s.finish()
    assert len(out) >= 1
    assert out[0].final
    retired = [p for p in out if set(p.replaces) == set(partial_ids)]
    assert retired, "the partials are named by what replaces them"
