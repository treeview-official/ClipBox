import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// A separate real Electron process owns the default global shortcut. Both
// processes use disposable profiles; collection remains disabled throughout.
const profileRoot = await mkdtemp(path.join(os.tmpdir(), 'clipbox-hotkey-qa-'));
const holderProfile = path.join(profileRoot, 'holder');
const clipboxProfile = path.join(profileRoot, 'clipbox');
const helperFile = path.join(profileRoot, 'holder.cjs');
const artifacts = path.resolve('artifacts/qa');
await Promise.all([mkdir(holderProfile), mkdir(clipboxProfile), mkdir(artifacts, { recursive: true })]);
await writeFile(helperFile, `const { app, globalShortcut } = require('electron');
app.setName('ClipBox Hotkey QA Holder');
app.setPath('userData', process.env.CLIPBOX_QA_HOLDER_PROFILE);
app.on('before-quit', () => globalShortcut.unregisterAll());
app.whenReady().then(() => {
  globalShortcut.register('Control+Shift+V', () => {});
});
`);
const env = { ...process.env, CLIPBOX_TEST_USER_DATA: clipboxProfile, CLIPBOX_QA_HOLDER_PROFILE: holderProfile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;
const defaultHotkey = 'CommandOrControl+Shift+V';
const checks = [];
const pass = label => { checks.push(label); console.log(`PASS ${label}`); };
let holder;
let clipbox;
let succeeded = false;

try {
  holder = await electron.launch({ args: [helperFile], env, timeout: 30_000 });
  assert.equal(await holder.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Control+Shift+V')), true,
    'The default shortcut is already owned by another application; close that application before running this test.');
  clipbox = await electron.launch({ args: ['.'], env, timeout: 30_000 });
  const page = await clipbox.firstWindow();
  await page.waitForFunction(() => !!window.clipbox);
  const readStatus = () => page.evaluate(() => window.clipbox.readStatus());
  const update = patch => page.evaluate(value => window.clipbox.updateSettings(value), patch);
  const isRegistered = key => clipbox.evaluate(({ globalShortcut }, accelerator) => globalShortcut.isRegistered(accelerator), key);
  const initial = await readStatus();
  assert.ok(initial.shortcutError);
  assert.equal(initial.settings.onboarded, false);
  assert.equal(await isRegistered(defaultHotkey), false);
  pass('A real second process owns the default shortcut and startup reports its collision');

  await update({ onboarded: true, collectionEnabled: false });
  await update({ theme: 'dark', paused: true });
  // Settings UI submits a complete draft, including the unchanged hotkey.
  await update({ ...(await readStatus()).settings, theme: 'light' });
  const afterSettings = await readStatus();
  assert.equal(afterSettings.settings.onboarded, true);
  assert.equal(afterSettings.settings.collectionEnabled, false);
  assert.equal(afterSettings.settings.theme, 'light');
  assert.equal(afterSettings.settings.paused, true);
  assert.ok(afterSettings.shortcutError);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  pass('Consent acceptance, pause, theme and full settings drafts save while the startup shortcut is unavailable');

  let customHotkey;
  for (const key of ['Control+Alt+Shift+F12', 'Control+Alt+Shift+F11', 'Control+Alt+Shift+F10']) {
    try { await update({ hotkey: key }); customHotkey = key; break; } catch { /* Try another unoccupied test shortcut. */ }
  }
  assert.ok(customHotkey, 'No test shortcut could be registered.');
  assert.equal(await isRegistered(customHotkey), true);
  assert.equal((await readStatus()).shortcutError, null);
  pass('A custom shortcut registers with the native Windows global shortcut API');

  const beforeFailedChange = (await readStatus()).settings;
  await assert.rejects(update({ hotkey: defaultHotkey, theme: 'dark' }), /단축키/);
  assert.deepEqual((await readStatus()).settings, beforeFailedChange);
  assert.equal(await isRegistered(customHotkey), true);
  assert.equal(await holder.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Control+Shift+V')), true);
  pass('A rejected shortcut replacement preserves the previous registration and all saved settings');

  await holder.close();
  holder = undefined;
  await update({ hotkey: defaultHotkey });
  assert.equal(await isRegistered(defaultHotkey), true);
  assert.equal(await isRegistered(customHotkey), false);
  assert.equal((await readStatus()).shortcutError, null);
  assert.equal((await page.evaluate(() => window.clipbox.list())).total, 0);
  pass('After the other process exits, the default shortcut can replace the custom shortcut without collecting clipboard data');
  succeeded = true;
} finally {
  await Promise.allSettled([clipbox?.close(), holder?.close()]);
  await writeFile(path.join(artifacts, 'hotkey-results.json'), JSON.stringify({ result: succeeded ? 'passed' : 'failed', platform: process.platform, checks }, null, 2));
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profileRoot).startsWith(tempRoot) && path.basename(profileRoot).startsWith('clipbox-hotkey-qa-')) {
    await rm(profileRoot, { recursive: true, force: true });
  }
}
