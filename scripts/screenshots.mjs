import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ClipRepository } from '../electron/database.ts';
import { SettingsStore } from '../electron/settings.ts';

// Capture the real app with an isolated, seeded profile. Never read/write the OS clipboard.
// Run after npm run build: node --import tsx scripts/screenshots.mjs
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const output = path.resolve('docs/images', `v${version}`);
const profile = await mkdtemp(path.join(os.tmpdir(), 'clipbox-gallery-'));
await mkdir(output, { recursive: true });
const settings = new SettingsStore(profile);
settings.update({ onboarded: true, collectionEnabled: false, paused: true, autoStart: false, theme: 'light' });
const repository = new ClipRepository(profile);
const samples = [
  'npm install electron',
  'https://github.com/treeview-official/ClipBox',
  '오늘의 할 일\n\n✓ ClipBox 1.2.0 업데이트\n✓ 자주 쓰는 문구를 즐겨찾기에 저장\n□ 회의 메모 정리하기\n□ 다음 주 일정 확인하기',
  'function greet(name) {\n  return `안녕하세요, ${name}님!`;\n}',
  'https://www.electronjs.org',
  '안녕하세요. 보내 주신 자료를 확인했습니다. 검토 후 회신드리겠습니다.',
  '아이디어 메모 — 자주 복사하는 내용을 모아 두면 반복 작업이 훨씬 편해집니다.',
  '회의 메모\n일시: 금요일 오후 2시\n안건: 다음 주 작업 일정\n준비: 기획 초안과 화면 참고 자료',
  'https://www.typescriptlang.org',
  'git status',
  '복사한 모든 것을, 언제든 다시.',
];
const now = Date.now();
samples.forEach((text, index) => repository.upsertText(text, now - index * 180_000));
const icon = await readFile('assets/icon.png');
repository.upsertImage(icon, icon.readUInt32BE(16), icon.readUInt32BE(20), undefined, now - 450_000);
for (const item of repository.list().items) {
  if ([samples[0], samples[1], samples[2]].includes(repository.get(item.id)?.contentText)) repository.toggleFavorite(item.id);
}
repository.close();
const env = { ...process.env, CLIPBOX_TEST_USER_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;
const captures = [], errors = [];
let app;
try {
  app = await electron.launch({ args: ['.'], env, chromiumSandbox: true, timeout: 30_000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.clip-row')).toHaveCount(12);
  await page.evaluate(() => document.fonts.ready);
  const status = await page.evaluate(() => window.clipbox.readStatus());
  assert.equal(status.version, version);
  assert.equal(status.settings.collectionEnabled, false);
  assert.equal(status.settings.paused, true);
  // If the user's installed app owns the default shortcut, use a real, available
  // alternate shortcut in this temporary profile. Do not hide the warning in the DOM.
  if (status.shortcutError) {
    const next = await page.evaluate(() => window.clipbox.updateSettings({ hotkey: 'Control+Alt+Shift+F12' }));
    assert.equal(next.shortcutError, null);
  }
  async function capture(name, target = page) {
    await page.mouse.move(1, 1);
    const filename = `${name}.png`;
    await target.screenshot({ path: path.join(output, filename), animations: 'disabled' });
    captures.push(filename);
    console.log(`Captured ${filename}`);
  }
  await page.locator('.clip-select').filter({ hasText: samples[2].split('\n')[0] }).click();
  await expect(page.locator('.detail-panel')).toContainText('다음 주 일정 확인하기');
  await capture('history');

  const quickPromise = app.waitForEvent('window');
  await page.getByRole('button', { name: '빠른 기록 열기', exact: true }).click();
  const quick = await quickPromise;
  quick.on('pageerror', error => errors.push(error.message));
  await quick.emulateMedia({ reducedMotion: 'reduce' });
  await expect(quick.locator('.clip-row')).toHaveCount(12);
  await quick.evaluate(() => document.fonts.ready);
  await capture('quick-popup', quick);
  await quick.evaluate(() => window.clipbox.windowAction('hide'));
  await page.bringToFront();

  await page.getByRole('button', { name: '환경설정', exact: true }).click();
  await capture('settings');
  await page.getByRole('button', { name: '업데이트 확인', exact: true }).click();
  await expect(page.locator('.up-to-date')).toBeVisible({ timeout: 30_000 });
  const update = await page.evaluate(() => window.clipbox.readUpdate());
  assert.equal(update.release.version, version, 'Regenerate gallery for the latest public version before publishing');
  await page.locator('.support-contact').scrollIntoViewIfNeeded();
  // A native screenshot of the update and contact area; no image retouching.
  const panel = await page.locator('.update-panel').boundingBox();
  const contact = await page.locator('.support-contact').boundingBox();
  assert.ok(panel && contact && panel.y >= 0 && contact.y + contact.height <= await page.evaluate(() => innerHeight));
  await page.screenshot({ path: path.join(output, 'updates-and-contact.png'), animations: 'disabled', clip: { x: panel.x, y: panel.y, width: panel.width, height: contact.y + contact.height - panel.y } });
  captures.push('updates-and-contact.png');

  await page.getByRole('button', { name: '패치노트', exact: true }).click();
  await expect(page.locator('.release-card').first()).toContainText(`v${version}`);
  await capture('patch-notes');
  await page.evaluate(() => window.clipbox.updateSettings({ theme: 'dark' }));
  await page.getByRole('button', { name: '전체 기록', exact: false }).click();
  await page.locator('.clip-select').filter({ hasText: samples[2].split('\n')[0] }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await capture('history-dark');
  assert.equal((await page.evaluate(() => window.clipbox.list())).total, 12);
  assert.equal((await page.evaluate(() => window.clipbox.readStatus())).settings.collectionEnabled, false);
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'capture.json'), JSON.stringify({ version, capturedAt: new Date().toISOString(), platform: process.platform, mode: 'Electron production source build; synthetic seeded records; isolated temporary profile; collection disabled and paused', updateCheck: { source: 'public GitHub latest release via actual main/preload IPC', phase: update.phase, version: update.release.version }, screenshots: captures, rendererErrors: errors }, null, 2) + '\n');
} finally {
  if (app) await app.close();
  if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(profile).startsWith('clipbox-gallery-')) await rm(profile, { recursive: true, force: true });
}
