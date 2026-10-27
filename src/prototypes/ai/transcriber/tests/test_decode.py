# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
from __future__ import annotations

import time

from transcriber.decode import SAMPLE_RATE, StreamDecoder, decode_file, to_float32


def test_pcm_bytes_become_floats_in_range():
    samples = to_float32(b"\x00\x00\xff\x7f\x00\x80")
    assert samples.tolist() == [0.0, 32767 / 32768, -1.0]


def test_an_odd_trailing_byte_is_dropped():
    assert len(to_float32(b"\x00\x00\x01")) == 1


def test_a_whole_file_decodes_to_sixteen_khz_mono(tmp_path, three_second_wav):
    path = tmp_path / "tone.wav"
    path.write_bytes(three_second_wav)
    audio = decode_file(str(path))
    assert abs(len(audio) / SAMPLE_RATE - 3.0) < 0.05
    assert audio.dtype.name == "float32"
    assert 0.2 < float(abs(audio).max()) <= 1.0


def test_a_stream_fed_in_chunks_decodes_as_it_goes(three_second_webm):
    # WebM with Opus, as the browser sends it. (A WAV through a pipe is held by ffmpeg until the end; the browser never sends one.)
    decoder = StreamDecoder()
    half = len(three_second_webm) // 2
    decoder.feed(three_second_webm[:half])
    deadline = time.time() + 5
    got = 0
    while got == 0 and time.time() < deadline:
        got = len(decoder.take())
        time.sleep(0.05)
    assert got > 0, "nothing decoded from the first half"
    decoder.feed(three_second_webm[half:])
    rest = decoder.close()
    assert abs((got + len(rest)) / SAMPLE_RATE - 3.0) < 0.15
