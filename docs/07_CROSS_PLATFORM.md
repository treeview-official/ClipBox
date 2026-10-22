# ClipBox 1.1 — 플랫폼 지원과 검증 범위

작성일: 2026-10-22 (Asia/Seoul). Windows x64, macOS Apple Silicon·Intel, Linux x64를 지원합니다. 일반 사용자는 Node.js 없이 [설치 안내](INSTALL.md)에 따라 해당 OS의 패키지를 설치할 수 있습니다. [1.0 검증 기록](06_VERIFICATION.md)은 당시 결과로 보존합니다.

## 확인한 결과

| 환경 | 확인한 범위 |
|---|---|
| Windows x64 | 타입 검사·단위 검사 37개 통과·POSIX 전용 2개 건너뜀, 실제 클립보드를 사용하는 소스 E2E 15개 통과 |
| macOS·Ubuntu 소스 CI | 타입 검사·프로덕션 소스 빌드·단위 검사 각각 39개 통과 |
| Windows 네이티브 패키지 | 1.1 NSIS EXE 생성, 무인 설치 후 설치된 EXE의 시작 검사 통과 |
| macOS 15 arm64·x64 | 각 네이티브 호스트에서 DMG/ZIP 생성, DMG 마운트·앱 복사 후 시작 검사 통과 |
| Ubuntu 24.04 x64 | DEB·RPM·TAR.GZ 생성, DEB 설치 후 Xvfb/X11에서 시작 검사 통과 |
| RPM | 생성·메타데이터 조회 확인. Fedora/RHEL 설치·실행 미검증 |
| 배포 인증 | Windows 게시자 인증서, Apple Developer ID 서명·공증 미적용 |

소스 검사는 [소스 CI 실행 기록](https://github.com/treeview-official/ClipBox/actions/runs/39757011473), 첫 네이티브 설치·시작 검사는 [패키지 CI 실행 기록](https://github.com/treeview-official/ClipBox/actions/runs/39759236054)에서 확인할 수 있습니다. 첫 패키지 CI의 소스는 `491304b71ba1f304d66da925c891411fb9095300`입니다. 이 실행에서 Linux의 한국어 글꼴 누락을 발견해 Noto Sans KR을 번들에 추가했으며, 최종 배포 파일의 검증 결과·해시는 [v1.1.0 릴리스](https://github.com/treeview-official/ClipBox/releases/tag/v1.1.0)에 첨부한 기록을 기준으로 확인합니다.

네이티브 시작 검사(`scripts/packaged-smoke.mjs`)는 새 CI 사용자 프로필에서 패키지 버전·아키텍처, 관리 창과 제한된 preload IPC, 최초 동의 화면·빈 기록, sandbox·context isolation을 확인합니다. 수집·로그인 자동 실행을 켜거나 시스템 클립보드에 접근하지 않습니다. 전체 설치 마법사, 다른 앱과의 클립보드·전역 단축키·포커스, 재부팅·로그인 항목까지 검증한 결과로 해석하지 않습니다. Linux 시작 검사는 Xvfb의 X11 환경이며 Wayland 결과가 아닙니다.

기존 `scripts/hotkey-qa.mjs`, `scripts/package-smoke.mjs`는 Windows 1.0 시기의 검증 도구입니다. 특히 package-smoke는 1.0 경로·버전을 사용하므로 공통 네이티브 검수에는 사용하지 않습니다. 생성된 설치 파일과 실행 아카이브는 Git 소스에 포함하지 않습니다.

## 플랫폼 동작

- `AppStatus.platform`을 기준으로 macOS는 ⌘, Windows/Linux는 Ctrl 복사·붙여넣기·검색 키를 표시합니다. macOS 물리 Control과 Command 녹화는 서로 구분합니다.
- macOS는 앱·편집·창 메뉴, template 메뉴 막대 아이콘, 로그인 항목 API를 사용합니다. 로그인 승인이 필요하면 시스템 설정 안내를 표시합니다. 메뉴의 복사는 입력창·선택 텍스트의 기본 동작을 보존합니다.
- Linux는 사용자 XDG autostart 파일을 원자적으로 관리합니다. 앱 소유 표식이 있는 파일만 변경하며 무관한 파일·심볼릭 링크는 덮어쓰지 않습니다. 개발 실행과 안전하지 않은 임시 실행 경로에서는 자동 시작을 비활성화합니다.
- Linux 트레이 객체가 만들어졌다고 아이콘이 보인다고 가정하지 않습니다. 기본 백그라운드 유지 상태에서 관리 창을 닫으면 작업 표시줄로 최소화하고, 로그인 자동 실행에서도 관리 창을 표시합니다.
- Wayland에서는 글로벌 커서 조회·팝업 위치 지정·항상 위 표시를 요청하지 않습니다. 컴포지터가 위치와 포커스를 결정하며, 수집·포털·키 연결 제한을 화면과 설정에 안내합니다.
- 한국어 시스템 글꼴이 없는 환경을 위해 Noto Sans KR을 로컬로 포함합니다. UI·기록 미리보기·경로 표시에 적용하며 실행 중 외부 글꼴 요청을 하지 않습니다. [글꼴 출처와 라이선스](../THIRD_PARTY_NOTICES.md)는 앱 배포물에도 포함됩니다.

## 빌드

개발자는 Node.js 24 이상에서 `npm ci` 후 실행합니다. 결과 디렉터리는 `release/1.1.0/`입니다.

| 명령과 빌드 호스트 | 산출물 |
|---|---|
| Windows의 `npm run dist:win` | `ClipBox-Setup-1.1.0.exe`, `win-unpacked/` |
| macOS의 `npm run dist:mac` | `ClipBox-1.1.0-mac-arm64.dmg`, `ClipBox-1.1.0-mac-x64.dmg`, 각 아키텍처의 ZIP |
| Linux의 `npm run dist:linux` | `ClipBox-1.1.0-linux-amd64.deb`, `ClipBox-1.1.0-linux-x86_64.rpm`, `ClipBox-1.1.0-linux-x64.tar.gz` |
| Windows/macOS/Linux의 `npm run dist:linux:archive` | `ClipBox-1.1.0-linux-x64.tar.gz`만 생성 |
| 각 OS의 `npm run pack` | 현재 OS 실행 폴더 |

`npm run dist` / `npm run make`는 현재 OS를 선택합니다. macOS는 `npm run dist:mac -- arm64` 또는 `npm run dist:mac -- x64`로 아키텍처를 선택할 수도 있습니다. DMG는 macOS에서, DEB/RPM은 Linux에서 빌드합니다. AppImage는 제공하지 않습니다.

수동 워크플로 [build-desktop.yml](../.github/workflows/build-desktop.yml)은 Windows x64, macOS 15 arm64, macOS 15 Intel, Ubuntu 24.04 x64에서 타입 검사·단위 검사·네이티브 패키징·설치된 앱 시작 검사를 수행하고 결과물을 업로드합니다. 서명·공증은 별도 자격 증명과 검수가 필요한 작업입니다.

## macOS

Apple Silicon은 `arm64`, Intel은 `x64` DMG를 선택합니다. DMG를 열고 ClipBox를 Applications로 드래그합니다. ZIP을 사용하는 경우 `.app` 번들 전체를 유지합니다. 기본 전역 단축키는 **⌘ + Shift + V**, 환경설정은 **⌘ + 쉼표**이며 대상 앱에 붙여넣을 때 **⌘ + V**를 사용합니다.

로그인 자동 시작은 설치 위치를 정한 뒤 사용자가 켠 경우에만 등록합니다. OS 승인이 필요하면 시스템 설정의 **로그인 항목**에서 허용합니다. 메뉴 막대 유지가 기본이며 **ClipBox → 종료**로 완전히 종료합니다.

양쪽 아키텍처의 패키지 생성과 앱 시작은 네이티브 CI에서 확인했습니다. 브라우저로 내려받은 파일의 격리·Gatekeeper 승인, 실제 클립보드·전역 단축키·로그인 항목·잠자기 복귀는 별도 검수 대상입니다. Apple Developer ID·공증이 적용된 앱으로 표시하지 않습니다. 첫 실행 보안 안내는 [설치 가이드](INSTALL.md)를 참고합니다.

## Linux

Ubuntu/Debian 계열은 **DEB**, Fedora/RHEL 계열은 **RPM**을 선택합니다. 기본 사용 환경은 X11입니다. DEB는 Ubuntu 24.04에서 설치·시작을 확인했으며, RPM은 생성·메타데이터 확인까지 수행했습니다. 설치 과정은 [설치 가이드](INSTALL.md)에 있습니다.

DEB/RPM의 앱 실행 파일은 `/opt/ClipBox/app.clipbox.desktop`, 앱 메뉴 항목은 `/usr/share/applications/app.clipbox.desktop.desktop`입니다. 패키지 이름은 `clipbox`입니다. `app.clipbox.desktop`는 ELF 실행 파일 이름이며 실행 항목 파일과 다릅니다.

TAR.GZ는 패키지 관리자를 사용하지 않는 경우의 대안입니다. 실행 폴더의 resources·locales·공유 라이브러리를 함께 유지하고, 압축 해제 시 실행 권한을 보존합니다.

```sh
tar -xzf ClipBox-1.1.0-linux-x64.tar.gz
cd ClipBox-1.1.0-linux-x64
./app.clipbox.desktop
```

DEB/RPM 설치는 배포판 통합 스크립트를 사용합니다. TAR.GZ는 필요한 시스템 라이브러리·sandbox 설정을 사용자가 확인해야 하므로 일반 사용자에게는 DEB/RPM을 우선 안내합니다. `--no-sandbox`를 정상 실행 방법으로 제공하지 않습니다.

### Linux 실행 항목 등록

DEB/RPM은 앱 메뉴 항목을 설치하므로 아래 수동 등록은 **TAR.GZ 사용자에게만** 해당합니다. 앱 메뉴 또는 Wayland 글로벌 단축키 포털을 사용하려면 다음 템플릿을 **`app.clipbox.desktop.desktop`**이라는 이름으로 `$XDG_DATA_HOME/applications`에 저장합니다. XDG_DATA_HOME 미설정 시 위치는 `~/.local/share/applications`입니다.

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

`/ABSOLUTE/PATH/...`를 실제 설치 위치의 **절대 경로**로 바꿉니다. 복잡한 특수 문자가 있는 경로라면 Desktop Entry Exec의 이스케이프 규칙을 확인하거나 단순한 경로를 선택합니다. 원하면 `Icon=`에 별도 PNG의 절대 경로를 추가할 수 있습니다.

앱은 `app.setDesktopName('app.clipbox.desktop.desktop')`을 사용하고 실행 파일 이름은 `app.clipbox.desktop`입니다. 포털 식별자 매칭을 위해 이름을 임의로 바꾸지 않습니다. 실행 항목 등록·포털 승인 이후에도 실제 키 연결은 따로 확인해야 합니다.

### Wayland·트레이·자동 시작

Wayland는 데스크톱·컴포지터·포털에 따라 **백그라운드 클립보드 읽기, 전역 단축키와 포커스 이동을 제한**합니다. 포털이 등록됐다고 실제 전역 키 연결을 보장하지 않습니다. 앱은 안내를 별도로 표시하며 팝업 위치를 강제로 정하지 않습니다. 단축키가 동작하지 않으면 앱의 **빠른 기록 열기**를 사용하고, 수집 제한은 X11 세션에서 비교 검수할 수 있습니다.

포털과 창 기능의 플랫폼 차이는 [Electron 전역 단축키 문서](https://www.electronjs.org/docs/latest/api/global-shortcut), [BrowserWindow 문서](https://www.electronjs.org/docs/latest/api/browser-window), [screen 문서](https://www.electronjs.org/docs/latest/api/screen)를 참고합니다.

기본 백그라운드 유지 상태에서 창을 닫으면 작업 표시줄로 최소화합니다. 트레이가 보이지 않을 때 종료하려면 관리 창을 복원하고 백그라운드 유지 설정을 끈 뒤 창을 닫습니다.

고정된 설치 위치에서 **로그인 시 자동 실행**을 켭니다. 앱 관리 파일은 `$XDG_CONFIG_HOME/autostart/app.clipbox.desktop.desktop`, 미설정 시 `~/.config/autostart/app.clipbox.desktop.desktop`입니다. 위 앱 메뉴용 실행 항목과는 별도입니다. 자동 시작 항목에 `--hidden`이 있어도 Linux에서는 창을 표시합니다. 폴더 이동·제거 전 자동 시작을 끄고, 이동 후 필요하면 다시 켭니다. 앱이 소유하지 않은 같은 이름의 파일은 변경하지 않습니다.

## 데이터와 남은 검수

실제 데이터 경로는 환경설정의 **정보**를 확인합니다. 일반적으로 Windows `%APPDATA%/ClipBox`, macOS `~/Library/Application Support/ClipBox`, Linux `$XDG_CONFIG_HOME/ClipBox` 또는 `~/.config/ClipBox`입니다. `clipbox.sqlite`, `settings.json`, `images/` 구조와 평문 저장·수집 동의·보관 정책은 동일하며 기존 데이터를 강제 초기화하지 않습니다.

- macOS 양쪽 아키텍처: 실제 텍스트·URL·PNG 수집·재복사, 영속성, 메뉴 막대, 전역 단축키, 로그인 항목, 잠자기·복귀
- Linux X11: 실제 데스크톱에서의 클립보드·이미지·한글 입력, 트레이 유무별 최소화·종료, 로그인 자동 실행, TAR 폴더 이동
- Linux RPM: Fedora/RHEL 계열의 실제 설치·실행·제거
- Linux Wayland: GNOME/KDE 등 대상별 포털 승인·desktop ID·실제 키·다른 앱 복사 수집·팝업 포커스 제한 기록
- Windows 1.1: 대화형 설치·제거 마법사와 재부팅 자동 시작, 기존 1.0 데이터 유지
- 모든 OS: 브라우저 다운로드 후 보안 대화상자, 다중 모니터·배율·장시간 부하, 코드 서명·공증
