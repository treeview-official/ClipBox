# ClipBox 1.1 — 플랫폼 지원과 검증 범위

작성일: 2026-10-22 (Asia/Seoul). 1.1에서 Windows 중심 지원 범위를 macOS와 Linux까지 확대했습니다. 공통 수집·저장소·화면을 유지하면서 OS별 단축키·로그인 자동 실행·메뉴·패키징을 분리했습니다. `06_VERIFICATION.md`는 1.0 기록으로 보존합니다.

## 확인한 결과

| 항목 | 결과 |
|---|---|
| 최신 1.1 타입 검사 | 통과 |
| 최신 단위 검사 | Windows 37개 통과·2개 건너뜀. GitHub macOS·Ubuntu에서 각각 39개 통과 |
| 최신 Windows E2E | 실제 Electron 창·OS 클립보드 15개 검사 통과 |
| Windows 1.0 배포물 | 기존 설치 EXE와 unpacked EXE 실행 검증 기록 보존 |
| Windows 1.1 설치 EXE | 생성하지 않음. Windows에서 `npm run dist:win`으로 빌드 가능 |
| Linux 1.1 x64 TAR.GZ | 생성. x64 ELF 헤더·1.1 번들·실행 파일 0755 권한 확인 |
| macOS x64 / arm64 | DMG/ZIP 구성 완료. 실제 macOS 빌드·실행 미수행 |
| Linux 네이티브 실행 | GUI·클립보드·글로벌 키·로그인 자동 실행 미검증 |
| GitHub 소스 CI | Windows·macOS·Ubuntu에서 타입 검사·단위 검사·프로덕션 소스 빌드 통과 |
| GitHub 패키징 워크플로 | 수동 OS별 패키징 매트릭스 구성. 설치 패키지 생성 작업은 미실행 |
| 서명·공증 | 자격 증명이 없어 미수행 |

Windows 소스 E2E 통과는 새 설치 프로그램 검증을 뜻하지 않습니다. 아카이브 생성과 플랫폼 단위 검사는 macOS/Linux 실제 클립보드나 단축키 동작을 증명하지 않습니다. 이 두 플랫폼은 네이티브 검수가 필요한 후보입니다.

소스 CI의 최초 확인 결과는 [GitHub 실행 기록](https://github.com/treeview-official/ClipBox/actions/runs/39757011473)에 있습니다. macOS·Ubuntu에서 POSIX 권한·심볼릭 링크 전용 단위 검사도 통과했습니다. 이 결과는 DMG/설치 파일 생성이나 데스크톱 UI 실행 검증과 구분합니다.

현재 결과는 `artifacts/qa/cross-platform-results.json`과 `artifacts/qa/e2e-results.json`에 기록합니다. `scripts/hotkey-qa.mjs`, `scripts/package-smoke.mjs`는 기존 Windows 검증용 도구이며, 특히 package-smoke는 1.0 경로·버전을 사용합니다. 플랫폼 공통 네이티브 검수 도구로 간주하지 않습니다.

검증 당시 Linux 파일은 `release/1.1.0/ClipBox-1.1.0-linux-x64.tar.gz`이며 SHA256은 `FEB9E46592A09BAEA216A9928D9795523F7B731C2EB1BFA5B3176670815C42CA`입니다. 소스는 이 Git 저장소에서 관리하며, 생성한 설치 파일과 실행 아카이브는 Git 소스에 포함하지 않습니다. 파일 해시는 해당 검증 아카이브에만 적용되며 재빌드 결과와 다를 수 있습니다.

## 플랫폼 동작

- `AppStatus.platform`을 기준으로 macOS는 ⌘, Windows/Linux는 Ctrl 복사·붙여넣기·검색 키를 표시합니다. macOS 물리 Control과 Command 녹화는 서로 구분합니다.
- macOS는 앱·편집·창 메뉴, template 메뉴 막대 아이콘, 로그인 항목 API를 사용합니다. 로그인 승인이 필요하면 시스템 설정 안내를 표시합니다. 메뉴의 복사는 입력창·선택 텍스트의 기본 동작을 보존합니다.
- Linux는 사용자 XDG autostart 파일을 원자적으로 관리합니다. 앱 소유 표식이 있는 파일만 변경하며 무관한 파일·심볼릭 링크는 덮어쓰지 않습니다. 개발 실행과 안전하지 않은 임시 실행 경로에서는 자동 시작을 비활성화합니다.
- Linux 트레이 객체가 만들어졌다고 아이콘이 보인다고 가정하지 않습니다. 기본 백그라운드 유지 상태에서 관리 창을 닫으면 작업 표시줄로 최소화하고, 로그인 자동 실행에서도 관리 창을 표시합니다.
- Wayland에서는 글로벌 커서 조회·팝업 위치 지정·항상 위 표시를 요청하지 않습니다. 컴포지터가 위치와 포커스를 결정하며, 수집·포털·키 연결 제한을 화면과 설정에 안내합니다.

## 빌드

Node.js 24 이상에서 `npm ci` 후 실행합니다. 결과 디렉터리는 `release/1.1.0/`입니다.

| 명령 | 산출물 |
|---|---|
| Windows의 `npm run dist:win` | `ClipBox-Setup-1.1.0.exe`, `win-unpacked/` |
| macOS의 `npm run dist:mac` | `ClipBox-1.1.0-mac-x64.dmg`, `ClipBox-1.1.0-mac-x64.zip`, `ClipBox-1.1.0-mac-arm64.dmg`, `ClipBox-1.1.0-mac-arm64.zip` |
| `npm run dist:linux` / `npm run dist:linux:archive` | `ClipBox-1.1.0-linux-x64.tar.gz` |
| 각 OS의 `npm run pack` | 현재 OS 실행 폴더 |

`npm run dist` / `npm run make`는 현재 OS를 선택합니다. macOS DMG 빌드는 macOS 호스트에서 실행해야 합니다. 현재 Linux 타깃은 **TAR.GZ 하나**이며 DEB/AppImage 산출물을 제공하지 않습니다. AppImage 환경 변수에 대한 방어 코드가 있어도 AppImage를 실제 배포하는 것은 아닙니다.

`.github/workflows/build-desktop.yml`은 수동 실행 시 Windows·macOS·Ubuntu 24.04에서 의존성 설치·타입 검사·단위 검사·패키징 후 아티팩트를 업로드하도록 구성되어 있습니다. 아직 실행하지 않았으며, 네이티브 GUI E2E·서명·공증·자동 릴리스 게시가 완료된 것은 아닙니다.

## macOS

실제 Mac에서 `npm ci`와 `npm run dist:mac`을 실행합니다. `arm64`는 Apple Silicon, `x64`는 Intel용입니다. 생성된 DMG에서 ClipBox를 Applications로 복사하거나 ZIP의 `.app` 번들 전체를 유지합니다. 기본 전역 단축키는 **⌘ + Shift + V**, 환경설정은 **⌘ + 쉼표**이며 대상 앱에 붙여넣을 때 **⌘ + V**를 사용합니다.

로그인 자동 시작은 설치 위치를 정한 뒤 사용자가 켠 경우에만 등록합니다. OS 승인이 필요하면 **시스템 설정 → 로그인 항목**에서 허용합니다. 메뉴 막대 유지가 기본이며 **ClipBox → 종료**로 완전히 종료합니다.

현재 macOS 컴퓨터·서명 자격 증명이 없어 패키징, 최초 실행, Intel/Apple Silicon 실행, 메뉴 막대, 실제 클립보드·단축키·로그인 항목·잠자기 복귀 검수는 남아 있습니다. 서명·Apple 공증 완료 앱으로 배포하지 않습니다.

## Linux

Linux x64 그래픽 데스크톱에서 X11을 우선 검수합니다. 아카이브가 있는 디렉터리에서 다음을 실행합니다.

```sh
tar -xzf ClipBox-1.1.0-linux-x64.tar.gz
cd ClipBox-1.1.0-linux-x64
./app.clipbox.desktop
```

`app.clipbox.desktop`는 실제 ELF 실행 파일 이름입니다. 아래 실행 항목 파일 `app.clipbox.desktop.desktop`과 다릅니다. resources·locales·공유 라이브러리를 포함한 실행 폴더 전체를 유지합니다. 아카이브의 실행 파일 권한은 0755로 확인했으며 압축 해제 도구도 이를 보존해야 합니다.

Linux에서 실제 실행은 검수하지 않았으므로 대상 배포판의 Electron 필수 라이브러리와 샌드박스 환경을 확인해야 합니다. `--no-sandbox`를 정상 실행 방법으로 제공하지 않습니다.

### Linux 실행 항목 등록

앱 메뉴 또는 Wayland 글로벌 단축키 포털을 사용하려면 아래 템플릿을 **`app.clipbox.desktop.desktop`**이라는 이름으로 `$XDG_DATA_HOME/applications`에 저장합니다. XDG_DATA_HOME 미설정 시 위치는 `~/.local/share/applications`입니다. 개발 도구가 실제 사용자 디렉터리에 자동 설치한 것은 아닙니다.

```ini
[Desktop Entry]
Type=Application
Version=1.0
Name=ClipBox
Comment=Local clipboard history manager
Exec="/ABSOLUTE/PATH/ClipBox-1.1.0-linux-x64/app.clipbox.desktop"
Terminal=false
Categories=Utility;
StartupNotify=true
```

`/ABSOLUTE/PATH/...`를 실제 설치 위치의 **절대 경로**로 바꿔야 합니다. 복잡한 특수 문자가 있는 경로라면 Desktop Entry Exec의 이스케이프 규칙을 확인하거나 단순한 경로를 선택합니다. 원하면 `Icon=`에 별도 PNG의 절대 경로를 추가할 수 있습니다.

앱은 `app.setDesktopName('app.clipbox.desktop.desktop')`을 사용하고 실행 파일 이름은 `app.clipbox.desktop`입니다. 포털 식별자 매칭을 위해 이름을 임의로 바꾸지 않습니다. 실행 항목 등록·포털 승인 이후에도 실제 키 연결은 따로 확인해야 합니다.

### Wayland·트레이·자동 시작

Wayland는 데스크톱·컴포지터·포털에 따라 **백그라운드 클립보드 읽기, 전역 단축키와 포커스 이동을 제한**합니다. 포털이 등록됐다고 실제 전역 키 연결을 보장하지 않습니다. 앱은 안내를 별도로 표시하며 팝업 위치를 강제로 정하지 않습니다. 단축키가 동작하지 않으면 앱의 **빠른 기록 열기**를 사용하고, 수집 제한은 X11 세션에서 비교 검수할 수 있습니다.

포털과 창 기능의 플랫폼 차이는 [Electron 전역 단축키 문서](https://www.electronjs.org/docs/latest/api/global-shortcut), [BrowserWindow 문서](https://www.electronjs.org/docs/latest/api/browser-window), [screen 문서](https://www.electronjs.org/docs/latest/api/screen)를 참고합니다.

기본 백그라운드 유지 상태에서 창을 닫으면 작업 표시줄로 최소화합니다. 트레이가 보이지 않을 때 종료하려면 관리 창을 복원하고 백그라운드 유지 설정을 끈 뒤 창을 닫습니다.

실행 폴더를 고정한 뒤 **로그인 시 자동 실행**을 켭니다. 앱 관리 파일은 `$XDG_CONFIG_HOME/autostart/app.clipbox.desktop.desktop`, 미설정 시 `~/.config/autostart/app.clipbox.desktop.desktop`입니다. 위 앱 메뉴용 실행 항목과는 별도입니다. 자동 시작 항목에 `--hidden`이 있어도 Linux에서는 창을 표시합니다. 폴더 이동·제거 전 자동 시작을 끄고, 이동 후 필요하면 다시 켭니다. 앱이 소유하지 않은 같은 이름의 파일은 변경하지 않습니다.

## 데이터와 남은 검수

실제 데이터 경로는 환경설정의 **정보**를 확인합니다. 일반적으로 Windows `%APPDATA%/ClipBox`, macOS `~/Library/Application Support/ClipBox`, Linux `$XDG_CONFIG_HOME/ClipBox` 또는 `~/.config/ClipBox`입니다. `clipbox.sqlite`, `settings.json`, `images/` 구조와 평문 저장·수집 동의·보관 정책은 동일하며 기존 데이터를 강제 초기화하지 않습니다.

- macOS 양쪽 아키텍처: DMG/ZIP 빌드·실행, 최초 동의, 텍스트·URL·PNG 수집·재복사, 영속성, 메뉴 막대, 실제 단축키, 로그인 항목, 잠자기·복귀
- Linux X11: 추출·실행·샌드박스, 클립보드·이미지·한글, 트레이 유무별 최소화·종료, 로그인 자동 실행, 폴더 이동
- Linux Wayland: GNOME/KDE 등 실제 대상별 포털 승인·desktop ID·실제 키·다른 앱 복사 수집·팝업 포커스 제한 기록
- Windows 1.1: 설치·제거와 재부팅 자동 시작, 기존 1.0 데이터 유지
- 모든 OS: 다중 모니터·배율·장시간 부하, 배포에 필요한 코드 서명·공증
