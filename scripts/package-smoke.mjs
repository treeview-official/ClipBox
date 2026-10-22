import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL; delete env.CLIPBOX_TEST_USER_DATA;
const app = await electron.launch({ executablePath: path.resolve('release/win-unpacked/ClipBox.exe'), args: [], env });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => !!window.clipbox);
  const info = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, name: app.getName(), version: app.getVersion() }));
  assert.equal(info.packaged, true); assert.equal(info.name, 'ClipBox'); assert.equal(info.version, '1.0.0');
  const state = await page.evaluate(() => window.clipbox.readStatus());
  if (!state.settings.onboarded) {
    await expect(page.getByRole('dialog', { name: 'ClipBox 시작하기' })).toBeVisible();
    assert.equal(state.settings.collectionEnabled, false);
    assert.equal((await page.evaluate(() => window.clipbox.list())).total, 0);
  }
  await page.screenshot({ path: path.resolve('artifacts/qa/07-packaged-startup.png') });
  assert.deepEqual(errors, []);
  await writeFile('artifacts/qa/package-results.json', JSON.stringify({ ...info, result: 'passed', firstRun: !state.settings.onboarded, rendererErrors: 0 }, null, 2));
  console.log('PASS packaged ClipBox.exe startup, preload IPC, renderer and first-run consent gate');
} finally { await app.close(); }
