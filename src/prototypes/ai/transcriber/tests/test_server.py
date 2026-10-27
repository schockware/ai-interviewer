# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified. Claude-written tests; none count as verified.
"""Both services over a real in-process gRPC server, with the fake model."""

from __future__ import annotations

import asyncio

import grpc
import pytest

from transcriber.config import ModelSettings, Settings
from transcriber.generated import transcription_pb2 as pb
from transcriber.generated import transcription_pb2_grpc as rpc
from transcriber.models import FakeTranscriber
from transcriber.server import build_server

SETTINGS = Settings(
    port=0,
    language="en",
    realtime=ModelSettings("fake", "none", "none"),
    post_question=ModelSettings("fake", "none", "none"),
    step_seconds=1.0,
    window_seconds=4.0,
)


@pytest.fixture
async def channel():
    server = build_server(FakeTranscriber("live"), FakeTranscriber("post"), SETTINGS)
    port = server.add_insecure_port("127.0.0.1:0")
    await server.start()
    async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as ch:
        yield ch
    await server.stop(grace=None)


async def test_health_names_the_models(channel):
    live = await rpc.RealTimeTranscriberStub(channel).Health(pb.HealthRequest())
    post = await rpc.PostQuestionTranscriberStub(channel).Health(pb.HealthRequest())
    assert live.ready and live.model == "fake"
    assert post.ready and post.device == "none"


async def test_streaming_webm_in_chunks_yields_partials_then_finals(channel, three_second_webm):
    def chunks():
        size = 4096
        for n, i in enumerate(range(0, len(three_second_webm), size), start=1):
            yield pb.AudioChunk(session_id="s1", question_id="q1", mime_type="audio/webm;codecs=opus", sequence=n, data=three_second_webm[i : i + size])

    async def send():
        for c in chunks():
            yield c
            await asyncio.sleep(0.02)

    got = [m async for m in rpc.RealTimeTranscriberStub(channel).Transcribe(send())]
    assert got, "no segments at all"
    assert all(m.session_id == "s1" and m.question_id == "q1" for m in got)
    assert all(m.model == "realtime:fake" for m in got)
    finals = [m for m in got if m.final]
    assert finals, "finish() must make the end final"
    assert [m.text for m in finals if m.text][-3:] == ["live1", "live2", "live3"]


async def test_the_post_question_pass_reads_the_whole_file(channel, tmp_path, three_second_wav):
    path = tmp_path / "audio.wav"
    path.write_bytes(three_second_wav)
    got = [m async for m in rpc.PostQuestionTranscriberStub(channel).TranscribeFile(pb.TranscribeFileRequest(session_id="s1", question_id="q1", path=str(path)))]
    assert [m.text for m in got] == ["post1", "post2", "post3"]
    assert all(m.final for m in got)
    assert got[0].model == "post:fake"


async def test_a_missing_file_is_not_found(channel):
    with pytest.raises(grpc.aio.AioRpcError) as e:
        async for _ in rpc.PostQuestionTranscriberStub(channel).TranscribeFile(pb.TranscribeFileRequest(session_id="s1", question_id="q1", path="nowhere.wav")):
            pass
    assert e.value.code() == grpc.StatusCode.NOT_FOUND
