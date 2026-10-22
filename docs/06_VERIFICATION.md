# ClipBox 1.0.0 검증 결과

검증일: 2026-10-22 (Asia/Seoul). 환경: Windows 11 x64, OS 10.0.26200, 개발 Node 24.11.0, Electron 45.0.0 / 내장 Node 24.22.0.

## 명령과 결과

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm test` | 22개 통과, 실패 없음 |
| `npm run build` | React/Vite 및 Electron main/preload 번들 생성 |
| `npm run test:e2e` | 실제 Electron 창 및 Windows 클립보드 15개 검사 통과 |
| `node scripts/hotkey-qa.mjs` | 별도 Electron 프로세스로 단축키를 선점한 통합 검사 5개 통과 |
| `npm audit` | 알려진 취약점 0개 (검사 당시의 의존성 데이터 기준) |
| `npm run dist` | Windows x64 NSIS 설치 프로그램 및 win-unpacked 생성 |
| `node scripts/package-smoke.mjs` | 배포 EXE에서 최초 안내·수집 OFF·빈 저장소·preload IPC·렌더러 정상 확인 |

## 단위 검사

저장소 15개: 재시작 영속성, 원문·URL 분류, 동일 내용 병합과 즐겨찾기 유지, Unicode 검색과 SQL 와일드카드·삽입 문자열의 리터럴 처리, 페이지·정렬·필터, 개수·기간 정리에서 즐겨찾기 제외, 이미지·썸네일 삭제, 실패한 파일 삭제 재시도, 경로 이탈 차단, 손상·누락·초과 이미지, 스키마 마이그레이션, 손상 DB·설정 보존, 원자 저장 실패 처리.

감시기 7개: 동의 전 접근 금지, 시작 기준값, 중복 억제, 일시정지·재개 기준값, 자기 복사 억제, 잠긴 클립보드 재시도, 초과 텍스트 건너뛰기, 비동기 읽기 도중 일시정지·재복사 경쟁 조건. 일부 검사는 여러 조건을 함께 검사합니다.

## Windows 통합 검사

`scripts/e2e.mjs`는 별도 임시 프로필에서 실제 OS 클립보드에 합성 텍스트·URL·한글·이모지·여러 줄·PNG를 쓰고 수집을 확인했습니다. 기록을 직접 DB에 주입하거나 모의 API로 대체하지 않았습니다.

- 최초 동의 전 저장 없음, 동의 시 기존 클립보드 미수집
- 텍스트·URL·이미지 수집과 썸네일·재복사·중복 방지
- 화면 검색·선택·미리보기·즐겨찾기
- 850×560 창의 상세 패널·검색 접근과 가로 넘침 없음
- 일시정지 중 내용 미수집, 재개 후 과거 내용 미수집
- 미저장 설정이 외부 설정 변경에 유지되고 편집한 필드만 저장
- 라이트·다크 테마 저장과 적용
- 퀵 팝업 검색 포커스·검색·Enter 재복사·숨김
- sandbox/contextIsolation 및 Node 접근 차단, 잘못된 IPC 입력 거부, 외부 fetch 차단
- 전역 단축키의 Windows 등록 상태
- 관리 창 닫은 후 트레이 백그라운드 수집
- 재실행 후 기록·이미지·즐겨찾기·설정 유지
- 이미지 삭제 시 파일 정리, 전체 삭제의 두 단계 확인
- 렌더러 예외 없음

`scripts/hotkey-qa.mjs`는 다른 Electron 프로세스가 기본 단축키를 실제로 선점한 상태에서 시작 충돌 안내, 다른 설정 저장, 새 단축키 등록, 충돌하는 변경의 원자적 거부, 선점 해제 후 재등록과 이전 키 해제를 확인했습니다. 이 검사는 사용자 클립보드를 읽거나 쓰지 않습니다.

기계 판독 결과: `artifacts/qa/e2e-results.json`, `artifacts/qa/hotkey-results.json`.
배포 실행 결과: `artifacts/qa/package-results.json`, `07-packaged-startup.png`.
화면: `01-onboarding.png`, `02-history.png`, `03-settings.png`, `04-dark.png`, `05-quick.png`, `06-compact.png`. 화면의 기록은 테스트용 합성 데이터입니다.

## 패키징과 알려진 제약

산출물은 `release/ClipBox-Setup-1.0.0.exe`와 `release/win-unpacked/ClipBox.exe`입니다. 설치 파일은 서명되지 않았으며, 앱 EXE의 제품명·아이콘 리소스를 빌드에 포함했습니다. 두 실행 파일의 SHA256은 `release/SHA256SUMS.txt`에서 확인할 수 있습니다.

다음 항목은 완료로 주장하지 않습니다.

- NSIS 설치 마법사를 통한 실제 설치·제거, 바로 가기 생성·제거 검수
- Windows 재부팅 후 자동 시작, 앱 제거 후 시작 항목 정리의 실기기 검수
- 다른 앱에서 물리 키보드로 전역 단축키 호출, 메모장·그림판 등 모든 대상 앱의 실제 붙여넣기
- 다중 모니터와 실제 125%/150% 디스플레이 배율, 장시간 CPU·메모리·대규모 기록 부하
- Windows 10, ARM, macOS, Linux 지원 검증
- 코드 서명, 자동 업데이트, 민감정보 자동 탐지, 암호화, 자동 붙여넣기

이미지 폴링과 큰 PNG 처리에는 CPU·메모리 비용이 있으며, 정해진 크기 제한과 재인코딩 억제를 적용했습니다. 동일 클립보드 상태의 명시적 재복사 횟수는 추적하지 않습니다. 데이터는 로컬 평문이며, 초기 안내와 설정에 이를 표시했습니다.
