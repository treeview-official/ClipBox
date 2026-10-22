# ClipBox · Codex 개발 인수인계 패키지

Windows용 클립보드 기록 관리 데스크톱 앱을 제작하기 위한 **기획·UI 참고 시안·구현 지침** 패키지입니다.

> 주의: 이 ZIP은 이미 완성된 실행 프로그램이 아닙니다. 코덱스가 코드를 작성할 수 있도록 제공하는 **개발용 자료**입니다.

## 가장 쉬운 시작 방법 (Windows)

1. 이 ZIP을 내려받고 `C:\Projects\ClipBox` 같은 새 폴더에 압축 해제합니다.
2. Codex 앱 또는 VS Code의 Codex 확장 프로그램에서 **압축 해제한 프로젝트 폴더**를 엽니다. CLI를 사용한다면 해당 폴더에서 `codex`를 실행합니다.
3. `CODEX_START_PROMPT.md`의 내용을 코덱스 대화창에 그대로 붙여넣습니다.
4. 코덱스에 `AGENTS.md`, `docs/`의 문서, `design/mockups/`의 참고 이미지를 함께 읽고 구현하도록 합니다.
5. 구현 후 코덱스가 작성하는 README에 따라 의존성을 설치하고 실행/빌드/테스트합니다.

## 폴더 구성

```text
ClipBox-Codex-Handoff/
├── README.md                    # 지금 읽고 있는 파일
├── CODEX_START_PROMPT.md       # 코덱스 최초 입력 프롬프트
├── AGENTS.md                   # 코덱스 프로젝트 작업 규칙
├── docs/
│   ├── 01_PRODUCT_SPEC.md      # 요구사항과 사용자 흐름
│   ├── 02_DESIGN_SYSTEM.md     # 디자인 시스템과 화면 상세 명세
│   ├── 03_ARCHITECTURE.md      # 기술 구조, 데이터 모델, 보안
│   ├── 04_IMPLEMENTATION.md    # 단계별 작업 계획 및 완료 정의
│   └── 05_QA_CHECKLIST.md      # 검수 체크리스트
└── design/mockups/
    ├── 01-history-manager.png
    ├── 02-quick-popup.png
    ├── 03-settings.png
    └── 04-developer-handoff-board.png
```

## 이미지 사용 안내

이미지는 최종 레이아웃을 설명하기 위한 **시각적 레퍼런스**입니다. 편집 가능한 Figma 파일이 아닙니다. 목업에 표시된 숫자, 시간, 카운트, 단축키 표기, 텍스트는 예시이며 실제 구현의 정답은 아래 명세 문서입니다. 특히 자동 붙여넣기·민감정보 탐지 관련 허위 확신을 표시하지 마세요.

## 권장 개발 환경

- Windows 10/11, Node.js LTS, npm, Git
- Electron + React + TypeScript + Vite
- SQLite (`better-sqlite3` 등 Electron 런타임과 호환되는 방식)
- Electron Forge 또는 electron-builder로 Windows 설치 패키지

모든 데이터는 기본적으로 **로컬에서만 처리**하고, 클라우드 전송·외부 API·로그 전송 기능은 만들지 않습니다.
