"""Download a pinned CC BY-SA 4.0 English→Korean dictionary for offline Chrome use.

The Git *blob* SHA is checked to ensure immutable data, not just a public URL.
This is a one-time installation step. Python standard library only.
"""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen

COMMIT = "92cbfe63deee1ccead2c42677027d8b4a305b2c7"
BLOB_SHA1 = "a85a6be6fcba3e84eee7dd838febb73da78eb6b2"
SOURCE = f"https://raw.githubusercontent.com/jhseo1211/open-english-korean-dict/{COMMIT}/dict/words.json"
OUTPUT = Path(__file__).resolve().parents[1] / "extension" / "data" / "words.json"
MIN_WORDS = 48000
MAX_BYTES = 15_000_000


def git_blob_sha(payload: bytes) -> str:
    return hashlib.sha1(f"blob {len(payload)}\0".encode() + payload).hexdigest()


def validate(payload: bytes) -> int:
    if len(payload) > MAX_BYTES:
        raise ValueError("Dictionary data is unexpectedly large")
    if git_blob_sha(payload) != BLOB_SHA1:
        raise ValueError("Dictionary SHA-1 does not match pinned GitHub source")
    content = json.loads(payload)
    if not isinstance(content, dict) or len(content) < MIN_WORDS:
        raise ValueError("Dictionary has fewer than 48,000 valid entries")
    for word in ("abandon", "hello", "world"):
        item = content.get(word)
        if not isinstance(item, dict) or not isinstance(item.get("meaning_ko"), str):
            raise ValueError(f"Missing/invalid Korean definition: {word}")
    return len(content)


def main() -> int:
    if OUTPUT.exists():
        try:
            entries = validate(OUTPUT.read_bytes())
            print(f"Dictionary already installed: {entries:,} entries")
            return 0
        except (OSError, ValueError, json.JSONDecodeError):
            print("Existing dictionary invalid; downloading pinned original")
    try:
        with urlopen(SOURCE, timeout=60) as response:
            raw = response.read(MAX_BYTES + 1)
        entries = validate(raw)
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=OUTPUT.parent, prefix="words_", suffix=".tmp", delete=False) as handle:
            tmp=Path(handle.name)
            handle.write(raw)
        tmp.replace(OUTPUT)
        print(f"Verified {entries:,} offline English-Korean entries (CC BY-SA 4.0)")
        return 0
    except Exception as error:
        print(f"Dictionary setup failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
