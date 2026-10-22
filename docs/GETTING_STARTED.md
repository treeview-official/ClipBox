# 시작 가이드

[설치 안내](INSTALL.md) · [프로젝트 소개](../README.md) · [문서 모음](README.md) · [플랫폼 안내](07_CROSS_PLATFORM.md)

## 설치 파일로 시작하기

**ClipBox를 사용하려면 설치 파일만 받으면 됩니다. Node.js나 npm은 필요하지 않습니다.**

| 내 컴퓨터 | 다운로드 |
|---|---|
| Windows x64 | [Windows 설치 파일](https://github.com/treeview-official/ClipBox/releases/download/v1.1.0/ClipBox-Setup-1.1.0.exe) |
| Mac Apple Silicon | [Apple Silicon용 DMG](https://github.com/treeview-official/ClipBox/releases/download/v1.1.0/ClipBox-1.1.0-mac-arm64.dmg) |
| Mac Intel | [Intel용 DMG](https://github.com/treeview-official/ClipBox/releases/download/v1.1.0/ClipBox-1.1.0-mac-x64.dmg) |
| Ubuntu/Debian 계열 x64 | [Linux DEB 설치 파일](https://github.com/treeview-official/ClipBox/releases/download/v1.1.0/ClipBox-1.1.0-linux-amd64.deb) |
| Fedora/RHEL 계열 x64 | [Linux RPM 설치 파일](https://github.com/treeview-official/ClipBox/releases/download/v1.1.0/ClipBox-1.1.0-linux-x86_64.rpm) |

Windows는 설치 파일을 실행하고, Mac은 DMG에서 ClipBox를 Applications로 옮깁니다. Linux는 파일을 소프트웨어 설치 앱으로 엽니다. CPU 종류 확인과 처음 실행할 때의 보안 안내는 [단계별 설치 가이드](INSTALL.md)를 따라 주세요. 서명·공증 상태와 배포판별 실제 검증 범위는 [플랫폼 안내](07_CROSS_PLATFORM.md)에 있습니다.

설치를 마쳤다면 아래에서 첫 기록을 만들어 보세요.

## 첫 기록 만들기

1. 최초 실행에서 **동의하고 기록 시작**을 선택합니다. **지금은 기록하지 않고 둘러보기**를 선택하면 수집하지 않습니다.
2. 다른 앱에서 텍스트·링크·이미지를 새로 복사합니다. 동의 전부터 클립보드에 있던 내용은 저장하지 않습니다.
3. 앱의 **빠른 기록 열기** 또는 기본 전역 단축키로 팝업을 엽니다.
4. 검색하거나 ↑/↓로 선택한 뒤 Enter로 재복사합니다.
5. 대상 앱으로 돌아가 Ctrl + V 또는 ⌘ + V로 붙여넣습니다.

자동 붙여넣기는 제공하지 않습니다. 원문·이미지를 자세히 보거나 즐겨찾기·삭제를 수행하려면 기록 관리 화면을 사용하세요. 전체 삭제에는 두 단계 확인과 **전체 삭제** 문구 입력이 필요합니다.

## 단축키

| 동작 | Windows / Linux | macOS |
|---|---|---|
| 빠른 기록 열기·숨기기 | Ctrl + Shift + V | ⌘ + Shift + V |
| 검색창 이동 | Ctrl + F | ⌘ + F |
| 항목 이동 | ↑ / ↓ | ↑ / ↓ |
| 팝업에서 복사 후 닫기 | Enter / Ctrl + Enter | Enter / ⌘ + Enter |
| 선택 기록 복사 | Ctrl + C | ⌘ + C / 편집 → 복사 |
| 대상 앱에 붙여넣기 | Ctrl + V | ⌘ + V |
| 선택 기록 삭제 확인 | Delete | ⌫ / Delete |
| 팝업 닫기·선택 해제·확인 취소 | Esc | Esc |

입력창과 선택 텍스트의 기본 복사 동작은 유지합니다. 환경설정에서 전역 단축키를 녹화해 변경할 수 있으며 macOS의 물리 Control과 Command는 구분됩니다. 단축키 등록에 실패해도 다른 설정을 저장할 수 있습니다.

## 설정과 백그라운드 실행

기본 설정은 자동 시작 OFF, 백그라운드 유지 ON, 일반 기록 1,000개, 보관 30일, 시스템 테마입니다. 즐겨찾기는 자동 정리에서 제외되며, 보관 기간을 무제한으로 설정해도 일반 기록 개수 상한은 적용됩니다.

- **기록 일시정지:** 중지 동안의 복사 내용은 수집하지 않으며 재개 시 이미 있던 내용도 기록하지 않습니다.
- **자동 시작:** 배포 앱에서만 설정할 수 있습니다. 개발 모드에서는 비활성화됩니다. macOS에서 승인이 필요하면 시스템 설정의 로그인 항목을 확인합니다.
- **창 닫기:** Windows는 트레이, macOS는 메뉴 막대에 유지합니다. Linux는 트레이 유무와 관계없이 다시 접근할 수 있도록 작업 표시줄로 최소화합니다.
- **완전 종료:** 트레이의 완전 종료 또는 macOS 앱 메뉴의 종료를 사용합니다. Linux에서 트레이가 없으면 백그라운드 유지 설정을 끄고 창을 닫습니다.

Linux는 로그인 자동 실행으로 시작할 때도 관리 창을 표시합니다. 실행 폴더를 옮기거나 제거하기 전 자동 시작을 끄고, 이동 후 필요하면 다시 켜세요.

## 저장과 개인정보

기록은 서버로 보내지 않고 이 컴퓨터에 **평문**으로 저장합니다. 비밀번호·카드번호·인증 토큰을 자동 제외하지 않습니다. 민감한 내용을 복사하기 전에 기록을 끄거나 일시정지하세요.

실제 저장 위치는 환경설정의 **정보 → 데이터 저장 위치**에 표시합니다.

| OS | 일반적인 위치 |
|---|---|
| Windows | `%APPDATA%/ClipBox` |
| macOS | `~/Library/Application Support/ClipBox` |
| Linux | `$XDG_CONFIG_HOME/ClipBox`, 미설정 시 `~/.config/ClipBox` |

`clipbox.sqlite`에는 기록·즐겨찾기, `settings.json`에는 설정, `images/`에는 PNG 원본·썸네일을 저장합니다. SQLite의 `-wal`, `-shm` 파일이 생길 수 있습니다. 앱 파일 제거와 데이터 삭제는 별개이며 Windows 제거 프로그램도 데이터를 보존합니다.

동일 내용은 해시로 병합하며 즐겨찾기를 유지합니다. 다른 내용 이후 다시 복사하면 기존 항목을 최신으로 이동합니다. 앱 자체 재복사는 중복 기록을 만들지 않습니다. 같은 클립보드 상태의 명시적 재복사까지 구분하지는 못합니다.

텍스트는 약 400ms, 유지 중인 이미지는 약 1.2초 간격으로 확인합니다. 빠르게 바뀌는 중간 내용은 놓칠 수 있습니다. 제한은 텍스트 2MiB, PNG 10MiB·3,200만 화소·한 변 16,384px입니다. 클립보드 파일·복합 HTML/RTF 보존·출처 앱별 제외·암호화는 현재 범위 밖입니다.

## 개발자용 실행

아래는 소스 코드를 수정하거나 직접 빌드할 때만 필요한 절차입니다. Node.js 24 이상과 npm, 그래픽 데스크톱 환경에서 저장소 루트의 명령을 실행합니다.

```sh
npm ci
npm run dev
```

최초 의존성 설치에는 인터넷이 필요합니다. 설치 훅이 비활성화된 환경에서는 `node node_modules/electron/install.js`로 Electron 런타임을 설치할 수 있습니다. React 수정은 개발 서버에 반영되며 Electron main/preload 수정 뒤에는 개발 명령을 다시 실행하세요. 마지막 빌드를 실행하려면 `npm run build` 후 `npm start`를 사용합니다.

## 패키지 빌드

| 명령 | 결과 |
|---|---|
| `npm run dist:win` | Windows x64 NSIS 설치 파일 |
| `npm run dist:mac` | macOS x64·arm64 각각 DMG + ZIP; macOS에서 빌드 |
| `npm run dist:linux` | Linux x64 DEB·RPM·TAR.GZ |
| `npm run dist:linux:archive` | Linux x64 TAR.GZ만 생성 |
| `npm run dist` / `npm run make` | 현재 OS 패키지 |
| `npm run pack` | 현재 OS 실행 폴더 |

결과는 `release/1.1.0/`에 생성되며 Git 소스에는 포함하지 않습니다. [패키지 워크플로](../.github/workflows/build-desktop.yml)와 [플랫폼별 검증 결과](07_CROSS_PLATFORM.md)에서 빌드 환경과 확인 범위를 볼 수 있습니다.

## 검증 실행

```sh
npm run typecheck
npm test
npm run build
```

Windows에서는 빌드 후 `npm run test:e2e`로 실제 UI·클립보드 검사를 실행할 수 있습니다. 임시 프로필과 합성 데이터를 사용하며 시스템 클립보드를 변경합니다. 종료 시 일반 텍스트·HTML·RTF·PNG·북마크 형식을 복원하지만 앱 전용 형식은 복원하지 못하므로 검사 중 클립보드 사용을 피하세요.

현재 E2E 기대 동작은 Windows 기준입니다. macOS/Linux 네이티브 검수의 대체 수단이 아닙니다. [기록된 결과와 미검증 범위](07_CROSS_PLATFORM.md)를 함께 확인하세요.

## 문제 해결

| 증상 | 확인할 내용 |
|---|---|
| 새 기록이 없음 | 동의·수집 활성화·일시정지 상태를 확인하고 새 내용을 복사합니다. |
| 단축키 등록 실패 | 앱의 빠른 기록 열기로 접근하고 다른 조합을 설정합니다. |
| Wayland에서 수집·팝업이 제한됨 | 실행 항목·포털 승인을 확인하고 X11과 비교 검수합니다. 전역 수집·키 연결·포커스는 보장되지 않습니다. |
| 창을 닫아도 실행됨 | 기본 백그라운드 유지 동작입니다. 메뉴의 완전 종료를 사용합니다. |
| 저장소 오류 | 디스크 공간·권한을 확인하고 기존 DB·이미지·설정을 삭제하기 전에 백업합니다. |
| 개발 서버가 시작되지 않음 | Node 버전·의존성 설치·5173 포트 충돌을 확인합니다. |

[문서 모음으로 돌아가기](README.md)
