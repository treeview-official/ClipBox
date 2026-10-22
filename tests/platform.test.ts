import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LinuxAutostartFile } from '../electron/autostart';
import { AUTOSTART_OWNER_MARKER, DESKTOP_FILE_NAME, autoStartAvailable, isWayland, linuxAutostartEntry, linuxAutostartPath, linuxStartupExecutable, platformNotice, quoteDesktopExec } from '../electron/platform';

function removeFixture(root: string): void {
  const resolved = path.resolve(root);
  if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('clipbox-platform-test-')) throw new Error('Unexpected fixture directory');
  rmSync(resolved, { recursive: true, force: true });
}

test('XDG autostart uses only the user config path and a fixed application filename', () => {
  assert.equal(linuxAutostartPath('/home/alice'), `/home/alice/.config/autostart/${DESKTOP_FILE_NAME}`);
  assert.equal(linuxAutostartPath('/home/alice', '/mnt/user config'), `/mnt/user config/autostart/${DESKTOP_FILE_NAME}`);
  assert.equal(linuxAutostartPath('/home/alice', 'relative/config'), `/home/alice/.config/autostart/${DESKTOP_FILE_NAME}`);
  assert.equal(linuxAutostartPath('/home/alice', '/invalid\nconfig'), `/home/alice/.config/autostart/${DESKTOP_FILE_NAME}`);
  assert.throws(() => linuxAutostartPath('relative-home'));
});

test('AppImage autostart keeps the original file and refuses transient mount paths', () => {
  const mounted = '/tmp/.mount_ClipBo1234/app.clipbox.desktop';
  assert.equal(linuxStartupExecutable(mounted, { APPIMAGE: '/home/alice/Apps/ClipBox.AppImage' }), '/home/alice/Apps/ClipBox.AppImage');
  assert.equal(linuxStartupExecutable(mounted, {}), null);
  assert.equal(linuxStartupExecutable('/run/user/1000/squashfs/AppRun', { APPDIR: '/run/user/1000/squashfs' }), null);
  assert.equal(linuxStartupExecutable('/opt/ClipBox/app.clipbox.desktop', {}), '/opt/ClipBox/app.clipbox.desktop');
  assert.equal(linuxStartupExecutable(mounted, { APPIMAGE: 'relative.AppImage' }), null);
  assert.equal(linuxStartupExecutable(mounted, { APPIMAGE: '/tmp/.mount_other/AppRun' }), null);
});

test('Desktop Entry Exec quoting handles spaces, quotes, backslashes, shell metacharacters and percent codes', () => {
  assert.equal(quoteDesktopExec('/home/a b/ClipBox.AppImage'), '"/home/a b/ClipBox.AppImage"');
  assert.equal(quoteDesktopExec('/opt/"ClipBox"'), String.raw`"/opt/\\"ClipBox\\""`);
  assert.equal(quoteDesktopExec('/opt/Clip\\Box'), String.raw`"/opt/Clip\\\\Box"`);
  assert.equal(quoteDesktopExec('/opt/$HOME'), String.raw`"/opt/\\$HOME"`);
  assert.equal(quoteDesktopExec('/opt/' + '`' + 'ClipBox'), '"/opt/' + '\\\\' + '`' + 'ClipBox"');
  assert.equal(quoteDesktopExec('/opt/100%/ClipBox'), '"/opt/100%%/ClipBox"');
  assert.throws(() => quoteDesktopExec('/opt/ClipBox\nHidden=false'));
  assert.throws(() => quoteDesktopExec('/opt/name=ClipBox'));
  assert.throws(() => quoteDesktopExec('ClipBox'));
});

test('Generated XDG entry has a fixed schema and no shell interpreter', () => {
  const entry = linuxAutostartEntry('/home/user apps/ClipBox.AppImage');
  assert.ok(entry.startsWith('[Desktop Entry]\nType=Application\n'));
  assert.ok(entry.includes('Exec="/home/user apps/ClipBox.AppImage" --hidden\n'));
  assert.ok(entry.includes(`\n${AUTOSTART_OWNER_MARKER}\n`));
  assert.equal(entry.split('\n').filter(line => line.startsWith('Exec=')).length, 1);
  assert.ok(!entry.includes('/bin/sh'));
});

test('Startup integration is disabled in development and for unresolved AppImage mounts', () => {
  for (const platform of ['win32', 'darwin', 'linux'] as const) assert.equal(autoStartAvailable(platform, false, '/opt/ClipBox', {}), false);
  assert.equal(autoStartAvailable('win32', true, 'C:\\ClipBox\\ClipBox.exe', {}), true);
  assert.equal(autoStartAvailable('darwin', true, '/Applications/ClipBox.app/Contents/MacOS/ClipBox', {}), true);
  assert.equal(autoStartAvailable('linux', true, '/tmp/.mount_ClipBox/AppRun', {}), false);
  assert.equal(autoStartAvailable('linux', true, '/tmp/.mount_ClipBox/AppRun', { APPIMAGE: '/home/alice/ClipBox.AppImage' }), true);
});

test('Wayland and Linux notices accurately disclose desktop integration limits', () => {
  assert.equal(isWayland('linux', { WAYLAND_DISPLAY: 'wayland-0' }), true);
  assert.equal(isWayland('linux', { XDG_SESSION_TYPE: 'Wayland' }), true);
  assert.equal(isWayland('win32', { WAYLAND_DISPLAY: 'wayland-0' }), false);
  assert.match(platformNotice('linux', { XDG_SESSION_TYPE: 'wayland' })!, /포털.*등록 표시.*백그라운드 클립보드.*포커스/);
  assert.match(platformNotice('linux', { XDG_SESSION_TYPE: 'x11' })!, /작업 표시줄로 최소화/);
  assert.equal(platformNotice('win32', {}), null);
  assert.equal(platformNotice('darwin', {}), null);
});

test('Owned Linux startup file toggles atomically and rollback restores exact previous content', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'clipbox-platform-test-'));
  const target = path.join(root, DESKTOP_FILE_NAME);
  const store = new LinuxAutostartFile(target);
  try {
    const undoFirst = store.set(true, '/opt/ClipBox/app.clipbox.desktop');
    const original = readFileSync(target, 'utf8');
    assert.ok(original.includes(AUTOSTART_OWNER_MARKER));
    undoFirst();
    assert.equal(existsSync(target), false);
    store.set(true, '/opt/ClipBox/app.clipbox.desktop');
    const undoUpdate = store.set(true, '/home/alice/ClipBox.AppImage');
    assert.match(readFileSync(target, 'utf8'), /ClipBox.AppImage/);
    undoUpdate();
    assert.equal(readFileSync(target, 'utf8'), original);
    const undoDelete = store.set(false);
    assert.equal(existsSync(target), false);
    undoDelete();
    assert.equal(readFileSync(target, 'utf8'), original);
    store.set(false);
    assert.deepEqual(readdirSync(root), []);
  } finally { removeFixture(root); }
});

test('Startup changes preserve foreign files and reject a different target filename', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'clipbox-platform-test-'));
  const target = path.join(root, DESKTOP_FILE_NAME);
  try {
    const contents = '[Desktop Entry]\nName=User owned entry\n';
    writeFileSync(target, contents);
    const store = new LinuxAutostartFile(target);
    assert.throws(() => store.set(false));
    assert.throws(() => store.set(true, '/opt/ClipBox'));
    assert.equal(readFileSync(target, 'utf8'), contents);
    assert.throws(() => new LinuxAutostartFile(path.join(root, 'another-app.desktop')));
    assert.throws(() => new LinuxAutostartFile(DESKTOP_FILE_NAME));
  } finally { removeFixture(root); }
});

test('Startup rollback refuses to overwrite a concurrent user edit', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'clipbox-platform-test-'));
  const target = path.join(root, DESKTOP_FILE_NAME);
  try {
    const store = new LinuxAutostartFile(target);
    const rollback = store.set(true, '/opt/ClipBox');
    const edited = readFileSync(target, 'utf8') + '# User edit\n';
    writeFileSync(target, edited);
    assert.throws(rollback);
    assert.equal(readFileSync(target, 'utf8'), edited);
  } finally { removeFixture(root); }
});
