# 문서 모음

처음 사용하는 경우 [설치 가이드](INSTALL.md)에서 내 OS용 파일을 받으세요. 설치 후 사용법은 [시작 가이드](GETTING_STARTED.md), 지원 환경과 확인된 범위는 [1.1 플랫폼 안내](07_CROSS_PLATFORM.md)에 있습니다.

## 현재 사용법과 상태

| 문서 | 내용 |
|---|---|
| [프로젝트 소개](../README.md) | 주요 기능, 빠른 실행, 지원 상태 |
| [설치 가이드](INSTALL.md) | 직접 다운로드, Windows·Mac·Linux 설치, 첫 실행 보안 안내 |
| [시작 가이드](GETTING_STARTED.md) | 실행·설치, 기록 사용법, 설정·개인정보, 문제 해결 |
| [1.1 플랫폼 안내](07_CROSS_PLATFORM.md) | macOS/Linux 동작, Linux 실행 항목, 빌드·검증 범위 |
| [변경 이력](../CHANGELOG.md) | 버전별 기능과 배포 상태 |
| [작업 지침](../AGENTS.md) | 프로젝트 수정 시 지켜야 할 기준 |

## 원본 기획과 디자인

아래 문서는 최초 **Windows 중심 설계**와 전달 자료입니다. 기록의 샘플 수치나 권장 라이브러리를 현재 구현으로 간주하지 마세요. 1.1의 macOS/Linux 범위는 [플랫폼 안내](07_CROSS_PLATFORM.md)를 함께 적용합니다. 현재 SQLite 구현은 Electron 내장 `node:sqlite`입니다.

| 문서 | 내용 |
|---|---|
| [개발 인수인계 자료](00_HANDOFF_README.md) | 최초 패키지의 구성과 사용 안내 |
| [제품 명세](01_PRODUCT_SPEC.md) | 사용자 흐름, 수집·검색·정리 요구사항 |
| [디자인 시스템](02_DESIGN_SYSTEM.md) | 색상·컴포넌트·화면 상태 |
| [권장 아키텍처](03_ARCHITECTURE.md) | 초기 구조·데이터 모델·보안 설계 |
| [구현 단계](04_IMPLEMENTATION.md) | 단계별 수용 기준과 완료 정의 |
| [Windows QA 체크리스트](05_QA_CHECKLIST.md) | 원본 수동·자동 검수 목록 |
| [UI 목업](../design/mockups/) | 구현 전 참고 시안; 실제 앱 화면과 구분 |
| [최초 구현 프롬프트](../CODEX_START_PROMPT.md) | 개발 전달 당시의 요청 기록 |

## 검증 기록

| 자료 | 범위 |
|---|---|
| [1.0 Windows 검증](06_VERIFICATION.md) | 당시의 소스·단축키·배포 실행 검사; 역사적 기록 |
| [1.1 검증 요약 JSON](../artifacts/qa/cross-platform-results.json) | Windows 단위 37개·E2E 15개 통과, macOS·Ubuntu 단위 각 39개 통과, 실제 GUI 미검증 범위 |
| [GitHub 소스 CI](https://github.com/treeview-official/ClipBox/actions/workflows/ci.yml) | Windows·macOS·Ubuntu 타입 검사·단위 검사·프로덕션 소스 빌드 |
| [Windows E2E 결과](../artifacts/qa/e2e-results.json) | 실제 UI·클립보드 검사 항목 |
| [기존 단축키 충돌 검사](../artifacts/qa/hotkey-results.json) | 별도 프로세스의 키 선점과 재등록 검사 |
| [1.0 배포 실행 결과](../artifacts/qa/package-results.json) | unpacked Windows 앱 시작과 IPC 검사 |

과거 Windows 배포 실행 성공을 macOS/Linux의 네이티브 실행 성공이나 1.1 Windows 설치 마법사 검증으로 해석하지 않습니다. 실제 OS별 설치·로그인 자동 실행·포커스 검수는 [남은 검수 항목](07_CROSS_PLATFORM.md#데이터와-남은-검수)에 정리했습니다.

## 실제 화면

아래 이미지는 Windows에서 합성 데이터로 실행한 QA 화면입니다. 1.1 캡처 일부에는 실제 전역 단축키 충돌 안내가 표시되어 있습니다.

- [기록 관리](../artifacts/qa/02-history.png)
- [빠른 팝업](../artifacts/qa/05-quick.png)
- [다크 테마 설정](../artifacts/qa/04-dark.png)
- [850×560 창](../artifacts/qa/06-compact.png)

빌드 파일은 저장소의 소스와 분리하며, 생성 명령과 결과 경로는 [시작 가이드](GETTING_STARTED.md#패키지-빌드)를 참고하세요.
