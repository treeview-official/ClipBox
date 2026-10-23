import { contextBridge, ipcRenderer } from 'electron';
import type { ClipBoxAPI, ManagerPage, UpdateState } from '../shared/contracts';

type Reply<T> = { ok: true; value: T } | { ok: false; message: string };

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await ipcRenderer.invoke(channel, ...args) as Reply<T>;
  if (!result || !result.ok) throw new Error(result && 'message' in result ? result.message : '요청을 처리하지 못했습니다.');
  return result.value;
}

function listen(channel: string, callback: (...args: any[]) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: ClipBoxAPI = {
  list: query => invoke('clipbox:list', query),
  get: id => invoke('clipbox:get', id),
  recopy: id => invoke('clipbox:recopy', id),
  toggleFavorite: id => invoke('clipbox:toggle-favorite', id),
  remove: id => invoke('clipbox:remove', id),
  clearAll: confirmation => invoke('clipbox:clear-all', confirmation),
  readStatus: () => invoke('clipbox:read-status'),
  updateSettings: partial => invoke('clipbox:update-settings', partial),
  windowAction: action => invoke('clipbox:window-action', action),
  openManager: page => invoke('clipbox:open-manager', page),
  readUpdate: () => invoke('clipbox:read-update'),
  checkUpdate: () => invoke('clipbox:check-update'),
  downloadUpdate: () => invoke('clipbox:download-update'),
  cancelUpdate: () => invoke('clipbox:cancel-update'),
  installUpdate: () => invoke('clipbox:install-update'),
  showUpdateFile: () => invoke('clipbox:show-update-file'),
  openSupport: () => invoke('clipbox:open-support'),
  onUpdate: callback => listen('clipbox:update', (state: UpdateState) => callback(state)),
  onChanged: callback => listen('clipbox:changed', callback),
  onNavigate: callback => listen('clipbox:navigate', (page: ManagerPage) => callback(page)),
  onShown: callback => listen('clipbox:shown', callback),
};

contextBridge.exposeInMainWorld('clipbox', Object.freeze(api));
