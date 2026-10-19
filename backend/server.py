"""Local-only English transcription server for Movie English Study.

Protocol based on Kami Subs' tab audio / WebSocket design (MIT).
The server does NOT call a translation API or upload speech to a service.
A Whisper model download is needed on first use.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("movie-english-study")

HOST = "127.0.0.1"
PORT = 8765
MODEL = os.getenv("MES_MODEL", "small")
DEVICE = os.getenv("MES_DEVICE", "auto")
# CTranslate2 auto device choice works with int8 across CPU and supported CUDA GPUs.
COMPUTE = os.getenv("MES_COMPUTE", "int8")
SAMPLE_RATE = 16000
MAX_QUEUE = 2
app = FastAPI(title="Movie English Study Local Whisper", docs_url=None, redoc_url=None)


@lru_cache(maxsize=1)
def whisper_model() -> WhisperModel:
    log.info("Loading Whisper model=%s device=%s compute=%s", MODEL, DEVICE, COMPUTE)
    return WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE)


def transcribe(pcm: bytes) -> str:
    if not pcm or len(pcm) % 2:
        return ""
    audio = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
    # Reject silent packets before loading the model; also avoids silence hallucinations.
    if len(audio) < SAMPLE_RATE // 2 or float(np.sqrt(np.mean(audio * audio))) < 0.006:
        return ""
    segments, _ = whisper_model().transcribe(
        audio, language="en", task="transcribe", beam_size=1,
        condition_on_previous_text=False, vad_filter=False
    )
    return " ".join(s.text.strip() for s in segments).strip()


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "local": True, "model": MODEL}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    origin = ws.headers.get("origin", "")
    # Offscreen Chrome extension uses chrome-extension://<id>, not a regular webpage.
    if not origin.startswith("chrome-extension://"):
        await ws.close(code=1008)
        return
    await ws.accept()
    queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=MAX_QUEUE)

    async def producer() -> None:
        try:
            first = await ws.receive_text()
            config = json.loads(first)
            if config.get("type") != "config" or config.get("task") != "transcribe":
                await ws.send_json({"type": "error", "message": "English transcription mode only"})
                return
            while True:
                packet = await ws.receive()
                if packet.get("type") == "websocket.disconnect":
                    break
                raw = packet.get("bytes")
                if not raw:
                    continue
                if queue.full():
                    try: queue.get_nowait()  # drop stale audio instead of increasing latency
                    except asyncio.QueueEmpty: pass
                queue.put_nowait(raw)
        except (WebSocketDisconnect, ValueError, json.JSONDecodeError):
            pass
        finally:
            if queue.full():
                try: queue.get_nowait()
                except asyncio.QueueEmpty: pass
            await queue.put(None)

    async def consumer() -> None:
        try:
            while True:
                audio = await queue.get()
                if audio is None:
                    break
                try:
                    text = await asyncio.to_thread(transcribe, audio)
                    if text:
                        await ws.send_json({"type": "transcript", "text": text, "isFinal": True})
                except Exception as exc:
                    log.exception("Transcription error")
                    await ws.send_json({"type":"error","message":"Local Whisper transcription failed: " + str(exc)[:160]})
        except (WebSocketDisconnect, RuntimeError, OSError):
            pass

    producer_task = asyncio.create_task(producer())
    consumer_task = asyncio.create_task(consumer())
    try:
        await producer_task
        await consumer_task
    finally:
        for task in (producer_task, consumer_task):
            if not task.done(): task.cancel()
        try: await ws.close()
        except (RuntimeError, OSError): pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
