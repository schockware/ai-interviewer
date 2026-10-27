# Authored by Claude Fable 5.1 (Anthropic), with Steven Chock as co-author. Prototype zone: unverified.
"""The gRPC server: both transcribers in one process. `python -m transcriber.server`."""

from __future__ import annotations

import asyncio
import logging
import signal
import sys

import grpc

from .config import Settings
from .generated import transcription_pb2 as pb
from .generated import transcription_pb2_grpc as rpc
from .models import Transcriber, WhisperTranscriber
from .post_question import transcribe_file
from .realtime import RealtimeSession, Segment

log = logging.getLogger("transcriber")

POLL_SECONDS = 0.25


def _segment_message(session_id: str, question_id: str, seg: Segment, model, source: str) -> pb.TranscriptSegment:
    return pb.TranscriptSegment(
        session_id=session_id,
        question_id=question_id,
        id=seg.id,
        start_seconds=seg.start,
        end_seconds=seg.end,
        text=seg.text,
        final=seg.final,
        replaces=list(seg.replaces),
        model=f"{source}:{model.model}",
        device=model.device,
    )


def _health(transcriber: Transcriber) -> pb.HealthReply:
    info = transcriber.info()
    return pb.HealthReply(ready=True, model=info.model, device=info.device, compute_type=info.compute_type, detail="")


class RealTimeService(rpc.RealTimeTranscriberServicer):
    def __init__(self, transcriber: Transcriber, settings: Settings) -> None:
        self._transcriber = transcriber
        self._settings = settings

    async def Health(self, request, context):  # noqa: N802 - gRPC naming
        return _health(self._transcriber)

    async def Transcribe(self, request_iterator, context):  # noqa: N802 - gRPC naming
        session = RealtimeSession(
            self._transcriber,
            language=self._settings.language,
            step_seconds=self._settings.step_seconds,
            window_seconds=self._settings.window_seconds,
        )
        out: asyncio.Queue[pb.TranscriptSegment | None] = asyncio.Queue()
        ids = {"session": "", "question": ""}
        info = self._transcriber.info()

        async def pump() -> None:
            """Reads chunks and polls the model between them, in a worker thread so the loop stays free."""
            try:
                stream_done = asyncio.Event()

                async def read() -> None:
                    try:
                        async for chunk in request_iterator:
                            ids["session"], ids["question"] = chunk.session_id, chunk.question_id
                            await asyncio.to_thread(session.push, chunk.data)
                    finally:
                        stream_done.set()

                reader = asyncio.create_task(read())
                while not stream_done.is_set():
                    for seg in await asyncio.to_thread(session.poll):
                        await out.put(_segment_message(ids["session"], ids["question"], seg, info, "realtime"))
                    try:
                        await asyncio.wait_for(stream_done.wait(), POLL_SECONDS)
                    except asyncio.TimeoutError:
                        pass
                await reader
                for seg in await asyncio.to_thread(session.finish):
                    await out.put(_segment_message(ids["session"], ids["question"], seg, info, "realtime"))
            except Exception as e:  # noqa: BLE001 - the error reaches the client as the call's status
                log.exception("real-time transcription failed")
                await context.abort(grpc.StatusCode.INTERNAL, f"Transcription failed: {e}")
            finally:
                await out.put(None)

        task = asyncio.create_task(pump())
        try:
            while True:
                message = await out.get()
                if message is None:
                    break
                yield message
        finally:
            if not task.done():
                task.cancel()


class PostQuestionService(rpc.PostQuestionTranscriberServicer):
    def __init__(self, transcriber: Transcriber, settings: Settings) -> None:
        self._transcriber = transcriber
        self._settings = settings

    async def Health(self, request, context):  # noqa: N802 - gRPC naming
        return _health(self._transcriber)

    async def TranscribeFile(self, request, context):  # noqa: N802 - gRPC naming
        try:
            pieces = await asyncio.to_thread(transcribe_file, request.path, self._transcriber, language=self._settings.language)
        except FileNotFoundError as e:
            await context.abort(grpc.StatusCode.NOT_FOUND, str(e))
            return
        except Exception as e:  # noqa: BLE001
            log.exception("post-question transcription failed")
            await context.abort(grpc.StatusCode.INTERNAL, f"Transcription failed: {e}")
            return
        info = self._transcriber.info()
        for n, piece in enumerate(pieces, start=1):
            yield _segment_message(request.session_id, request.question_id, Segment(f"pq-{n}", piece.start, piece.end, piece.text, True), info, "post")


def build_server(realtime: Transcriber, post_question: Transcriber, settings: Settings) -> grpc.aio.Server:
    server = grpc.aio.server(options=[("grpc.max_receive_message_length", 64 * 1024 * 1024)])
    rpc.add_RealTimeTranscriberServicer_to_server(RealTimeService(realtime, settings), server)
    rpc.add_PostQuestionTranscriberServicer_to_server(PostQuestionService(post_question, settings), server)
    return server


async def serve(settings: Settings) -> None:
    realtime = WhisperTranscriber(settings.realtime)
    post = WhisperTranscriber(settings.post_question)
    server = build_server(realtime, post, settings)
    server.add_insecure_port(f"127.0.0.1:{settings.port}")
    await server.start()
    log.info("listening on 127.0.0.1:%d; loading models", settings.port)
    # Warm up after the port is open, so the coordinator can see the process while the models load.
    await asyncio.to_thread(realtime.warm_up)
    await asyncio.to_thread(post.warm_up)
    log.info("ready: realtime %s, post-question %s", realtime.info(), post.info())

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass  # Windows: Ctrl+C raises KeyboardInterrupt instead
    try:
        await stop.wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    await server.stop(grace=2)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    try:
        asyncio.run(serve(Settings.from_env()))
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
