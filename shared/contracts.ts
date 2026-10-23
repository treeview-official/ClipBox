export type ClipboardKind = 'text' | 'link' | 'image';
export type Theme = 'system' | 'light' | 'dark';
export interface Settings {
  onboarded: boolean;
  collectionEnabled: boolean;
  autoStart: boolean;
  trayEnabled: boolean;
  paused: boolean;
  hotkey: string;
  maxItems: 100 | 500 | 1000 | 5000;
  retentionDays: 0 | 7 | 30 | 90;
  theme: Theme;
}
export const DEFAULT_SETTINGS: Settings = {
  onboarded: false, collectionEnabled: false, autoStart: false, trayEnabled: true,
  paused: false, hotkey: 'CommandOrControl+Shift+V', maxItems: 1000, retentionDays: 30, theme: 'system',
};
export interface ClipItem {
  id: string;
  kind: ClipboardKind;
  previewText: string;
  createdAt: number;
  isFavorite: boolean;
  byteSize: number;
  width?: number;
  height?: number;
  thumbnailDataUrl?: string;
}
export interface ClipDetail extends ClipItem { contentText?: string; imageDataUrl?: string }
export interface ListQuery {
  kind?: ClipboardKind; favorite?: boolean; query?: string;
  limit?: number; offset?: number; sort?: 'newest' | 'oldest';
}
export interface Stats { total: number; text: number; link: number; image: number; favorite: number; byteSize: number }
export interface ListResult { items: ClipItem[]; total: number; stats: Stats }
export interface AppStatus {
  settings: Settings; shortcutError: string | null; lastError: string | null;
  storagePath: string; version: string; effectiveTheme: 'light' | 'dark';
  platform: 'win32' | 'darwin' | 'linux';
  autoStartSupported: boolean;
  platformNotice: string | null;
}
export type ManagerPage = 'history' | 'settings' | 'release-notes';
export type UpdatePhase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'opening' | 'opened' | 'error' | 'unsupported';
export type InstallerFormat = 'exe' | 'dmg' | 'deb' | 'rpm' | 'tar.gz';
export interface UpdateRelease { version: string; notes: string; publishedAt: string; filename: string; bytes: number; format: InstallerFormat }
export interface UpdateState {
  phase: UpdatePhase; currentVersion: string; release?: UpdateRelease;
  progress: number; downloadedBytes: number; message: string;
}
export interface ClipBoxAPI {
  list: (query?: ListQuery) => Promise<ListResult>;
  get: (id: string) => Promise<ClipDetail | null>;
  recopy: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: (confirmation: 'DELETE_ALL') => Promise<void>;
  readStatus: () => Promise<AppStatus>;
  updateSettings: (partial: Partial<Settings>) => Promise<AppStatus>;
  windowAction: (action: 'minimize' | 'maximize' | 'close' | 'hide' | 'quit' | 'quick') => Promise<void>;
  openManager: (page?: ManagerPage) => Promise<void>;
  readUpdate: () => Promise<UpdateState>;
  checkUpdate: () => Promise<UpdateState>;
  downloadUpdate: () => Promise<UpdateState>;
  cancelUpdate: () => Promise<void>;
  installUpdate: () => Promise<UpdateState>;
  showUpdateFile: () => Promise<void>;
  openSupport: () => Promise<void>;
  onUpdate: (callback: (state: UpdateState) => void) => () => void;
  onChanged: (callback: () => void) => () => void;
  onNavigate: (callback: (page: ManagerPage) => void) => () => void;
  onShown: (callback: () => void) => () => void;
}
