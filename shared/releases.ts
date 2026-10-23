export const SUPPORT_EMAIL = 'tree_view@naver.com';
export const RELEASE_NOTES = [
  { version: '1.2.0', date: '2026-10-23', title: '업데이트를 더 편하게', changes: [
    '상단 기록 상태와 창 제어 버튼의 세로 정렬을 맞췄습니다.',
    '환경설정에 업데이트 확인, 다운로드 진행률, 취소·재시도와 설치 파일 열기를 추가했습니다.',
    'Windows·Mac 칩 종류·Linux 배포판에 맞는 공식 설치 파일을 선택하고 SHA-256으로 확인합니다.',
    '환경설정 아래 패치노트 메뉴와 요청사항·오류 문의 이메일을 추가했습니다.',
  ] },
  { version: '1.1.0', date: '2026-10-22', title: 'Mac과 Linux에서도 ClipBox', changes: [
    'Windows EXE, Mac Apple Silicon·Intel DMG, Linux DEB·RPM 설치 파일을 제공했습니다.',
    '운영체제별 단축키·자동 시작·백그라운드 동작을 지원합니다.',
    '한국어 글꼴을 앱에 포함해 글꼴이 없는 환경에서도 한글을 표시합니다.',
  ] },
  { version: '1.0.0', date: '2026-10-22', title: '첫 번째 ClipBox', changes: [
    '텍스트·링크·이미지의 로컬 기록, 검색, 즐겨찾기와 상세 미리보기를 제공합니다.',
    '빠른 기록 팝업, 재복사, 일시정지, 저장 기간과 화면 테마 설정을 제공합니다.',
    '기록 수집은 동의 후 시작하며 기존 기록은 이 컴퓨터에 보관합니다.',
  ] },
] as const;
