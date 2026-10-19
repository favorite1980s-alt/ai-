# Movie English Study 🎬 — 영어 영화 학습 / Windows + Chrome

**무료 로컬 영어 음성 자막 + 클릭 영한 사전 + 단어장** (개발용 MVP 0.1.0)

- HTML5 영화 재생 탭에서 영어 음성을 인식하여 영어 자막을 표시합니다.
- 영어 자막의 단어를 클릭하면 한국어 뜻과 영어 발음을 제공합니다.
- 저장한 단어는 PC 브라우저 내부에 보관되며 TSV 파일로 내보낼 수 있습니다.
- 기본 영한 사전 337개 단어 + 사용자 영한 TSV 사전 가져오기를 지원합니다.
- 사이트에 이미 있는 한글 자막은 변경하지 않습니다. 영어 자막은 화면 위쪽에 별도로 표시됩니다.
- **유료 OpenAI/Gemini API, 로그인, 외부 음성 업로드가 없습니다.** 최초 Whisper 모델과 Python 패키지 다운로드 시 인터넷 연결은 필요합니다.

> **개발 현황:** 소스코드와 설치 스크립트가 준비된 **시험판**입니다. Windows/Chrome 실제 설치, 특정 영화 사이트, 실시간 GPU 지연 및 DRM 호환성 테스트는 별도로 진행해야 합니다. 동작을 검증하지 않은 항목을 '완료'로 간주하지 마세요.

## 빠른 설치 (Windows 11, Chrome)

### 1. GitHub ZIP을 PC로 옮기기

GitHub 저장소에서 **Code → Download ZIP** → 압축 해제합니다. `extension/` 폴더가 보이는 위치가 프로젝트 폴더입니다.

Python **3.10 이상**을 설치하고 터미널에서 `py --version` 또는 `python --version`으로 확인하세요.

### 2. 무료 음성 인식 서버 설치 (최초 1회)

압축 푼 폴더의 PowerShell에서:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```

설치 스크립트는 프로젝트 내부 `.venv` 가상환경만 만들고 `pip` 패키지를 설치합니다. 관리자 권한이 필요하지 않습니다. PC 사용 환경에 따라 패키지 설치에 시간이 걸립니다.

### 3. 서버 시작

`start-server.bat`을 더블클릭합니다.

- 콘솔 창을 **계속 열어 두세요.** 닫으면 자막 인식이 중지됩니다.
- 서버 주소는 로컬 PC `ws://127.0.0.1:8765/ws`입니다.
- 모델은 기본 `small`이고 **첫 음성 인식 때 모델 가중치를 다운로드**합니다.
- CUDA 지원 GPU라도 라이브러리 설치 상황에 따라 CPU로 실행될 수 있으며, 속도는 PC에서 확인해야 합니다.
- 브라우저에 `http://127.0.0.1:8765/health`를 입력해 서버 작동 여부를 확인할 수 있습니다.

### 4. 크롬에 확장 프로그램 등록

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드 ON**
3. **압축해제된 확장 프로그램을 로드합니다** 선택
4. 압축해제 폴더 안의 **`extension` 폴더** 선택
5. 크롬에서 영화를 재생한 탭으로 이동 → 확장 프로그램 아이콘 클릭 → **영어 자막 시작**

Windows 실시간 자막(Win+Ctrl+L)이 별도로 떠 있다면 중복되지 않도록 끌 수 있습니다.

### 5. 클릭 사전 먼저 시험해 보기 (서버 없이 가능)

영화 탭에서 확장 프로그램 팝업 → **예시 자막으로 단어 클릭 시험**을 누릅니다.

화면 위쪽 영어 자막의 `somewhere`를 누르면 "어딘가, 어느 곳에"라는 한국어 뜻이 표시되어야 합니다. **발음** 버튼과 **☆ 저장** 버튼도 시험하세요.

## 개인 영한 사전 가져오기

팝업 → **영어↹한국어 사전 가져오기**. 탭 또는 쉼표 구분 텍스트(`.tsv`, `.txt`, `.csv`) 지원.

```tsv
somewhere	어딘가, 어느 곳에
extraordinary	비범한, 놀라운
deadline	마감일
```

- 2MB 이하, 최대 5000개 단어를 한 번에 읽습니다.
- 사용자 사전이 기본 사전보다 우선합니다.
- 저장 데이터는 Chrome 로컬 스토리지에 보관되며, 확장 프로그램 삭제 시 사라질 수 있습니다. 주기적으로 단어장 TSV를 내보내세요.
- MVP 기본 사전은 일상 대화 337개 정도만 제공합니다. 모든 단어의 뜻을 자동으로 제공하는 완전한 사전은 **아닙니다**.

## 구조

```text
[Chrome movie tab audio]
     ↓ tabCapture / offscreen (2s PCM chunks)
[127.0.0.1:8765/ws → faster-whisper, English STT]
     ↓ text only, via Chrome message
[clickable English overlay (upper screen)]
     ↙︎                ↘︎
[offline glossary]  [saved vocabulary → TSV]
[existing Korean subtitle stays in the original player]
```

## 비용 및 개인정보

| 항목 | 기본 방식 |
|---|---|
| 영어 음성 인식 | `faster-whisper` 로컬 실행 / 무료 |
| 영한 단어 뜻 | 내장 사전 / 사용자가 추가한 사전 / 무료 |
| 단어 발음 | Chrome/Windows 음성 합성 / 무료 |
| 단어 저장 | `chrome.storage.local` / 무료 |
| 유료 클라우드 API | 사용하지 않음 |
| 첫 설치·모델 다운로드 | 인터넷 연결 필요 |
| 음성 데이터 | 루프백 WebSocket으로 전달, 외부 서비스에 업로드하는 코드 없음 |

**웹사이트와 DRM 제한:** 암호화된 사이트에서는 Chrome 탭 오디오 캡처가 무음 또는 오류일 수 있습니다. 영상이 실행되는 사이트, 브라우저 버전, 전체화면 구현에 따라 오버레이가 보이지 않을 수 있습니다. DRM 우회 기능은 제공하지 않습니다. 저작권 및 사이트 이용 약관을 준수하세요.

## 개발 단계와 테스트

- GitHub Actions: Python 문법 검사, Manifest JSON 검사, JS 문법 검사, 내장 단어 사전 테스트
- Windows 실제 브라우저: **미검증** (설치 → 마이크가 아닌 탭 오디오 → 음성 변환 → 단어 클릭 → 저장 순서로 수동 시험 필요)
- 자막 시간 정확도·GPU 실시간성·한글 자막과의 간섭: **미검증**
- 현 버전은 단일 탭, 단일 영어 음성 인식 서버만 지원합니다.
- `offscreen.js`는 원본 Kami Subs의 캡처 구조를 적법하게 수정하여 사용합니다. 다른 파일은 MVP에 맞춰 새로 구성했습니다.

## 원본 프로젝트 / 라이선스

- [Kami Subs](https://github.com/MohammdKopa/kami-subs) — MIT, 원저작권 및 라이선스 포함
- [Sublens](https://github.com/MatteoLucerni/sublens-extension) — MIT, 단어 클릭 학습 UX 참고 (Sublens 코드 복제 없음)
- 자세한 내용은 `THIRD_PARTY_NOTICES.md` 및 `licenses/KAMI_SUBS_MIT.txt`를 참조하세요.

## 다음 버전

1. 실제 Chrome/Windows 오디오 캡처 검증 및 WebSocket 로컬 접속 문제 해결
2. 단어장 검색·수정, 예문, 자동 복습
3. 검증된 라이선스의 대형 오프라인 영한사전 연결
4. 전체화면 플레이어별 자막 위치 자동 보정
5. Windows 원클릭 설치/실행파일 생성과 보안 점검
