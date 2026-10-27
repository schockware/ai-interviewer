# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
"""Turns the browser's container (WebM with Opus, from MediaRecorder) into 16 kHz mono PCM.

ffmpeg does the demuxing and decoding. For the live stream it runs as a child process fed on
stdin, chunk by chunk, writing PCM on stdout as it goes; a thread drains stdout into a buffer so
ffmpeg never blocks. Chunks must arrive in order and the first must carry the container header,
which is what MediaRecorder produces and the ingest guarantees.
"""

from __future__ import annotations

import shutil
import subprocess
import threading

import numpy as np

SAMPLE_RATE = 16_000
_BYTES_PER_SAMPLE = 2


class FfmpegNotFound(RuntimeError):
    pass


def _ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise FfmpegNotFound("ffmpeg is not on the PATH. The worker needs it to decode the browser's audio.")
    return path


def _command(source: str) -> list[str]:
    return [
        _ffmpeg(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostats",
        # Not "-fflags +nobuffer": on ffmpeg 9 it makes this command write nothing at all.
        # Probe briefly: by default ffmpeg reads five seconds of audio before it starts decoding a
        # pipe, which would hold the first partials back by as much.
        "-probesize",
        "65536",
        "-analyzeduration",
        "0",
        "-flags",
        "low_delay",
        "-i",
        source,
        "-vn",
        "-flush_packets",
        "1",
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        "-ac",
        "1",
        "-ar",
        str(SAMPLE_RATE),
        "pipe:1",
    ]


def to_float32(pcm: bytes) -> np.ndarray:
    """Little-endian 16-bit samples to the float32 in [-1, 1] the models take."""
    if len(pcm) % _BYTES_PER_SAMPLE:
        pcm = pcm[: len(pcm) - len(pcm) % _BYTES_PER_SAMPLE]
    return np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0


def decode_file(path: str) -> np.ndarray:
    """The whole file as float32 samples at 16 kHz mono."""
    done = subprocess.run(_command(path), stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if done.returncode != 0:
        raise RuntimeError(f"ffmpeg could not decode {path}: {done.stderr.decode(errors='replace').strip()}")
    return to_float32(done.stdout)


class StreamDecoder:
    """A live decode: feed() the container's chunks in order, take() the PCM decoded so far."""

    def __init__(self) -> None:
        self._process = subprocess.Popen(
            _command("pipe:0"),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        assert self._process.stdin and self._process.stdout and self._process.stderr
        self._lock = threading.Lock()
        self._pcm = bytearray()
        self._closed = False
        self._reader = threading.Thread(target=self._drain, name="ffmpeg-stdout", daemon=True)
        self._reader.start()

    def _drain(self) -> None:
        assert self._process.stdout
        while True:
            block = self._process.stdout.read(4096)
            if not block:
                return
            with self._lock:
                self._pcm.extend(block)

    def feed(self, chunk: bytes) -> None:
        """One container chunk, in order. Ignored once closed."""
        if self._closed or not chunk:
            return
        assert self._process.stdin
        try:
            self._process.stdin.write(chunk)
            self._process.stdin.flush()
        except (BrokenPipeError, OSError) as e:
            raise RuntimeError(f"ffmpeg stopped reading: {self.error() or e}") from e

    def take(self) -> np.ndarray:
        """Every sample decoded since the last take, as float32."""
        with self._lock:
            pcm = bytes(self._pcm)
            # Keep a dangling odd byte for the next take.
            keep = len(pcm) % _BYTES_PER_SAMPLE
            self._pcm = bytearray(pcm[len(pcm) - keep :]) if keep else bytearray()
        return to_float32(pcm[: len(pcm) - keep] if keep else pcm)

    def close(self, timeout: float = 10.0) -> np.ndarray:
        """No more chunks: lets ffmpeg flush, then returns whatever it still produced."""
        if not self._closed:
            self._closed = True
            assert self._process.stdin
            try:
                self._process.stdin.close()
            except OSError:
                pass
            self._process.wait(timeout=timeout)
            self._reader.join(timeout=timeout)
        return self.take()

    def error(self) -> str:
        """What ffmpeg complained about, once it has exited."""
        if self._process.poll() is None or not self._process.stderr:
            return ""
        try:
            return self._process.stderr.read().decode(errors="replace").strip()
        except (OSError, ValueError):
            return ""
