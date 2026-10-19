# Third-party notices
The audio capture architecture and offscreen.js were adapted from:
- **Kami Subs**, Copyright (c) 2026 Mohamed Keba, MIT.
  https://github.com/MohammdKopa/kami-subs
  Full MIT notice: [licenses/KAMI_SUBS_MIT.txt](licenses/KAMI_SUBS_MIT.txt)
The clickable word and vocabulary learning workflow was informed by:
- **Sublens**, Copyright (c) 2026 Sublens, MIT.
  https://github.com/MatteoLucerni/sublens-extension
  No Sublens source code is copied into this MVP. The license is preserved for clarity.
Both projects are independent; this project is not affiliated with their authors.
Whisper model downloads are subject to the respective model licenses. Python packages retain their upstream licenses.

## Offline English-Korean Dictionary data (CC BY-SA 4.0)

- Source: [Open English-Korean Dictionary](https://github.com/jhseo1211/open-english-korean-dict), 48,037 entries (English -> Korean).
- Pinned commit: `92cbfe63deee1ccead2c42677027d8b4a305b2c7`
- Original Git blob SHA-1 (words.json): `a85a6be6fcba3e84eee7dd838febb73da78eb6b2`
- Source data license: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
- This is **data**, not re-licensed as MIT. The application source is MIT; bundled original data is **CC BY-SA 4.0**.
- Attribution from original author and upstream data sources is included in `licenses/OPEN_EN_KO_DICTIONARY_CREDITS.md`.
- Original data is downloaded and integrity-checked as-is during Windows setup or GitHub Actions packaging.
