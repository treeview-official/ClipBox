import test from 'node:test';
import assert from 'node:assert/strict';
import { platformLabels, primaryModifier, recordShortcut, shortcutLabel } from '../shared/platform-ui';

const key = { key: 'v', code: 'KeyV', ctrlKey: false, altKey: false, metaKey: false, shiftKey: true };

test('shortcut hints use Command on macOS and Control on Windows/Linux', () => {
  assert.equal(shortcutLabel('CommandOrControl+Shift+V', 'darwin'), '⌘ + Shift + V');
  for (const platform of ['win32', 'linux'] as const) assert.equal(shortcutLabel('CommandOrControl+Shift+V', platform), 'Ctrl + Shift + V');
  assert.equal(shortcutLabel('Control+Alt+V', 'darwin'), 'Ctrl + Option + V');
});

test('macOS recorder preserves Command and physical Control as different modifiers', () => {
  assert.deepEqual(recordShortcut({ ...key, metaKey: true }, 'darwin'), { kind: 'shortcut', accelerator: 'CommandOrControl+Shift+V' });
  assert.deepEqual(recordShortcut({ ...key, ctrlKey: true }, 'darwin'), { kind: 'shortcut', accelerator: 'Control+Shift+V' });
  assert.deepEqual(recordShortcut({ ...key, metaKey: true, ctrlKey: true }, 'darwin'), { kind: 'shortcut', accelerator: 'CommandOrControl+Control+Shift+V' });
});

test('Windows/Linux recorder keeps Control accelerators and rejects unmodified keys', () => {
  for (const platform of ['win32', 'linux'] as const) {
    assert.deepEqual(recordShortcut({ ...key, ctrlKey: true }, platform), { kind: 'shortcut', accelerator: 'CommandOrControl+Shift+V' });
    assert.equal(recordShortcut(key, platform).kind, 'error');
  }
  assert.deepEqual(recordShortcut({ ...key, key: 'Escape' }, 'darwin'), { kind: 'cancel' });
  assert.deepEqual(recordShortcut({ ...key, key: 'Meta', metaKey: true }, 'darwin'), { kind: 'modifier' });
});

test('in-app copy/search uses the native primary modifier', () => {
  assert.equal(primaryModifier({ ctrlKey: true, metaKey: false }, 'darwin'), false);
  assert.equal(primaryModifier({ ctrlKey: false, metaKey: true }, 'darwin'), true);
  assert.equal(primaryModifier({ ctrlKey: true, metaKey: false }, 'win32'), true);
  assert.equal(primaryModifier({ ctrlKey: true, metaKey: false }, 'linux'), true);
});

test('startup and background wording reflect each desktop platform', () => {
  assert.equal(platformLabels('win32').startup, 'Windows 시작 시 자동 실행');
  assert.equal(platformLabels('darwin').startup, '로그인 시 자동 실행');
  assert.equal(platformLabels('linux').startup, '로그인 시 자동 실행');
  assert.match(platformLabels('darwin').background, /메뉴 막대/);
  assert.match(platformLabels('linux').backgroundDescription, /작업 표시줄로 최소화/);
});
