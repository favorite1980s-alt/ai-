"""Validate the packaged English-Korean lexicon after pinned download."""
from pathlib import Path
import json
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
import prepare_dictionary as pd

path=Path(__file__).resolve().parents[1]/"extension"/"data"/"words.json"
assert path.exists(), "Bundled dictionary missing"
raw=path.read_bytes()
count=pd.validate(raw)
assert count>=48000
content=json.loads(raw)
assert isinstance(content["abandon"]["meaning_ko"],str)
print(f"Verified offline dictionary: {count:,} entries")
