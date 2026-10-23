# ClipBox

[![CI](https://github.com/treeview-official/ClipBox/actions/workflows/ci.yml/badge.svg)](https://github.com/treeview-official/ClipBox/actions/workflows/ci.yml)

**복사한 모든 것을, 언제든 다시.**

텍스트·링크·이미지를 내 컴퓨터에 보관하고, 단축키로 찾아 다시 복사하는 데스크톱 클립보드 매니저입니다. 계정이나 서버 없이 동작합니다.

[설치 안내](docs/INSTALL.md) · [사용법](docs/GETTING_STARTED.md) · [화면 둘러보기](docs/SCREENSHOTS.md) · [업데이트·문의](docs/08_UPDATES.md) · [문서 모음](docs/README.md) · [플랫폼 지원](docs/07_CROSS_PLATFORM.md) · [변경 이력](CHANGELOG.md)

## 다운로드 · 바로 설치하기

**설치 파일만 받으면 됩니다. Node.js·npm을 따로 설치할 필요가 없습니다.**

| 내 컴퓨터 | ClipBox 1.2.0 다운로드 | 설치 방법 |
|---|---|---|
| Windows 10/11 · x64 | [**Windows 설치 파일**](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-Setup-1.2.0.exe) | `.exe` 실행 → 설치 → 시작 메뉴에서 ClipBox |
| Mac · Apple Silicon | [**Apple Silicon용 DMG**](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-mac-arm64.dmg) | DMG 열기 → Applications로 끌어다 놓기 |
| Mac · Intel | [**Intel용 DMG**](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-mac-x64.dmg) | DMG 열기 → Applications로 끌어다 놓기 |
| Linux · Ubuntu/Debian x64 | [**DEB 설치 파일**](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-linux-amd64.deb) | 파일을 소프트웨어 설치 앱으로 열기 |
| Linux · Fedora/RHEL x64 | [**RPM 설치 파일**](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-linux-x86_64.rpm) | 파일을 소프트웨어 설치 앱으로 열기 |

Mac 종류를 모르겠다면 **Apple 메뉴 → 이 Mac에 관하여**에서 칩 또는 Intel 프로세서를 확인하세요. Windows 개발자 인증서 서명과 Apple Developer ID 서명·공증이 없어 첫 실행 때 보안 확인이 추가될 수 있습니다. [OS별 설치와 보안 안내](docs/INSTALL.md)에 순서대로 정리했습니다. [전체 릴리스 파일](https://github.com/treeview-official/ClipBox/releases/tag/v1.2.0)

![ClipBox 1.2.0 — 기록 목록, 즐겨찾기와 상세 미리보기](docs/images/v1.2.0/history.png)

*ClipBox 1.2.0 실제 Windows 실행 화면입니다. 공개용 예시 기록을 사용하고 수집을 일시정지한 상태로 촬영했습니다.*

## 1.2의 새 기능

- 상단 기록 상태와 창 제어 버튼 정렬 개선
- **환경설정 → 업데이트 확인**에서 최신 버전 확인·다운로드·OS 설치 화면 연결
- **환경설정 아래 → 패치노트**에서 변경 내역 확인
- 요청사항·오류 문의: **tree_view@naver.com**

**1.0·1.1 사용자는 위 1.2 설치 파일로 한 번 설치하세요.** 그다음 버전부터 앱 안에서 업데이트를 확인할 수 있습니다. [업데이트 순서와 OS별 차이](docs/08_UPDATES.md)

## 화면으로 둘러보기

### 업데이트 확인과 문의

현재 버전과 GitHub에 공개된 최신 버전을 확인합니다. 요청사항·오류 문의 주소도 같은 화면에서 찾을 수 있습니다.

![ClipBox 1.2.0 — 실제 최신 버전 확인 결과와 문의 이메일](docs/images/v1.2.0/updates-and-contact.png)

| 패치노트 | 다크 테마 |
|---|---|
| [![앱 안에서 보는 버전별 패치노트](docs/images/v1.2.0/patch-notes.png)](docs/images/v1.2.0/patch-notes.png) | [![ClipBox 다크 테마의 기록 관리 화면](docs/images/v1.2.0/history-dark.png)](docs/images/v1.2.0/history-dark.png) |

[**퀵 팝업·환경설정·OS별 실제 실행 화면 더 보기 →**](docs/SCREENSHOTS.md)

## 주요 기능

- **기록 관리** — 텍스트·링크·PNG 이미지 수집, 원문 미리보기, 검색·유형 필터·정렬
- **빠른 접근** — 전역 단축키, 검색 자동 포커스, 방향키 선택과 Enter 재복사
- **즐겨찾기와 정리** — 즐겨찾기 보존, 저장 개수·보관 기간 설정, 삭제 확인
- **데스크톱 통합** — 트레이·macOS 메뉴 막대, 로그인 자동 실행, 일시정지
- **편안한 화면** — 한국어 UI, 라이트·다크·시스템 테마, 작은 창 대응
- **로컬 처리** — SQLite 저장, 재시작 후 기록 유지, 외부 전송 없음

## 플랫폼 지원 상태

현재 소스 버전은 **1.2.0**입니다. Windows·Mac 두 CPU·Ubuntu의 설치된 1.2 앱에서 시작과 새 업데이트·패치노트 화면 검사를 통과했습니다. [1.2 업데이트 안내](docs/08_UPDATES.md)

| 플랫폼 | 패키지 | 확인된 범위 |
|---|---|---|
| Windows x64 | NSIS `.exe` | 무인 설치 후 EXE 시작·최초 동의·업데이트·패치노트 UI 검사 통과 |
| macOS Apple Silicon / Intel | `.dmg` / `.zip` | macOS 15의 각 CPU에서 DMG 마운트·앱 복사 후 네이티브 시작 검사 통과 |
| Linux x64 | `.deb` / `.rpm` / `.tar.gz` | Ubuntu 24.04에서 DEB 설치 후 Xvfb/X11 시작 검사 통과. RPM은 생성·메타데이터 확인 |

1.2의 [패키지 CI](https://github.com/treeview-official/ClipBox/actions/runs/39910839386)의 네 작업이 모두 통과했습니다. 설치된 앱의 시작·보안 설정·한국어 글꼴·업데이트 버튼·패치노트·문의 주소·상단 정렬을 각 환경에서 확인했습니다.

Linux는 **X11 우선**입니다. Wayland의 백그라운드 클립보드 수집·전역 단축키·팝업 포커스는 데스크톱과 포털에 따라 제한됩니다. macOS·Linux의 실제 앱 간 클립보드·전역 단축키·로그인 자동 실행, Fedora/RHEL의 RPM 설치·실행, 대화형 설치·제거 흐름은 추가 검수 대상입니다. [상세 상태와 검수 항목](docs/07_CROSS_PLATFORM.md)을 확인하세요.

## 개발자용 · 소스에서 실행

Node.js **24 이상**, npm, 그래픽 데스크톱 환경이 필요합니다. 저장소 루트에서 실행합니다.

```sh
git clone https://github.com/treeview-official/ClipBox.git
cd ClipBox
npm ci
npm run dev
```

처음 실행하면 기록 수집 동의를 선택합니다. 동의 후 다른 앱에서 새 내용을 복사해 보세요.

| 동작 | Windows / Linux | macOS |
|---|---|---|
| 빠른 기록 열기 | Ctrl + Shift + V | ⌘ + Shift + V |
| 검색창 이동 | Ctrl + F | ⌘ + F |
| 선택 기록 복사 | Ctrl + C | ⌘ + C |
| 대상 앱에 붙여넣기 | Ctrl + V | ⌘ + V |

퀵 팝업에서는 ↑/↓로 선택하고 **Enter로 복사 후 닫기**, Esc로 닫기를 수행합니다. 자동 붙여넣기는 제공하지 않습니다. 설치·설정·전체 단축키는 [시작 가이드](docs/GETTING_STARTED.md)에 정리했습니다.

## 빌드와 검증

```sh
npm run typecheck
npm test
npm run build
```

| 명령 | 결과 |
|---|---|
| `npm run dist:win` | Windows x64 NSIS 설치 파일 |
| `npm run dist:mac` | Intel·Apple Silicon용 DMG + ZIP; macOS에서 실행 |
| `npm run dist:linux` | Linux x64 DEB·RPM·TAR.GZ; Linux에서 실행 |
| `npm run pack` | 현재 OS의 실행 폴더 |

산출물은 `release/1.2.0/`에 생성되며 Git 소스에는 포함하지 않습니다. `npm run dist`는 현재 OS를 선택하고, `npm run dist:linux:archive`는 TAR.GZ만 생성합니다. [CI](.github/workflows/ci.yml)는 main 푸시·PR에서 세 운영체제의 타입 검사·단위 검사·빌드를 실행합니다. [패키지 빌드 워크플로](.github/workflows/build-desktop.yml)는 설치 파일과 패키지 검증을 담당합니다. 최신 실행 결과는 [플랫폼 안내](docs/07_CROSS_PLATFORM.md)를 확인하세요.

**1.2 소스 검증:** [소스 CI](https://github.com/treeview-official/ClipBox/actions/runs/39910839190)에서 타입·빌드, Windows 단위 **48개 통과·POSIX 전용 2개 건너뜀**, macOS·Ubuntu **각 50개 통과**입니다. 로컬 실제 Electron 업데이트 UI **6개 시나리오**도 통과했습니다. 새 버전 다운로드와 설치 연결은 합성 데이터·대역 실행기로 검사했으며 실제 사용자 앱은 교체하지 않았습니다. [검증 범위](docs/08_UPDATES.md#검증)

**패키지 검증 방식:** 설치된 앱의 시작 검사는 네이티브 버전·아키텍처, 관리 창·제한된 IPC, 수집 OFF 상태의 최초 동의·빈 기록, sandbox와 번들 한국어 글꼴 로드를 확인합니다. 클립보드 수집이나 자동 시작을 켜지 않으며, 실제 앱 간 복사·붙여넣기 검수와 구분합니다. [플랫폼별 검증 범위](docs/07_CROSS_PLATFORM.md)에 자세히 기록했습니다.

## 개인정보와 저장

기록 수집은 **명시적으로 동의한 뒤** 시작합니다. 모든 기록은 로컬에 **평문**으로 저장하며, 비밀번호·카드번호·인증 토큰을 자동 제외하지 않습니다. 민감한 내용을 복사하기 전 기록을 끄거나 일시정지하세요.

기본값은 자동 시작 OFF, 백그라운드 유지 ON, 일반 기록 1,000개, 보관 30일입니다. 즐겨찾기는 자동 정리에서 제외됩니다. 저장 위치는 환경설정의 **정보**에서 확인할 수 있습니다. [저장 정책과 데이터 위치](docs/GETTING_STARTED.md#저장과-개인정보)를 참고하세요.

## 프로젝트 구조

```text
electron/       창·클립보드·저장소·OS 통합·제한된 IPC
src/            React 화면과 스타일
shared/         공통 타입과 플랫폼별 단축키 처리
tests/          저장소·수집·플랫폼 단위 검사
scripts/        개발·빌드·데스크톱 검증
docs/           사용법·명세·검증 기록
design/mockups/ 원본 UI 참고 시안
artifacts/qa/   실제 테스트 화면과 결과
```

Electron 45, React 19, TypeScript, Vite, 내장 `node:sqlite`를 사용합니다. `contextIsolation`, sandbox, CSP를 적용하고 렌더러의 직접 Node 접근과 외부 탐색을 제한합니다.

## 라이선스

현재 [package.json](package.json)의 라이선스 표기는 `UNLICENSED`이며, 별도의 오픈소스 라이선스를 부여하지 않습니다.

한국어 표시용 Noto Sans KR은 별도의 SIL Open Font License 1.1로 제공되며 앱에 로컬로 포함됩니다. [제삼자 저작물과 글꼴 라이선스](THIRD_PARTY_NOTICES.md)를 확인하세요.
