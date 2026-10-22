import { app, BrowserWindow, ClipboardItem, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, powerMonitor, screen, session, Tray } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ClipRepository } from './database';
import { SettingsStore, validateSettingsPatch } from './settings';
import { ClipboardImageTooLargeError, ClipboardMonitor } from './clipboard-monitor';
import { MAX_IMAGE_BYTES } from './content';
import { LinuxAutostartFile } from './autostart';
import { autoStartAvailable, DESKTOP_FILE_NAME, isWayland, linuxAutostartPath, linuxStartupExecutable, platformNotice } from './platform';
import type { AppStatus, ListQuery, ManagerPage, Settings } from '../shared/contracts';

app.setName('ClipBox');
if (process.platform === 'win32') app.setAppUserModelId('app.clipbox.desktop');
if (process.platform === 'linux') app.setDesktopName(DESKTOP_FILE_NAME);
if (!app.isPackaged && process.env.CLIPBOX_TEST_USER_DATA) {
  const testPath = path.resolve(process.env.CLIPBOX_TEST_USER_DATA);
  mkdirSync(testPath, { recursive: true });
  app.setPath('userData', testPath);
}

const devServer = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined;
const iconPath = path.join(__dirname, '../assets/icon.png');
const preloadPath = path.join(__dirname, 'preload.cjs');
const rendererPath = path.join(__dirname, '../dist/index.html');
const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
const wayland = isWayland(platform, process.env);
const trustedWindows = new Map<number, string>();
let mainWindow: BrowserWindow | null = null;
let quickWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let repository: ClipRepository;
let settingsStore: SettingsStore;
let monitor: ClipboardMonitor;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let activeShortcut: string | null = null;
let shortcutError: string | null = null;
let lastError: string | null = null;
let quitting = false;
let suspended = false;
let settingsQueue: Promise<void> = Promise.resolve();
let trayError: string | null = null;

class UserError extends Error {}

function broadcast(channel = 'clipbox:changed', ...args: unknown[]): void {
  for (const win of [mainWindow, quickWindow]) {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, ...args);
  }
}

function reportError(message: string | null): void {
  if (lastError === message) return;
  lastError = message;
  broadcast();
}

function status(): AppStatus {
  let notice = platformNotice(platform, process.env);
  if (platform === 'darwin' && app.isPackaged) {
    try {
      if (app.getLoginItemSettings().status === 'requires-approval') notice = '로그인 시 자동 시작하려면 macOS 시스템 설정의 로그인 항목에서 ClipBox를 허용해 주세요.';
    } catch { /* Login item status may be unavailable on an older OS. */ }
  }
  return {
    settings: settingsStore.get(), shortcutError, lastError: lastError ?? trayError,
    storagePath: app.getPath('userData'), version: app.getVersion(),
    effectiveTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    platform, autoStartSupported: autoStartAvailable(platform, app.isPackaged, process.execPath, process.env),
    platformNotice: notice,
  };
}

function rendererUrl(view: 'manager' | 'quick'): string {
  const url = devServer ? new URL(devServer) : new URL(pathToFileURL(rendererPath).href);
  url.searchParams.set('view', view);
  return url.href;
}

function secureWindow(win: BrowserWindow, view: 'manager' | 'quick'): void {
  const url = rendererUrl(view);
  trustedWindows.set(win.webContents.id, url);
  if (platform !== 'darwin') win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-frame-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('render-process-gone', () => reportError('화면 표시가 중단되었습니다. 앱을 다시 실행해 주세요.'));
  const id = win.webContents.id;
  win.once('closed', () => trustedWindows.delete(id));
  void win.loadURL(url).catch(() => reportError('화면을 불러오지 못했습니다. 앱을 다시 실행해 주세요.'));
}

function createMain(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1280, workArea.width), height: Math.min(840, workArea.height),
    minWidth: Math.min(850, workArea.width), minHeight: Math.min(560, workArea.height),
    show: false, frame: false, title: 'ClipBox', icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111318' : '#F7F8FA',
    webPreferences: { preload: preloadPath, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false, webviewTag: false },
  });
  const win = mainWindow;
  win.on('close', event => {
    if (!quitting && settingsStore.get().trayEnabled && (tray || platform === 'linux')) {
      event.preventDefault();
      // Linux can create a Tray object even when the shell displays no tray.
      if (platform === 'linux') win.minimize();
      else win.hide();
    } else if (!quitting) {
      quitting = true;
      app.quit();
    }
  });
  win.on('closed', () => { mainWindow = null; });
  secureWindow(win, 'manager');
  return win;
}

function showManager(page: ManagerPage = 'history'): void {
  quickWindow?.hide();
  const win = createMain();
  const show = () => {
    if (win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('clipbox:navigate', page);
    win.webContents.send('clipbox:shown');
  };
  if (win.webContents.isLoadingMainFrame()) win.webContents.once('did-finish-load', show);
  else show();
}

function createQuick(): BrowserWindow {
  if (quickWindow && !quickWindow.isDestroyed()) return quickWindow;
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  quickWindow = new BrowserWindow({
    width: Math.min(500, workArea.width), height: Math.min(680, workArea.height), show: false, frame: false, title: 'ClipBox 빠른 기록', icon: iconPath,
    resizable: false, maximizable: false, minimizable: false, skipTaskbar: true, alwaysOnTop: !wayland,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111318' : '#F7F8FA',
    webPreferences: { preload: preloadPath, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false, webviewTag: false },
  });
  const win = quickWindow;
  win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
  win.on('closed', () => { quickWindow = null; });
  secureWindow(win, 'quick');
  return win;
}

function showQuick(toggle = false): void {
  if (!settingsStore.get().onboarded) { showManager(); return; }
  if (toggle && quickWindow?.isVisible()) { quickWindow.hide(); return; }
  const win = createQuick();
  // Wayland does not expose the global cursor or permit window positioning.
  // Let its compositor place the popup using the bounded size set at creation.
  if (!wayland) {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const width = Math.min(500, area.width);
    const height = Math.min(680, area.height);
    win.setBounds({ width, height, x: area.x + Math.floor((area.width - width) / 2), y: area.y + Math.floor((area.height - height) / 2) });
  }
  const show = () => {
    if (win.isDestroyed()) return;
    win.show();
    win.focus();
    win.webContents.send('clipbox:shown');
  };
  if (win.webContents.isLoadingMainFrame()) win.webContents.once('did-finish-load', show);
  else show();
}

function configureTray(): void {
  const settings = settingsStore.get();
  if (!settings.trayEnabled) { tray?.destroy(); tray = null; trayError = null; return; }
  try {
    if (!tray) {
      const image = platform === 'darwin'
        ? nativeImage.createFromPath(path.join(__dirname, '../assets/trayTemplate.png'))
        : nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
      if (image.isEmpty()) throw new Error('Tray icon unavailable');
      if (platform === 'darwin') image.setTemplateImage(true);
      tray = new Tray(image);
      tray.on('double-click', () => showManager());
      if (platform !== 'darwin') tray.on('click', () => showQuick());
    }
    tray.setToolTip(`ClipBox · ${!settings.collectionEnabled ? '수집 꺼짐' : settings.paused ? '일시정지' : '기록 중'}`);
    tray.setContextMenu(Menu.buildFromTemplate([
    { label: '빠른 기록 열기', click: () => showQuick() },
    { label: '기록 관리', click: () => showManager() },
    { type: 'separator' },
    { label: settings.paused ? '수집 재개' : '수집 일시정지', enabled: settings.onboarded && settings.collectionEnabled,
      click: () => { void applySettings({ paused: !settingsStore.get().paused }).catch(() => reportError('설정을 저장하지 못했습니다.')); } },
    { label: '환경설정', click: () => showManager('settings') },
    { type: 'separator' },
    { label: '완전 종료', click: () => app.quit() },
    ]));
    trayError = null;
  } catch {
    tray?.destroy();
    tray = null;
    trayError = '트레이 아이콘을 표시하지 못했습니다. 앱 창이나 실행 아이콘을 통해 기록을 열 수 있습니다.';
  }
}

function configureApplicationMenu(): void {
  if (platform !== 'darwin') { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ClipBox', submenu: [
      { role: 'about' }, { type: 'separator' },
      { label: '환경설정…', accelerator: 'Command+,', click: () => showManager('settings') },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ] },
    { label: '편집', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'pasteAndMatchStyle' }, { role: 'selectAll' },
    ] },
    { label: '창', submenu: [
      { role: 'minimize' }, { role: 'zoom' }, { type: 'separator' },
      { label: '기록 관리', click: () => showManager() },
      { label: '빠른 기록 열기', click: () => showQuick() },
      { type: 'separator' }, { role: 'front' },
    ] },
  ]));
}

/** Mutates startup integration only after an explicit settings change. */
function changeAutoStart(enabled: boolean, previous: boolean): () => void {
  if (!app.isPackaged) return () => {};
  if (platform === 'linux') {
    return new LinuxAutostartFile(linuxAutostartPath(app.getPath('home'), process.env.XDG_CONFIG_HOME))
      .set(enabled, linuxStartupExecutable(process.execPath, process.env) ?? undefined);
  }
  const apply = (openAtLogin: boolean) => {
    if (platform === 'darwin') app.setLoginItemSettings({ openAtLogin });
    else app.setLoginItemSettings({ openAtLogin, path: process.execPath, args: ['--hidden'], name: 'ClipBox' });
  };
  try { apply(enabled); }
  catch (error) { try { apply(previous); } catch { /* Preserve the original native failure. */ } throw error; }
  return () => apply(previous);
}

function registerShortcut(accelerator: string): boolean {
  try { return globalShortcut.register(accelerator, () => showQuick(true)); }
  catch { return false; }
}

async function configureMonitor(): Promise<void> {
  await monitor.configure({ ...settingsStore.get(), paused: settingsStore.get().paused || suspended });
}

function applySettings(input: unknown): Promise<AppStatus> {
  const operation = settingsQueue.then(() => applySettingsTransaction(input));
  settingsQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function applySettingsTransaction(input: unknown): Promise<AppStatus> {
  let patch: Partial<Settings>;
  try { patch = validateSettingsPatch(input); }
  catch { throw new UserError('설정 값이 올바르지 않습니다. 단축키와 저장 범위를 확인해 주세요.'); }
  const previous = settingsStore.get();
  const next = { ...previous, ...patch };
  if (next.collectionEnabled && !next.onboarded) throw new UserError('기록 수집 안내를 확인한 후 수집을 켜 주세요.');
  const loginChanged = next.autoStart !== previous.autoStart;
  if (loginChanged && next.autoStart && !autoStartAvailable(platform, app.isPackaged, process.execPath, process.env)) {
    throw new UserError('자동 시작은 설치된 앱에서 설정할 수 있습니다. AppImage는 원본 파일을 안정적인 위치에 보관해 주세요.');
  }

  const shortcutChanged = next.hotkey !== previous.hotkey;
  const previousShortcut = activeShortcut;
  if (shortcutChanged && !registerShortcut(next.hotkey)) {
    shortcutError = '이 단축키를 사용할 수 없습니다. 다른 앱과 겹치지 않는 조합을 선택해 주세요.';
    broadcast();
    throw new UserError(shortcutError);
  }
  let rollbackAutoStart: (() => void) | undefined;
  try {
    if (loginChanged) rollbackAutoStart = changeAutoStart(next.autoStart, previous.autoStart);
    settingsStore.update(patch);
  } catch {
    if (shortcutChanged) globalShortcut.unregister(next.hotkey);
    try { rollbackAutoStart?.(); } catch { /* A concurrent external edit is preserved. */ }
    throw new UserError('설정을 저장하지 못했습니다. 저장 공간과 권한을 확인해 주세요.');
  }
  if (shortcutChanged) {
    if (previousShortcut && previousShortcut !== next.hotkey) globalShortcut.unregister(previousShortcut);
    activeShortcut = next.hotkey;
    shortcutError = null;
  }
  nativeTheme.themeSource = next.theme;
  await configureMonitor();
  configureTray();
  repository.cleanup(next.maxItems, next.retentionDays);
  broadcast();
  return status();
}

function requireTrusted(event: IpcMainInvokeEvent): void {
  const trusted = trustedWindows.get(event.sender.id);
  if (!trusted || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== trusted) throw new UserError('허용되지 않은 요청입니다.');
}

function idArgument(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value)) throw new UserError('항목 정보가 올바르지 않습니다.');
  return value;
}

function listArgument(value: unknown): ListQuery {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UserError('검색 조건이 올바르지 않습니다.');
  const input = value as Record<string, unknown>;
  const keys = ['kind', 'favorite', 'query', 'limit', 'offset', 'sort'];
  if (Object.keys(input).some(key => !keys.includes(key))) throw new UserError('검색 조건이 올바르지 않습니다.');
  if (input.kind !== undefined && !['text', 'link', 'image'].includes(String(input.kind))) throw new UserError('유형이 올바르지 않습니다.');
  if (input.favorite !== undefined && typeof input.favorite !== 'boolean') throw new UserError('필터가 올바르지 않습니다.');
  if (input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 1000)) throw new UserError('검색어는 1,000자 이내로 입력해 주세요.');
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || Number(input.limit) < 1 || Number(input.limit) > 200)) throw new UserError('조회 개수가 올바르지 않습니다.');
  if (input.offset !== undefined && (!Number.isInteger(input.offset) || Number(input.offset) < 0 || Number(input.offset) > 1_000_000)) throw new UserError('조회 위치가 올바르지 않습니다.');
  if (input.sort !== undefined && !['newest', 'oldest'].includes(String(input.sort))) throw new UserError('정렬 방식이 올바르지 않습니다.');
  return input as ListQuery;
}

function registerIpc(): void {
  const handle = (channel: string, fn: (event: IpcMainInvokeEvent, arg: unknown) => unknown) => {
    ipcMain.handle(`clipbox:${channel}`, async (event, ...args: unknown[]) => {
      try {
        requireTrusted(event);
        if (args.length > 1) throw new UserError('요청 형식이 올바르지 않습니다.');
        return { ok: true, value: await fn(event, args[0]) };
      } catch (error) {
        if (error instanceof UserError) return { ok: false, message: error.message };
        reportError('작업을 완료하지 못했습니다. 저장 공간과 파일 권한을 확인해 주세요.');
        return { ok: false, message: '작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
      }
    });
  };
  handle('list', (_event, query) => repository.list(listArgument(query)));
  handle('get', (_event, id) => repository.get(idArgument(id)));
  handle('recopy', async (_event, id) => {
    const item = repository.get(idArgument(id));
    if (!item) throw new UserError('항목이 삭제되었거나 존재하지 않습니다.');
    if (item.kind === 'image') {
      const buffer = repository.getImageBuffer(item.id);
      if (!buffer) throw new UserError('이미지 파일을 읽을 수 없습니다.');
      const image = nativeImage.createFromBuffer(buffer);
      if (image.isEmpty()) throw new UserError('이미지 파일을 읽을 수 없습니다.');
      await monitor.writeWithoutRecording(() => clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(buffer)], { type: 'image/png' }) })]));
    } else await monitor.writeWithoutRecording(() => clipboard.writeText(item.contentText ?? ''));
  });
  handle('toggle-favorite', (_event, id) => { repository.toggleFavorite(idArgument(id)); broadcast(); });
  handle('remove', (_event, id) => { repository.remove(idArgument(id)); broadcast(); });
  handle('clear-all', (_event, confirmation) => {
    if (confirmation !== 'DELETE_ALL') throw new UserError('전체 기록 삭제 확인이 필요합니다.');
    repository.clear();
    broadcast();
  });
  handle('read-status', () => status());
  handle('update-settings', (_event, patch) => applySettings(patch));
  handle('open-manager', (_event, page) => {
    if (page !== undefined && page !== 'history' && page !== 'settings') throw new UserError('화면 요청이 올바르지 않습니다.');
    showManager(page as ManagerPage | undefined);
  });
  handle('window-action', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new UserError('창을 찾을 수 없습니다.');
    switch (action) {
      case 'minimize': win.minimize(); break;
      case 'maximize': if (win === mainWindow) { if (win.isMaximized()) win.unmaximize(); else win.maximize(); } break;
      case 'close': win.close(); break;
      case 'hide': if (win === quickWindow || (platform !== 'linux' && tray)) win.hide(); else win.minimize(); break;
      case 'quick': showQuick(); break;
      case 'quit': app.quit(); break;
      default: throw new UserError('창 동작이 올바르지 않습니다.');
    }
  });
}

function configureSession(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  // The app is offline. The development server is the only development exception.
  const allowedOrigin = devServer ? new URL(devServer).origin : null;
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
    const url = new URL(details.url);
    const origin = url.origin.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
    callback({ cancel: origin !== allowedOrigin });
  });
  session.defaultSession.on('will-download', event => event.preventDefault());
}

function cleanup(): void {
  quitting = true;
  monitor?.stop();
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = null;
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
  try { repository?.close(); } catch { /* No private data or raw errors are logged. */ }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (settingsStore) showManager(); });
  app.on('before-quit', cleanup);
  app.on('window-all-closed', () => { if (!tray) app.quit(); });
  app.on('activate', () => { if (settingsStore) showManager(); });
  void app.whenReady().then(async () => {
    configureApplicationMenu();
    configureSession();
    settingsStore = new SettingsStore(app.getPath('userData'));
    repository = new ClipRepository(app.getPath('userData'));
    nativeTheme.themeSource = settingsStore.get().theme;
    const saved = () => {
      const settings = settingsStore.get();
      repository.cleanup(settings.maxItems, settings.retentionDays);
      broadcast();
    };
    let imageItems: Electron.ClipboardItem[] = [];
    monitor = new ClipboardMonitor({
      clipboard: {
        readText: () => clipboard.readText(),
        availableFormats: async () => {
          imageItems = await clipboard.read();
          return imageItems.flatMap(item => item.types);
        },
        readImage: async () => {
          for (const item of imageItems) {
            // Never read custom OS formats, HTML, or file references.
            const mime = item.types.includes('image/png') ? 'image/png' : item.types.includes('image/jpeg') ? 'image/jpeg' : null;
            if (!mime) continue;
            const blob = await item.getType(mime);
            if (blob.size > MAX_IMAGE_BYTES) throw new ClipboardImageTooLargeError();
            return nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
          }
          return null;
        },
      },
      saveText: text => { repository.upsertText(text); saved(); },
      saveImage: (png, width, height, thumbnail) => { repository.upsertImage(png, width, height, thumbnail); saved(); },
      onError: reportError,
    });
    registerIpc();
    configureTray();
    if (registerShortcut(settingsStore.get().hotkey)) activeShortcut = settingsStore.get().hotkey;
    else shortcutError = '빠른 열기 단축키를 등록하지 못했습니다. 설정에서 다른 조합을 선택해 주세요.';
    await configureMonitor();
    const initialSettings = settingsStore.get();
    repository.cleanup(initialSettings.maxItems, initialSettings.retentionDays);
    cleanupTimer = setInterval(() => {
      try {
        const settings = settingsStore.get();
        repository.cleanup(settings.maxItems, settings.retentionDays);
        broadcast();
      } catch { reportError('오래된 기록을 정리하지 못했습니다. 저장 공간과 권한을 확인해 주세요.'); }
    }, 5 * 60_000);
    cleanupTimer.unref();
    nativeTheme.on('updated', () => broadcast());
    powerMonitor.on('suspend', () => { suspended = true; void configureMonitor(); });
    powerMonitor.on('resume', () => { suspended = false; void configureMonitor(); });
    let openedAtLogin = process.argv.includes('--hidden');
    if (platform === 'darwin' && app.isPackaged) {
      try { openedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin; } catch { openedAtLogin = false; }
    }
    // A Linux status notifier object cannot establish that a tray icon is visible.
    if (platform === 'linux' || !openedAtLogin || !initialSettings.onboarded || !tray) showManager();
  }).catch(() => {
    dialog.showErrorBox('ClipBox 시작 오류', '로컬 저장소를 열거나 앱을 시작하지 못했습니다. 기존 기록은 삭제하지 않았습니다. 저장 공간과 파일 권한을 확인해 주세요.');
    app.quit();
  });
}
