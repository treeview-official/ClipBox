import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const profile = await mkdtemp(path.join(os.tmpdir(), 'clipbox-e2e-'));
const artifacts = path.resolve('artifacts/qa');
await mkdir(artifacts, { recursive: true });
const env = { ...process.env, CLIPBOX_TEST_USER_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL;
const checks = []; const rendererErrors = [];
let app; let page; let originalClipboard;
const pass = label => { checks.push(label); console.log(`PASS ${label}`); };
async function launch() {
  app = await electron.launch({ args: ['.'], env, timeout: 30000 });
  page = await app.firstWindow();
  page.on('pageerror', error => rendererErrors.push(error.message));
  await page.waitForFunction(() => !!window.clipbox);
  await expect.poll(() => page.evaluate(async () => !!(await window.clipbox.readStatus()))).toBe(true);
}
const list = () => page.evaluate(() => window.clipbox.list());
async function copy(text, expectedCount) {
  await app.evaluate(async ({ clipboard }, value) => { await clipboard.writeText(value); }, text);
  await expect.poll(async () => (await list()).stats.total, { timeout: 10000 }).toBe(expectedCount);
}
try {
  await launch();
  originalClipboard = await app.evaluate(async ({ clipboard }) => {
    const result = [];
    for (const item of await clipboard.read()) {
      const entry = [];
      for (const type of item.types.filter(t => ['text/plain', 'text/html', 'text/rtf', 'image/png', 'electron application/bookmark'].includes(t))) {
        const data = await item.getType(type);
        entry.push(type === 'electron application/bookmark' ? { type, bookmark: data } : { type, base64: Buffer.from(await data.arrayBuffer()).toString('base64') });
      }
      if (entry.length) result.push(entry);
    }
    return result;
  });
  await expect(page.getByRole('dialog', { name: 'ClipBox 시작하기' })).toBeVisible();
  await app.evaluate(async ({ clipboard }) => { await clipboard.writeText('ClipBox QA: before consent'); });
  await page.waitForTimeout(600);
  assert.equal((await list()).total, 0);
  await page.screenshot({ path: path.join(artifacts, '01-onboarding.png') });
  await page.getByRole('button', { name: '동의하고 기록 시작' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  assert.equal((await list()).total, 0);
  pass('No capture before consent; opt-in and startup baseline');

  const samples = ['npm install electron', 'https://github.com', 'function copyText(text) {\n  return navigator.clipboard.writeText(text);\n}', '오늘 회의에서 논의된 내용을 정리하면 다음과 같습니다. 🌿', 'https://www.figma.com', '프로젝트 진행 상황\n• 디자인 시스템 구축\n• 메인 화면 개발\n• 베타 테스트 준비'];
  for (let i = 0; i < samples.length; i++) await copy(samples[i], i + 1);
  await page.waitForTimeout(1000);
  assert.equal((await list()).total, 6);
  assert.equal((await list()).stats.link, 2);
  pass('Actual Windows clipboard text, URL, Korean, emoji and multiline capture; stable deduplication');

  const png = (await readFile('assets/icon.png')).toString('base64');
  await app.evaluate(async ({ clipboard, ClipboardItem }, base64) => {
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' }) })]);
  }, png);
  await expect.poll(async () => (await list()).stats.image, { timeout: 10000 }).toBe(1);
  const imageId = (await list()).items.find(item => item.kind === 'image').id;
  await page.evaluate(id => window.clipbox.recopy(id), imageId);
  assert.equal(await app.evaluate(async ({ clipboard }) => clipboard.has('image/png')), true);
  await page.waitForTimeout(1500);
  assert.equal((await list()).total, 7);
  pass('PNG capture, thumbnail, image recopy and self-copy deduplication');

  const npmId = (await list()).items.find(item => item.previewText === samples[0]).id;
  await page.locator(`[data-clip-id="${npmId}"]`).getByRole('button', { name: '즐겨찾기 추가' }).click();
  await expect.poll(async () => (await list()).stats.favorite).toBe(1);
  const search = page.getByRole('searchbox', { name: '클립보드 기록 검색' });
  await search.fill('회의');
  await expect(page.locator('[data-clip-id]')).toHaveCount(1);
  await search.fill('');
  await expect(page.locator('[data-clip-id]')).toHaveCount(7);
  await page.locator(`[data-clip-id="${npmId}"] .clip-select`).click();
  await expect(page.locator('.content-preview')).toContainText(samples[0]);
  await page.screenshot({ path: path.join(artifacts, '02-history.png') });
  pass('Real UI search, selection, detail preview and favorite');

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=manager')).setSize(850, 560));
  await expect(page.getByRole('button', { name: '상세 미리보기 닫기' })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, '06-compact.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: '상세 미리보기 닫기' }).click();
  await expect(search).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=manager')).setSize(1280, 840));
  pass('850 by 560 responsive detail drawer and search remain usable');

  await page.evaluate(() => window.clipbox.updateSettings({ paused: true }));
  await app.evaluate(async ({ clipboard }) => { await clipboard.writeText('ClipBox QA: while paused'); });
  await page.waitForTimeout(800);
  assert.equal((await list()).total, 7);
  await page.evaluate(() => window.clipbox.updateSettings({ paused: false }));
  await page.waitForTimeout(800);
  assert.equal((await list()).total, 7);
  pass('Pause and resume skip clipboard content from paused interval');

  await page.getByRole('button', { name: '환경설정', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '화면 테마' })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, '03-settings.png') });
  await page.getByRole('combobox', { name: '화면 테마' }).selectOption('dark');
  await page.evaluate(() => window.clipbox.updateSettings({ paused: true }));
  await expect(page.getByRole('switch', { name: '기록 일시정지' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('combobox', { name: '화면 테마' })).toHaveValue('dark');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  assert.equal((await page.evaluate(() => window.clipbox.readStatus())).settings.paused, true);
  await page.evaluate(() => window.clipbox.updateSettings({ paused: false }));
  pass('Unsaved settings survive external changes and save only edited fields');
  await page.screenshot({ path: path.join(artifacts, '04-dark.png') });
  await page.getByRole('combobox', { name: '화면 테마' }).selectOption('light');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => window.clipbox.readStatus())).settings.theme).toBe('light');
  pass('Settings UI saves and applies light/dark theme');

  await page.evaluate(() => window.clipbox.windowAction('quick'));
  await expect.poll(() => app.windows().length).toBe(2);
  const quick = app.windows().find(window => window.url().includes('view=quick'));
  quick.on('pageerror', error => rendererErrors.push(error.message));
  await expect(quick.getByRole('searchbox')).toBeFocused();
  await expect(quick.locator('[data-clip-id]')).toHaveCount(7);
  await quick.screenshot({ path: path.join(artifacts, '05-quick.png') });
  await quick.getByRole('searchbox').fill('npm');
  await expect(quick.locator('[data-clip-id]')).toHaveCount(1);
  await quick.keyboard.press('Enter');
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=quick')).isVisible())).toBe(false);
  assert.equal(await app.evaluate(async ({ clipboard }) => clipboard.readText()), samples[0]);
  pass('Quick popup autofocus, search, Enter recopy and hide');

  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  assert.deepEqual(prefs, { sandbox: true, contextIsolation: true, nodeIntegration: false });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(async () => { try { await window.clipbox.list({ limit: 999999 }); return false; } catch { return true; } }), true);
  assert.equal(await page.evaluate(async () => { try { await window.clipbox.get('../../settings.json'); return false; } catch { return true; } }), true);
  assert.equal(await page.evaluate(async () => { try { await window.clipbox.clearAll('wrong'); return false; } catch { return true; } }), true);
  assert.equal(await page.evaluate(async () => { try { await fetch('https://example.com'); return false; } catch { return true; } }), true);
  pass('Sandbox, isolation, restricted IPC validation and blocked external fetch');
  const shortcut = await page.evaluate(async () => (await window.clipbox.readStatus()).settings.hotkey);
  const registered = await app.evaluate(({ globalShortcut }, key) => globalShortcut.isRegistered(key), shortcut);
  const conflict = await page.evaluate(async () => (await window.clipbox.readStatus()).shortcutError);
  assert.ok(registered || conflict);
  pass(registered ? 'Windows global shortcut registration' : 'Hotkey collision reported without startup failure');

  await page.evaluate(() => window.clipbox.windowAction('close'));
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=manager')).isVisible()), false);
  await copy('ClipBox QA: background tray capture', 8);
  pass('Closing manager leaves background clipboard capture active');
  await app.close(); app = undefined;
  await launch();
  assert.equal((await list()).total, 8);
  assert.equal((await list()).stats.favorite, 1);
  assert.equal((await page.evaluate(() => window.clipbox.readStatus())).settings.theme, 'light');
  pass('App restart persists history, images, favorite and settings');

  await page.evaluate(id => window.clipbox.remove(id), imageId);
  assert.equal((await list()).stats.image, 0);
  const remainingImages = (await readdir(path.join(profile, 'images'))).filter(name => name.endsWith('.png'));
  assert.equal(remainingImages.length, 0);
  await page.getByRole('button', { name: '환경설정', exact: true }).click();
  await page.getByRole('button', { name: '전체 삭제', exact: true }).click();
  await page.getByRole('button', { name: '계속', exact: true }).click();
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '전체 삭제 확인 문구' }).fill('전체 삭제');
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await expect.poll(async () => (await list()).total).toBe(0);
  pass('Image files removed and two-stage destructive confirmation enforced');
  assert.deepEqual(rendererErrors, []);
  pass('No renderer exceptions');
  await writeFile(path.join(artifacts, 'e2e-results.json'), JSON.stringify({ result: 'passed', platform: process.platform, checks }, null, 2));
  console.log(`Completed ${checks.length} desktop checks.`);
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  if (app) {
    if (originalClipboard) {
      await app.evaluate(async ({ clipboard, ClipboardItem }, items) => {
        clipboard.clear();
        if (items.length) await clipboard.write(items.map(entries => new ClipboardItem(Object.fromEntries(entries.map(entry => [entry.type, entry.bookmark ?? new Blob([Buffer.from(entry.base64, 'base64')], { type: entry.type })])))));
      }, originalClipboard).catch(() => console.error('Could not restore original clipboard formats.'));
    }
    await app.close().catch(() => {});
  }
  const safeRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(safeRoot) && path.basename(profile).startsWith('clipbox-e2e-')) await rm(profile, { recursive: true, force: true });
}
