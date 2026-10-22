# 03. 권장 아키텍처 / DB / 보안

## 1. 기술
- Electron main process: 클립보드 감시, 트레이, 전역 단축키, BrowserWindow, 영속 저장, 수명주기.
- Electron preload: 최소한의 타입이 명시된 `window.clipbox` 메서드만 노출.
- React + TypeScript + Vite: 퀵 팝업, 기록 관리, 설정 UI.
- SQLite: 메타데이터/텍스트/즐겨찾기. 큰 이미지 바이너리는 파일 시스템에 저장.
- Electron의 `app.getPath('userData')` 하위에 DB 및 이미지 저장소 보관.
- 환경설정은 Electron Store 또는 JSON + 검증/원자 저장, 민감정보 및 기록 본문은 설정 파일에 기록하지 말 것.
- Windows 빌드 및 네이티브 패키지 호환성을 위한 Forge 또는 builder 선정, Node ABI 리빌드 작업 포함.

## 2. 권장 디렉터리 (코덱스가 조정 가능)
```text
clipbox/
  electron/main.ts
  electron/preload.ts
  electron/clipboard-monitor.ts
  electron/database.ts
  electron/storage.ts
  electron/tray.ts
  electron/shortcuts.ts
  electron/ipc.ts
  src/components/
  src/pages/QuickPopup.tsx
  src/pages/HistoryManager.tsx
  src/pages/Settings.tsx
  src/styles/tokens.css
  src/types/clipbox.d.ts
  tests/
  assets/icons/
  package.json
```

## 3. 권장 데이터 모델

```sql
CREATE TABLE IF NOT EXISTS clipboard_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('text','link','image')),
  content_text TEXT,
  image_relpath TEXT,
  content_hash TEXT NOT NULL,
  preview_text TEXT,
  mime_type TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  image_width INTEGER,
  image_height INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_copied_at INTEGER,
  CHECK ((kind = 'image' AND image_relpath IS NOT NULL)
    OR (kind IN ('text','link') AND content_text IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_clips_created ON clipboard_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_favorite ON clipboard_items(is_favorite, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_hash ON clipboard_items(content_hash);
```

- v1 검색은 `LIKE`/case-insensitive 검색만으로도 충분; 기록 규모 확대 시 FTS5 선택적 도입.
- 최초 실행시 DB 스키마/버전 마이그레이션 처리.
- 이미지 상대 경로만 DB에 저장, 모든 경로는 지정된 이미지 저장 루트 안으로 제한(경로 순회 방지).
- 콘텐츠 해시는 SHA-256. 현재 클립보드 해시를 마지막 감지값으로 유지하여 폴링 중복 방지.
- 같은 텍스트가 이후 다시 복사되었을 때 새 레코드 생성/기존 레코드 최신화 정책은 하나로 일관되게 선택하고 사용자에게 설명. 권장: 기존 동일 콘텐츠 재복사 감지가 확인될 경우 최근 항목 갱신, 즐겨찾기 상태 보존.
- 개인정보를 보호해야 할 필요가 크므로 DB는 디스크상 평문일 수 있다는 사실을 사용자에게 안내. OS 수준 디스크 암호화 외의 암호화는 후속 범위.

## 4. IPC API 계약(예시)
```ts
type ClipboardKind = 'text' | 'link' | 'image';
interface ClipItem {
  id: string;
  kind: ClipboardKind;
  previewText: string | null;
  createdAt: number;
  isFavorite: boolean;
  byteSize: number;
  width?: number;
  height?: number;
}
interface ClipBoxAPI {
  list: (filter: {kind?: ClipboardKind; favorite?: boolean; query?: string; limit?: number; offset?: number}) => Promise<ClipItem[]>;
  get: (id: string) => Promise<ClipItem & {contentText?: string; imageDataUrl?: string}>;
  recopy: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  readSettings: () => Promise<Settings>;
  updateSettings: (partial: Partial<Settings>) => Promise<Settings>;
  onItemsChanged: (callback: () => void) => () => void;
}
```

실제 구현은 IPC 엔드포인트별 스키마 검증(`zod` 등), limit 상한, 신뢰된 발신자 검사, 설정 값 제한 등을 적용. 사용하지 않는 메서드는 노출하지 않는다.

## 5. 기술적 주의점
- 클립보드 폴링은 빈 문자열과 이미지 데이터를 조심해서 비교하며, clipboard image 포맷 선택 시 OS/앱마다 다를 수 있음을 고려.
- 이미지 미리보기는 신뢰한 로컬 이미지 데이터만 안전한 프로토콜/URL로 렌더링. 임의 파일 URL을 입력값으로 노출 금지.
- 네이티브 `better-sqlite3`는 Electron ABI와 일치해야 하므로 CI/빌드시 리빌드 검증.
- 전역 단축키 등록 실패에 대한 UI/트레이 대체 진입 경로 필수.
- Electron 권고 보안 설정 적용 (context isolation, sandbox, CSP, 외부 탐색 차단, `setWindowOpenHandler` 등), 서드파티 의존성 최소화.
- 트레이 앱의 quit/close 충돌, 종료 시 타이머/리스너 정리, 재시작 중 DB 트랜잭션 내구성 검증.
- 릴리스 패키징과 코드 서명은 별개의 작업이며, 서명하지 않은 설치 파일은 Windows 경고가 표시될 수 있다.
