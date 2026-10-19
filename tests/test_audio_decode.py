"""Regression test for PyAV/faster-whisper WAV decoding compatibility."""
import tempfile
import wave
from pathlib import Path

import numpy as np
from faster_whisper.audio import decode_audio


def main() -> None:
    sample_rate = 16_000
    samples = (np.sin(np.arange(sample_rate) * 2 * np.pi * 440 / sample_rate) * 8000)
    pcm = samples.astype("<i2").tobytes()
    with tempfile.TemporaryDirectory() as folder:
        audio_path = Path(folder) / "compatibility.wav"
        with wave.open(str(audio_path), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(sample_rate)
            output.writeframes(pcm)
        decoded = decode_audio(str(audio_path), sampling_rate=sample_rate)
    assert decoded.dtype == np.float32
    assert decoded.shape == (sample_rate,), decoded.shape
    assert float(np.max(np.abs(decoded))) > 0.1
    print("PASS faster-whisper WAV decode with PyAV", __import__("av").__version__)


if __name__ == "__main__":
    main()
