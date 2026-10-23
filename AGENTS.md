# AGENTS.md — ClipBox 작업 에이전트 가이드

## 프로젝트 목표
Windows·macOS·Linux용 로컬 클립보드 히스토리 매니저를 구현하고 유지한다. 1.1부터 macOS Intel/Apple Silicon과 Linux x64를 지원한다. 소스 검사, 설치된 앱의 네이티브 시작 검사, 실제 데스크톱에서의 클립보드·단축키 검수를 구분해 기록한다.

## 작업 시작 전 반드시 읽을 파일
1. `docs/01_PRODUCT_SPEC.md`
2. `docs/02_DESIGN_SYSTEM.md`
3. `docs/03_ARCHITECTURE.md`
4. `docs/04_IMPLEMENTATION.md`
5. `docs/05_QA_CHECKLIST.md`
6. `design/mockups/*.png` (시각적 참고)
7. `docs/07_CROSS_PLATFORM.md` (1.1 플랫폼 변경과 검증 범위)
8. `docs/INSTALL.md` (일반 사용자용 OS별 설치와 최초 실행)
9. `docs/08_UPDATES.md` (1.2 업데이트·패치노트·문의)

`docs/01`~`05`는 최초 Windows 중심 명세다. 이후 사용자의 macOS/Linux 추가 요청과 `docs/07_CROSS_PLATFORM.md`를 함께 적용한다. `docs/06_VERIFICATION.md`는 1.0의 역사적 검증 기록이므로 새 결과로 덮어쓰지 않는다.

## 우선순위
1. 기록의 신뢰성 및 안전한 개인 데이터 처리
2. 키보드 중심의 사용성 및 퀵 팝업 응답성
3. 목업에 준하는 일관된 시각적 완성도
4. OS별 패키징·재시작·로그인 자동 실행과 실제 검증 범위의 정확한 기록

## 필수 원칙
- Windows 회귀 동작을 유지하면서 macOS Intel/Apple Silicon, Linux x64를 지원한다. Linux는 X11 우선이며 Wayland 제한을 숨기지 않는다.
- 앱 기능과 동작의 기준은 `docs/` 명세이고, 이미지 내 숫자/데이터는 샘플이다.
- Main/Preload/Renderer 경계를 분리하고 `contextIsolation: true`, `nodeIntegration: false`, sandbox 등 보안 기본값을 유지한다.
- `ipcRenderer` 전체를 렌더러에 노출하지 말고 채널별 화이트리스트 기반의 제한된 API를 제공한다. 입력 검증을 반드시 한다.
- clipboard 원문, 비밀번호, 토큰을 로그·원격 서버·분석 플랫폼으로 보내지 않는다. 사용자가 누른 업데이트 확인·다운로드에 한해 main의 고정 GitHub API/CDN 요청을 허용한다. 시작 시 자동 네트워크 요청과 렌더러 외부 요청은 만들지 않는다.
- 클립보드 기록 사용은 최초 실행 시 사용자에게 명확하게 알리고 켜기/끄기를 제공한다. 비밀번호 자동 제외가 완벽하다고 주장하지 않는다.
- 전역 단축키 기본값은 Windows/Linux `Ctrl+Shift+V`, macOS `Command+Shift+V`다. 등록 실패가 앱 시작을 막지 않아야 하며 대체 버튼·사용자 지정 키를 제공한다. Wayland 포털 등록 성공을 실제 키 연결 검증으로 간주하지 않는다.
- UI는 main의 `AppStatus.platform`을 사용한다. macOS의 Command와 물리 Control을 구분하고 복사·검색·붙여넣기 힌트에도 적용한다.
- 한국어 글꼴이 설치되지 않은 환경에서도 로컬 번들 글꼴로 UI·기록 미리보기·경로를 표시한다. 글꼴을 교체할 때 한글 전체 범위·라이선스를 확인하고 외부 런타임 요청 없이 배포물에도 고지와 라이선스를 포함한다.
- 붙여넣기 자동화는 OS 통합을 검증한 경우에만 활성화한다. 현재는 재복사 후 사용자가 대상 앱에서 Windows/Linux `Ctrl+V`, macOS `Command+V`를 누르는 방식이다.
- macOS 메뉴 막대·로그인 항목, Windows 트레이·시작 프로그램, Linux XDG 자동 시작을 각각 처리한다. 개발 모드 자동 시작은 비활성화하고 설명한다. Linux에서는 트레이 존재만으로 아이콘 표시를 가정하지 않고 관리 창을 작업 표시줄로 최소화한다.
- Wayland에서는 전역 커서 조회·창 위치 지정·항상 위 표시를 가정하지 않는다. 백그라운드 수집·포커스·전역 단축키 제한을 UI와 문서에 표시한다.
- 사용자 기존 파일이 있는 경우 먼저 읽고 충돌을 피하며, 위험한 제거·전체 삭제 명령을 임의로 실행하지 않는다.
- 구현 단계마다 타입 검사/빌드/테스트를 수행하고 실패를 수정한다. 실제 실행해 확인하지 못한 항목은 검증 완료라고 쓰지 않는다.
- 대상 OS에서 검증하지 못한 빌드·설치·자동 시작·클립보드·단축키는 미검증으로 표시한다. 크로스 빌드나 단위 검사만으로 네이티브 런타임 성공을 주장하지 않는다.
- 네이티브 시작 검사는 `scripts/packaged-smoke.mjs`로 새 CI 사용자 프로필에서 수행한다. 수집·자동 시작을 켜거나 시스템 클립보드에 접근하지 않는다. 테스트를 통과시키기 위해 `--no-sandbox`를 추가하지 않는다. DOM 검사 통과와 글꼴·화면의 시각적 확인도 구분한다.
- 기본값: 시스템 트레이 사용, 저장 개수 1000, 보관 30일, 즐겨찾기 제외 보관 정책, 자동 시작 OFF, 다크/라이트 시스템 연동.

## 산출물
- `src/`, `electron/` 또는 이에 준하는 읽기 쉬운 소스 구조
- `package.json`에 `dev`, `build`, `typecheck`, `test`, `make`/`dist` 스크립트
- SQLite 스키마/마이그레이션, 앱 설정 관리, 안전한 IPC
- 다운로드와 설치 방법을 먼저 안내하는 README와 `docs/INSTALL.md`. 일반 사용자에게 Node.js나 npm 설치를 요구하지 않는다.
- Windows NSIS `.exe`, macOS `dmg`/`zip`(x64·arm64), Linux `deb`(amd64)·`rpm`(x86_64)·`tar.gz`(x64) 패키징과 실제 결과물. AppImage는 제공하지 않는다.
- OS별 데이터 위치·설치·Linux 실행 항목·네이티브 QA·서명 여부 안내
- 테스트 결과와 알려진 제약사항, 향후 기능 목록

## 작업 단계
`docs/04_IMPLEMENTATION.md`를 지켜 설계→프로젝트 구성→기본 동작→UI→설정/안전성→테스트/패키징 순으로 작업한다. 사용자에게 중간 승인이 꼭 필요하지 않다면 합리적인 기본값으로 계속 진행한다.

산출물은 버전별 `release/<version>/`에 생성해 기존 검증 배포물을 보존한다. macOS DMG는 macOS에서, Linux DEB/RPM은 Linux에서 빌드한다. Windows/macOS에서 Linux 실행 아카이브만 만들 때는 `npm run dist:linux:archive`를 사용한다.

수동 워크플로 `.github/workflows/build-desktop.yml`은 Windows x64, macOS arm64·x64, Ubuntu x64에서 실행한다. Windows는 NSIS 무인 설치 후 EXE, macOS는 DMG 마운트·복사 후 앱, Ubuntu는 DEB 설치 후 Xvfb/X11에서 시작을 확인한다. RPM 메타데이터 조회를 Fedora 설치·실행 검사로 표현하지 않는다. 실행 결과를 확인하기 전까지 성공했다고 기록하지 않으며, 서명·공증 자격 증명이 없으면 적용된 것으로 표현하지 않는다.

1.2부터 업데이트 설치 파일을 열기 전 공식 저장소·OS/CPU·버전·크기·SHA-256을 검사한다. 구버전으로 자동 낮추지 않는다. macOS 서명 없는 자동 앱 교체를 주장하지 않으며 OS 설치 화면으로 연결하는 방식을 문서화한다. 업데이트 테스트는 임시 프로필·합성 응답과 실행기 대역을 사용하며 실제 사용자 앱이나 기록을 바꾸지 않는다.
