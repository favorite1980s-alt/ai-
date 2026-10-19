"""Mocked WebSocket pipeline test. Does not download/execute Whisper weights."""
import json
import sys
import types
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

class FakeWhisper:
    def __init__(self,*args,**kwargs):
        pass
    def transcribe(self, audio, **kwargs):
        assert kwargs["task"] == "transcribe"
        assert kwargs["language"] == "en"
        assert len(audio) >= 16000
        return [types.SimpleNamespace(text="Let's go somewhere.")], {}

sys.modules["faster_whisper"] = types.SimpleNamespace(WhisperModel=FakeWhisper)
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"))
import server

client=TestClient(server.app)
assert client.get("/health").json()["local"] is True

# Offscreen-origin local audio succeeds and produces a clickable English line.
with client.websocket_connect("/ws",headers={"origin":"chrome-extension://abcdefghijklmnop"}) as ws:
    ws.send_text(json.dumps({"type":"config","sampleRate":16000,"task":"transcribe"}))
    sample=(np.ones(32000)*0.2*32767).astype("<i2").tobytes()
    ws.send_bytes(sample)
    result=ws.receive_json()
    assert result=={"type":"transcript","text":"Let's go somewhere.","isFinal":True},result

# A normal web origin cannot access the local transcription endpoint.
try:
    with client.websocket_connect("/ws",headers={"origin":"https://malicious.example"}) as ws:
        ws.receive_json()
    raise AssertionError("WebSocket should reject non-extension origins")
except WebSocketDisconnect:
    pass
print("Mocked local WebSocket transcription protocol tests passed")
