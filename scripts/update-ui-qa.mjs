import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const profile = await mkdtemp(path.join(os.tmpdir(), 'clipbox-update-ui-'));
const output = path.resolve('artifacts/qa/v1.2.0');
await mkdir(output, { recursive: true });
const env = { ...process.env, CLIPBOX_TEST_USER_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL;
const checks = [], errors = [];
const pass = label => { checks.push(label); console.log(`PASS ${label}`); };
let app;
try {
  app = await electron.launch({ args: ['.'], env, chromiumSandbox: true, timeout: 30000 });
  const page = await app.firstWindow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: '지금은 기록하지 않고 둘러보기' }).click();
  assert.equal((await page.evaluate(() => window.clipbox.readStatus())).settings.collectionEnabled, false);
  assert.equal((await page.evaluate(() => window.clipbox.readUpdate())).phase, 'idle');
  const centers = await page.evaluate(() => ['.status-chip', '.window-controls'].map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return r.y + r.height / 2; }));
  assert.ok(Math.abs(centers[0] - centers[1]) < 1);
  await page.screenshot({ path: path.join(output, '01-titlebar.png') });
  pass('Titlebar status and window controls share a vertical center; collection stays off');
  await page.getByRole('button', { name: '패치노트', exact: true }).click();
  await expect(page.getByRole('heading', { name: '패치노트', exact: true })).toBeVisible();
  await expect(page.locator('.release-card')).toHaveCount(3);
  await expect(page.locator('.release-card').first()).toContainText('1.2.0');
  await page.screenshot({ path: path.join(output, '02-release-notes.png') });
  await page.getByText('tree_view@naver.com', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, '03-support.png') });
  pass('Offline patch notes and support email are visible without opening a mail client');

  // Replace only this isolated test process's transport; never download or execute a real installer.
  const payload = 'Synthetic update UI test payload. Never execute.';
  const digest = createHash('sha256').update(payload).digest('hex');
  await app.evaluate((_electron, { payload, digest }) => {
    globalThis.__clipboxQaRequests = 0; globalThis.__clipboxQaMode = 'new';
    globalThis.fetch = async (url, options) => {
      globalThis.__clipboxQaRequests++;
      if (globalThis.__clipboxQaMode === 'offline') throw new Error('Synthetic offline condition');
      if (String(url).endsWith('/latest')) {
        const version = globalThis.__clipboxQaMode === 'current' ? '1.2.0' : globalThis.__clipboxQaMode === 'older' ? '1.1.0' : '9.0.0';
        const name = `ClipBox-Setup-${version}.exe`;
        return Response.json({ tag_name: `v${version}`, draft: false, prerelease: false, html_url: `https://github.com/treeview-official/ClipBox/releases/tag/v${version}`, published_at: '2026-10-23T00:00:00Z', body: '합성 업데이트 검증용 패치노트 <script>실행하지 않음</script>', assets: [{ name, state: 'uploaded', size: Buffer.byteLength(payload), digest: `sha256:${digest}`, browser_download_url: `https://github.com/treeview-official/ClipBox/releases/download/v${version}/${name}` }] });
      }
      if (globalThis.__clipboxQaMode === 'slow') return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true }));
      return new Response(payload);
    };
  }, { payload, digest });
  await page.getByRole('button', { name: '업데이트 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '업데이트 다운로드', exact: true })).toBeVisible();
  await app.evaluate(() => { globalThis.__clipboxQaMode = 'slow'; });
  await page.getByRole('button', { name: '업데이트 다운로드', exact: true }).click();
  await expect(page.getByRole('button', { name: '다운로드 취소', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다운로드 취소', exact: true }).click();
  await expect(page.getByRole('button', { name: '업데이트 다운로드', exact: true })).toBeEnabled();
  await app.evaluate(() => { globalThis.__clipboxQaMode = 'new'; });
  await page.getByRole('button', { name: '업데이트 다운로드', exact: true }).click();
  await expect(page.getByRole('button', { name: '앱 종료 후 설치', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '앱 종료 후 설치', exact: true }).click();
  await expect(page.locator('.update-message')).toContainText('설치된 ClipBox');
  pass('Update check, newer version offer, cancellation, retry and verified download through real preload IPC; development install blocked');

  await page.getByRole('button', { name: '환경설정', exact: true }).click();
  await page.getByRole('combobox', { name: '화면 테마' }).selectOption('dark');
  await page.getByRole('button', { name: '앱 종료 후 설치', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: '앱 종료 후 설치', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '앱 종료 후 설치', exact: true })).toBeEnabled();
  await page.screenshot({ path: path.join(output, '04-update-ready-dark.png') });
  pass('Update state survives page navigation and unsaved settings block installation');

  for (const mode of ['offline', 'current', 'older']) {
    await app.evaluate((_electron, value) => { globalThis.__clipboxQaMode = value; }, mode);
    const result = await page.evaluate(() => window.clipbox.checkUpdate());
    assert.equal(result.phase, mode === 'offline' ? 'error' : 'current');
    await expect(page.getByRole('button', { name: mode === 'offline' ? '다시 확인' : '업데이트 확인', exact: true })).toBeEnabled();
  }
  pass('Offline failure is retryable; equal/older versions do not offer an install');
  await page.getByRole('combobox', { name: '화면 테마' }).selectOption('light');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(850, 560));
  await page.getByRole('button', { name: '패치노트', exact: true }).click();
  await page.getByText('tree_view@naver.com', { exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const inside = await page.getByText('tree_view@naver.com', { exact: true }).boundingBox();
  assert.ok(inside && inside.y >= 0 && inside.y + inside.height <= 560);
  await page.screenshot({ path: path.join(output, '05-compact.png') });
  assert.equal((await page.evaluate(() => window.clipbox.list())).total, 0);
  assert.equal((await page.evaluate(() => window.clipbox.readStatus())).settings.collectionEnabled, false);
  assert.deepEqual(errors, []);
  pass('Compact navigation and support stay reachable; no clipboard access, records or renderer errors');
  await writeFile(path.join(output, 'update-ui-results.json'), JSON.stringify({ version: JSON.parse(await readFile('package.json', 'utf8')).version, result: 'passed', platform: process.platform, transport: 'synthetic responses in isolated main process; no installer executed', checks }, null, 2) + '\n');
} finally {
  if (app) await app.close();
  if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(profile).startsWith('clipbox-update-ui-')) await rm(profile, { recursive: true, force: true });
}
