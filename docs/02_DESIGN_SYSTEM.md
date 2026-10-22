# 02. UI 디자인 시스템 / 화면 명세 (v1.0)

## 원칙
이미지 참고: `design/mockups/01-history-manager.png`, `02-quick-popup.png`, `03-settings.png`, `04-developer-handoff-board.png`.
시안에 표시된 카운트/타임스탬프/선택 상태/문장 등은 샘플. 실제 상태에 맞춰 실시간 렌더링한다.

## 컬러 토큰
| 토큰 | 라이트 | 다크 (권장) |
|---|---|---|
| primary | `#4F46E5` | `#818CF8` |
| pageBackground | `#F7F8FA` | `#111318` |
| surface | `#FFFFFF` | `#1D2028` |
| surfaceMuted | `#F3F4F6` | `#252934` |
| textPrimary | `#111827` | `#F3F4F6` |
| textSecondary | `#6B7280` | `#AAB1C2` |
| border | `#E5E7EB` | `#303440` |
| destructive | `#DC2626` | `#F87171` |

## 구성 원칙
- 폰트: Pretendard 우선, `Segoe UI`, `Malgun Gothic`, system sans fallback. 폰트 재배포 라이선스 확인 또는 시스템 폰트 사용.
- 본문 13~14px, 보조 11~12px, 섹션 16~18px semibold.
- 기본 간격 8px 배수, border-radius 10~16px, 그림자는 얕게.
- 아이콘 Lucide React, 기본 18~20px.
- 독립 스크롤 영역, 고정 검색/헤더, hover/focus/selected/disabled/empty states 모두 제공.
- 최소 대비/키보드 초점표시를 고려. 축소 DPI와 125/150% 배율에서 레이아웃이 깨지지 않게 구성.

## 화면 1. 퀵 팝업
- 콘텐츠 너비 약 440px, 높이 약 580px. 모니터의 usable bounds 안에 표시. 화면 가장자리에서 잘리면 위치 보정.
- 타이틀바: ClipBox 아이콘/이름, 열기 상태, 닫기.
- 검색 input 자동 포커스. Esc 닫기. 검색 결과 없을 때 안내와 전체 필터로 돌아가기 제공.
- 탭: 전체, 텍스트, 이미지, 즐겨찾기. 링크는 기록 관리 내 별도 카테고리(퀵 팝업에서는 전체에 포함).
- 리스트: 1~2줄 미리보기, 유형/시간, 미니 썸네일, 즐겨찾기. 선택 항목에 indigo outline 및 옅은 배경.
- 푸터: ↑/↓ 이동, Enter 복사, Esc 닫기. MVP 단계에서 'Enter 붙여넣기'라고 표기하지 말 것(실제 자동 붙여넣기 기능이 있을 때만 표시).
- 팝업 열기/닫기 시 모션 120~180ms 이하. 포커스/탭 이동 키보드 테스트.

## 화면 2. 전체 기록 관리
- 기본 1000×700px, 최소 850×560px 정도.
- 좌측 사이드바 폭 220px 내외: 전체 기록 / 텍스트 / 이미지 / 링크 / 즐겨찾기 / 환경설정.
- 중앙 목록: 검색바(상단), 정렬/필터, 각 항목의 아이콘·축약 텍스트·타임스탬프·액션.
- 우측 상세 패널: 초기 폭 330px(좁을 때 접힘), 원문/이미지 미리보기, 유형·날짜·크기, 복사·즐겨찾기·삭제.
- 이미지 미리보기에는 가로/세로 비율 유지, 정해진 영역 내 contain, 깨진 이미지 오류 대체.
- Empty states: 아직 기록 없음 / 검색 결과 없음 / 이미지 없음 / 일시정지 활성화.
- 날짜는 시스템 로컬 시간 기준(`오늘 HH:mm`, 이전 날짜는 `YYYY-MM-DD HH:mm`), 미리보기 코드/URL은 줄바꿈 처리.

## 화면 3. 환경설정
- 메인 창에서 표시; '일반 / 단축키 / 저장 / 개인정보 / 테마 / 정보' 그룹으로 구성.
- 일반: 수집 활성화, Windows 자동 시작, 트레이 상주, 일시정지/재개.
- 단축키: 충돌/미등록 오류 표시; 새 조합 녹화 및 저장.
- 저장: 최대 개수 100 / 500 / 1000 / 5000, 보관 기간 7 / 30 / 90일 / 제한 없음.
- 개인정보: 로컬 저장 안내, 자동 탐지의 한계 고지, 전체 기록 삭제 버튼과 확인 모달.
- 테마: 시스템 / 라이트 / 다크.
- 정보: 버전, 저장 위치, 저장 용량, 수집 동작 상태.

## 컴포넌트
`AppShell`, `SidebarNav`, `SearchField`, `FilterTabs`, `ClipboardList`, `ClipboardItem`, `ClipboardPreview`, `FavoriteButton`, `ConfirmDialog`, `SettingsRow`, `ShortcutRecorder`, `StatusIndicator`, `Toast`, `EmptyState`, `ImageThumbnail`.

## 반드시 구현할 상태
- Loading(초기 DB 로드), Empty, Filtered-empty, Permission/Consent-required, Paused, Hotkey-conflict, Clipboard-unavailable, Oversized-image, Database-error, Selected, Focus-visible.
