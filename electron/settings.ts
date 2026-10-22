import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS, type Settings } from '../shared/contracts';

const booleanKeys = ['onboarded', 'collectionEnabled', 'autoStart', 'trayEnabled', 'paused'] as const;
const validKeys = new Set(Object.keys(DEFAULT_SETTINGS));

export function validateSettingsPatch(input: unknown): Partial<Settings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('설정 형식이 올바르지 않습니다.');
  const source = input as Record<string, unknown>;
  if (Object.keys(source).some((key) => !validKeys.has(key))) throw new Error('지원하지 않는 설정 항목입니다.');
  const result: Partial<Settings> = {};
  for (const key of booleanKeys) {
    if (Object.hasOwn(source, key)) {
      if (typeof source[key] !== 'boolean') throw new Error('설정 값은 켜기 또는 끄기여야 합니다.');
      result[key] = source[key];
    }
  }
  if (Object.hasOwn(source, 'hotkey')) {
    if (typeof source.hotkey !== 'string' || source.hotkey.length > 80 || !isShortcut(source.hotkey)) {
      throw new Error('Ctrl, Alt 또는 Super 키를 포함한 올바른 단축키를 입력해 주세요.');
    }
    result.hotkey = source.hotkey;
  }
  if (Object.hasOwn(source, 'maxItems')) {
    if (![100, 500, 1000, 5000].includes(source.maxItems as number)) throw new Error('저장 개수 설정이 올바르지 않습니다.');
    result.maxItems = source.maxItems as Settings['maxItems'];
  }
  if (Object.hasOwn(source, 'retentionDays')) {
    if (![0, 7, 30, 90].includes(source.retentionDays as number)) throw new Error('보관 기간 설정이 올바르지 않습니다.');
    result.retentionDays = source.retentionDays as Settings['retentionDays'];
  }
  if (Object.hasOwn(source, 'theme')) {
    if (!['system', 'light', 'dark'].includes(source.theme as string)) throw new Error('테마 설정이 올바르지 않습니다.');
    result.theme = source.theme as Settings['theme'];
  }
  return result;
}

function isShortcut(value: string): boolean {
  const parts = value.split('+');
  const key = parts.pop();
  if (!key || !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Enter|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right)$/i.test(key)) return false;
  const modifiers = parts.map((part) => part.toLowerCase());
  if (!modifiers.length || new Set(modifiers).size !== modifiers.length) return false;
  return modifiers.every((part) => ['commandorcontrol', 'cmdorctrl', 'control', 'ctrl', 'alt', 'shift', 'super', 'meta', 'command', 'cmd'].includes(part)) &&
    modifiers.some((part) => part !== 'shift');
}

export class SettingsStore {
  private readonly filePath: string;
  private settings: Settings;

  constructor(root: string) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw new Error('설정 저장 폴더에 연결된 경로를 사용할 수 없습니다.');
    if (process.platform !== 'win32') chmodSync(root, 0o700);
    this.filePath = path.join(root, 'settings.json');
    this.settings = { ...DEFAULT_SETTINGS };
    const fileInfo = lstatSync(this.filePath, { throwIfNoEntry: false });
    if (fileInfo) {
      try {
        if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) throw new Error('Invalid settings path');
        if (process.platform !== 'win32') chmodSync(this.filePath, 0o600);
        this.settings = { ...DEFAULT_SETTINGS, ...validateSettingsPatch(JSON.parse(readFileSync(this.filePath, 'utf8'))) };
      } catch {
        // Leave the original untouched. A corrupt consent file must never re-enable collection.
        throw new Error('설정 파일을 읽을 수 없습니다. 기존 파일은 보존되었습니다.');
      }
    }
  }

  get(): Settings { return { ...this.settings }; }

  update(partial: Partial<Settings>): Settings {
    const next = { ...this.settings, ...validateSettingsPatch(partial) };
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, 'wx', 0o600);
      writeFileSync(descriptor, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporary, this.filePath);
      this.settings = next;
    } catch {
      throw new Error('설정을 저장하지 못했습니다. 저장 공간과 파일 권한을 확인해 주세요.');
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      if (existsSync(temporary)) unlinkSync(temporary);
    }
    return this.get();
  }
}
