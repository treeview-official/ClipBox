# ClipBox 설치하기

**내 컴퓨터에 맞는 설치 파일을 내려받아 실행하면 됩니다. Node.js·npm·소스 코드 설치는 필요하지 않습니다.**

[다운로드](#다운로드) · [Windows](#windows) · [Mac](#mac) · [Linux](#linux) · [처음 사용하기](#처음-사용하기)

## 다운로드

| 내 컴퓨터 | ClipBox 1.2.0 설치 파일 |
|---|---|
| Windows 10/11 · 64비트 Intel/AMD | [Windows 설치 파일 받기 (.exe)](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-Setup-1.2.0.exe) |
| Mac · Apple Silicon | [Apple Silicon Mac용 받기 (.dmg)](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-mac-arm64.dmg) |
| Mac · Intel | [Intel Mac용 받기 (.dmg)](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-mac-x64.dmg) |
| Linux · Ubuntu/Debian 계열 · 64비트 Intel/AMD | [Linux DEB 설치 파일 받기 (.deb)](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-linux-amd64.deb) |
| Linux · Fedora/RHEL 계열 · 64비트 Intel/AMD | [Linux RPM 설치 파일 받기 (.rpm)](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-linux-x86_64.rpm) |

[전체 배포 파일과 릴리스 설명](https://github.com/treeview-official/ClipBox/releases/tag/v1.2.0)에서도 받을 수 있습니다. GitHub의 **Assets**에서 파일을 고를 때 **Source code**는 개발용이므로 위 설치 파일을 선택하세요.

Windows 개발자 인증서 서명과 Apple Developer ID 서명·공증은 적용되지 않았습니다. 처음 실행할 때 보안 확인이 추가될 수 있습니다. 실제 검증 범위는 [플랫폼 안내](07_CROSS_PLATFORM.md)를 확인하세요. Fedora/RHEL의 RPM 네이티브 설치·실행은 별도 검수가 필요합니다.

## 기존 사용자 업데이트

1.0·1.1에서는 ClipBox를 완전히 종료한 뒤 위 1.2 설치 파일로 설치하세요. 기존 기록·설정은 유지됩니다. 1.2부터 **환경설정 → 업데이트 확인**을 사용할 수 있습니다. [업데이트·패치노트·문의 안내](08_UPDATES.md)

## Windows

1. 위의 **Windows 설치 파일 받기**를 눌러 `ClipBox-Setup-1.2.0.exe`를 내려받습니다.
2. 다운로드한 파일을 두 번 클릭합니다.
3. 설치 안내에 따라 설치 위치를 선택하고 **설치**를 누릅니다.
4. 설치를 마치면 시작 메뉴에서 **ClipBox**를 검색해 실행합니다. 생성한 바탕 화면 바로 가기도 사용할 수 있습니다.

### 보안 안내가 표시될 때

서명·평판 정보가 충분하지 않은 새 앱에 SmartScreen 안내가 표시될 수 있습니다. 다운로드 출처가 이 저장소의 공식 릴리스인지 확인하세요. 파일을 신뢰해 실행하기로 결정했고 화면에 **추가 정보 → 실행**이 제공되는 경우 해당 파일에 대해 선택할 수 있습니다. 회사·학교의 관리 정책으로 차단됐다면 관리자에게 확인하세요. Windows 보안 기능을 전체적으로 끄지 않아도 됩니다. [Microsoft의 SmartScreen 설명](https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/)

악성 코드가 감지됐다는 별도 경고가 나오거나 파일 출처가 불확실하면 실행하지 말고 [이슈](https://github.com/treeview-official/ClipBox/issues)에 알려 주세요.

## Mac

### 어떤 파일을 받아야 하나요?

화면 왼쪽 위 **Apple 메뉴  → 이 Mac에 관하여**를 엽니다.

- **칩** 항목에 Apple 칩 이름이 표시되면 **Apple Silicon용**을 받습니다.
- **프로세서** 항목에 Intel이 표시되면 **Intel용**을 받습니다.

표시 위치는 [Apple의 Mac 종류 확인 안내](https://support.apple.com/ko-kr/116943)에서 확인할 수 있습니다.

### 설치 순서

1. 내 Mac에 맞는 `.dmg` 파일을 내려받아 두 번 클릭합니다.
2. 열린 창에서 **ClipBox 아이콘을 Applications(응용 프로그램) 폴더로 끌어다 놓습니다.**
3. 복사가 끝나면 Finder의 **응용 프로그램**에서 **ClipBox**를 엽니다.
4. 설치에 사용한 ClipBox 디스크 이미지는 Finder에서 추출해도 됩니다. 이후에는 응용 프로그램 폴더의 앱을 실행합니다.

### 개발자를 확인할 수 없다는 안내가 표시될 때

이 배포물은 Apple Developer ID 인증서 서명·공증을 받지 않았습니다. **공식 릴리스에서 받은 파일이며 변조되지 않았다고 신뢰하는 경우에만** Apple이 제공하는 앱별 열기 절차를 선택할 수 있습니다.

1. 응용 프로그램의 ClipBox를 한 번 열어 안내를 확인합니다.
2. **시스템 설정 → 개인정보 보호 및 보안**을 엽니다.
3. 보안 영역에 ClipBox의 **그래도 열기**가 표시되면 선택하고, 이어지는 확인에서 **열기**를 선택합니다.

macOS 버전이나 관리 정책에 따라 표시가 다를 수 있습니다. 버튼이 없거나 앱 손상·악성 코드 경고가 나오면 보안 설정을 강제로 해제하지 말고 [이슈](https://github.com/treeview-official/ClipBox/issues)에 알려 주세요. [Apple 공식 안내: Mac에서 앱 안전하게 열기](https://support.apple.com/ko-kr/102445)

## Linux

### Ubuntu/Debian 계열

1. **Linux DEB 설치 파일 받기**를 눌러 `ClipBox-1.2.0-linux-amd64.deb`를 내려받습니다.
2. 파일을 두 번 클릭해 소프트웨어 설치 앱으로 엽니다. 압축 프로그램이 열린다면 파일을 오른쪽 클릭하고 **다른 프로그램으로 열기**에서 소프트웨어 설치 앱을 선택합니다.
3. **설치**를 누르고 필요하면 계정 암호를 입력합니다.
4. 앱 목록에서 **ClipBox**를 찾아 실행합니다.

설치 앱으로 열리지 않으면 다운로드한 파일이 있는 폴더에서 아래 명령을 사용할 수 있습니다.

```sh
sudo apt install ./ClipBox-1.2.0-linux-amd64.deb
```

### Fedora/RHEL 계열

RPM 파일을 내려받아 배포판의 소프트웨어 설치 앱으로 열고 설치합니다. 해당 배포판에서의 실제 설치·실행은 아직 별도 검수 대상입니다. 터미널을 사용한다면 파일이 있는 폴더에서 실행합니다.

```sh
sudo dnf install ./ClipBox-1.2.0-linux-x86_64.rpm
```

### Linux에서 알아둘 점

- **X11 환경을 우선 권장**합니다. Wayland에서는 데스크톱·포털에 따라 다른 앱의 클립보드 수집, 전역 단축키, 팝업 포커스가 제한될 수 있습니다.
- 단축키가 동작하지 않아도 앱의 **빠른 기록 열기** 버튼을 사용할 수 있습니다.
- 백그라운드 유지 설정에서 창을 닫으면 작업 표시줄로 최소화됩니다. 트레이 아이콘이 없는 환경에서도 앱을 다시 열 수 있습니다.
- 자동 시작을 켜면 로그인 후 관리 창을 표시합니다.

<details>
<summary>설치 패키지 대신 압축 파일로 실행하기</summary>

[Linux TAR.GZ 받기](https://github.com/treeview-official/ClipBox/releases/download/v1.2.0/ClipBox-1.2.0-linux-x64.tar.gz) 후 파일이 있는 폴더에서 실행합니다.

```sh
tar -xzf ClipBox-1.2.0-linux-x64.tar.gz
cd ClipBox-1.2.0-linux-x64
./app.clipbox.desktop
```

압축 해제한 폴더 전체를 유지해야 합니다. `app.clipbox.desktop`는 실제 실행 파일입니다. 압축 파일 방식의 앱 메뉴·Wayland 포털 등록은 [Linux 실행 항목 안내](07_CROSS_PLATFORM.md#linux-실행-항목-등록)를 참고하세요.

</details>

## 처음 사용하기

1. 최초 안내의 **동의하고 기록 시작**을 선택합니다. **지금은 기록하지 않고 둘러보기**를 선택하면 기록 수집은 꺼진 상태로 시작합니다.
2. 다른 앱에서 텍스트나 이미지를 새로 복사합니다.
3. Windows/Linux는 **Ctrl + Shift + V**, Mac은 **⌘ + Shift + V**로 기록을 엽니다. 앱의 빠른 기록 열기 버튼도 사용할 수 있습니다.
4. 원하는 기록을 선택하고 **Enter**를 누릅니다. 기록이 클립보드에 복사되면 대상 앱에서 **Ctrl + V / ⌘ + V**로 붙여넣습니다.

기록은 이 컴퓨터에 평문으로 저장하며 비밀번호·인증 토큰을 자동 제외하지 않습니다. 민감한 내용을 복사하기 전 **환경설정 → 기록 일시정지**를 사용하세요. 자세한 사용법은 [시작 가이드](GETTING_STARTED.md)에 있습니다.

## 문제가 생겼다면

| 상황 | 다음 단계 |
|---|---|
| 다운로드 링크가 열리지 않음 | [릴리스 페이지](https://github.com/treeview-official/ClipBox/releases/tag/v1.2.0)의 Assets에서 같은 이름의 파일을 확인합니다. |
| 설치했는데 실행 아이콘을 못 찾음 | Windows 시작 메뉴, Mac 응용 프로그램, Linux 앱 목록에서 ClipBox를 검색합니다. |
| 새 기록이 없음 | 수집 동의·활성화·일시정지를 확인한 뒤 새 내용을 복사합니다. |
| 창을 닫아도 실행 중 | 기본 백그라운드 동작입니다. 메뉴의 완전 종료를 사용합니다. Linux에서 트레이가 없으면 백그라운드 유지 설정을 끄고 창을 닫습니다. |
| 보안 경고나 오류가 계속됨 | [이슈](https://github.com/treeview-official/ClipBox/issues)에 OS·CPU 종류·오류 문구를 적어 주세요. 개인 클립보드 내용은 포함하지 마세요. |

[프로젝트로 돌아가기](../README.md)
