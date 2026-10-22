# 변경 이력

버전의 구현 상태와 실제 플랫폼 검증 범위를 함께 기록합니다.

## 1.1.0 — 2026-10-22

### 추가·변경

- macOS·Linux 플랫폼 구분, 능력 정보와 환경별 안내
- macOS Command 단축키 표시·녹화, 물리 Control 구분, 네이티브 편집·창 메뉴와 메뉴 막대 아이콘
- macOS 로그인 항목 및 Linux 사용자 XDG 자동 시작 관리
- Linux 관리 창의 작업 표시줄 최소화와 트레이 대체 접근
- Wayland 클립보드·전역 단축키·포커스 제한 안내와 창 위치·항상 위 처리 분리
- Windows NSIS 설치 EXE, macOS x64·arm64 DMG/ZIP, Linux DEB·RPM·TAR.GZ 패키징과 실행 권한 보존
- OS별 네이티브 빌드·설치된 앱 시작 검사 워크플로와 다운로드 중심 설치 안내
- 한국어 시스템 글꼴이 없는 환경을 위한 Noto Sans KR 전체 가변 글꼴 내장. 외부 요청 없이 UI·기록 미리보기·경로 표시에서 사용하며 OFL 라이선스를 배포물에 포함

### 검증·배포 상태

- 타입 검사 통과, Windows에서 단위 검사 **37개 통과·POSIX 전용 2개 건너뜀**, 소스 E2E **15개 통과**
- GitHub 소스 CI의 Windows·macOS·Ubuntu 타입 검사·단위 검사·프로덕션 소스 빌드 통과. macOS·Ubuntu는 POSIX 전용 검사를 포함해 **각 39개 통과**
- Windows x64에서 1.1 NSIS 무인 설치 후 EXE 시작 검사 통과
- macOS 15의 Apple Silicon·Intel에서 각각 DMG/ZIP 생성, DMG 마운트·앱 복사 후 네이티브 시작 검사 통과
- Ubuntu 24.04 x64에서 DEB·RPM·TAR.GZ 생성, DEB 설치 후 Xvfb/X11 시작 검사 통과. RPM은 메타데이터를 확인했으며 Fedora/RHEL 설치·실행은 미검증
- 네이티브 시작 검사는 앱 버전·아키텍처, 제한된 IPC, 최초 동의·빈 기록, sandbox·격리를 확인하며 수집·자동 시작을 켜거나 시스템 클립보드에 접근하지 않음
- macOS/Linux 실제 앱 간 클립보드·전역 단축키·로그인 자동 실행, Wayland 및 전체 설치·제거 흐름은 추가 검수 대상
- Windows 게시자 인증서와 Apple Developer ID·공증 미적용. OS의 첫 실행 보안 안내가 표시될 수 있음

상세: [설치 안내](docs/INSTALL.md), [1.1 플랫폼 안내](docs/07_CROSS_PLATFORM.md), [릴리스별 파일·검증 기록](https://github.com/treeview-official/ClipBox/releases/tag/v1.1.0).

## 1.0.0 — 2026-10-22

### 최초 구현

- Windows 텍스트·링크·PNG 클립보드 기록과 SQLite 영속 저장
- 기록 관리·퀵 팝업·설정 화면, 검색·필터·정렬·상세 미리보기
- 즐겨찾기·보관 정책·개별 삭제·전체 삭제 이중 확인
- 수집 동의·일시정지, 전역 단축키와 충돌 처리, 트레이, 자동 시작 설정
- 라이트·다크 테마, 제한된 preload API와 sandbox·CSP

### 검증·배포 상태

- 당시 타입 검사·빌드·단위 검사 **22개**, Windows E2E **15개**, 별도 단축키 충돌 검사 **5개** 통과
- Windows x64 NSIS 설치 파일 생성과 unpacked 앱의 시작·IPC·최초 동의 화면 확인
- 설치·제거 마법사, 재부팅 자동 시작, 코드 서명은 미검증 또는 미수행

상세: [1.0 검증 기록](docs/06_VERIFICATION.md).
