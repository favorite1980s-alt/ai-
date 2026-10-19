"""Build deterministic ZIP with verified dictionary and required runtime assets."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from prepare_dictionary import validate

ROOT=Path(__file__).resolve().parent.parent
REQUIRED=[
"extension/manifest.json", "extension/background.js", "extension/content.js",
"extension/content.css", "extension/lexicon.js","extension/data/words.json",
"extension/offscreen.html","extension/offscreen.js","extension/popup.html",
"extension/popup.css","extension/popup.js","backend/server.py",
"backend/requirements.txt","install.bat","install-windows.ps1",
"start-server.bat","README.md","LICENSE","THIRD_PARTY_NOTICES.md",
"licenses/KAMI_SUBS_MIT.txt","licenses/OPEN_EN_KO_DICTIONARY_CREDITS.md",
"tools/prepare_dictionary.py",
]
OUTPUT=ROOT/"Movie-English-Study-Windows-MVP.zip"
def main():
    dictionary=(ROOT/"extension/data/words.json").read_bytes()
    entries=validate(dictionary)
    m=json.loads((ROOT/"extension/manifest.json").read_text(encoding="utf-8"))
    assert m["manifest_version"]==3
    assert m["version"]=="0.4.0", "Manifest/version mismatch"
    for file in REQUIRED:
        assert (ROOT/file).is_file(), f"Package missing {file}"
    with ZipFile(OUTPUT,'w',ZIP_DEFLATED) as z:
        for folder in ("extension","backend","licenses","tools"):
            for file in sorted((ROOT/folder).rglob("*")):
                if file.is_file() and "__pycache__" not in file.parts and file.suffix not in (".pyc",):
                    z.write(file,file.relative_to(ROOT).as_posix())
        for name in ("install.bat","install-windows.ps1","start-server.bat","README.md","LICENSE","THIRD_PARTY_NOTICES.md"):
            z.write(ROOT/name,name)
    with ZipFile(OUTPUT) as z:
        assert z.testzip() is None
        assert set(REQUIRED).issubset(set(z.namelist()))
        assert validate(z.read("extension/data/words.json"))==entries
    print(f"PASS verified Windows ZIP: {entries:,} dictionary entries; {OUTPUT.stat().st_size:,} bytes")
if __name__=="__main__":
    main()
