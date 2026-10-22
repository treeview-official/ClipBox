import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  executable: { type: 'string' },
  'output-dir': { type: 'string' },
  screenshot: { type: 'boolean', default: false },
  'resolve-only': { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} });

if (values.help) {
  console.log(`Packaged ClipBox startup smoke (fresh native CI hosts only)

Usage: node scripts/packaged-smoke.mjs [--executable PATH] [--screenshot]
       node scripts/packaged-smoke.mjs --resolve-only [--executable PATH]

CLIPBOX_SMOKE_EXECUTABLE supplies the executable when --executable is omitted.
On macOS, PATH can also be a .app bundle. Otherwise native-architecture output
is selected beneath the electron-builder output directory in package.json.
--output-dir PATH changes the evidence directory (default artifacts/packaged).

Actual launches require CI=true and a clean OS user profile. Existing ClipBox
data is never cleared. Use --resolve-only for path checking without launching.
Linux requires a graphical session; CI uses X11 through xvfb-run. Install the
DEB before testing on Ubuntu so the sandbox and AppArmor integration are present.
No sandbox-disabling flags, clipboard reads, writes, or collection opt-in are used.
This checks packaged startup and first-run UI, not a complete installer wizard
or cross-application clipboard workflow.`);
} else {
  await main();
}

async function fileExists(filename) {
  try { return (await stat(filename)).isFile(); }
  catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
}

async function resolveExecutable(manifest) {
  const product = manifest.build?.productName ?? 'ClipBox';
  const explicit = values.executable ?? process.env.CLIPBOX_SMOKE_EXECUTABLE;
  if (explicit) {
    let executable = path.resolve(explicit);
    if (process.platform === 'darwin' && executable.endsWith('.app')) {
      executable = path.join(executable, 'Contents', 'MacOS', product);
    }
    assert.ok(await fileExists(executable), 'The explicit packaged executable does not exist.');
    return { executable, source: 'explicit' };
  }

  const output = path.resolve(root, manifest.build?.directories?.output ?? 'release');
  let candidates;
  if (process.platform === 'win32') {
    candidates = [path.join(output, process.arch === 'x64' ? 'win-unpacked' : `win-${process.arch}-unpacked`, `${product}.exe`)];
  } else if (process.platform === 'darwin') {
    const directories = process.arch === 'arm64' ? ['mac-arm64', 'mac-universal'] : ['mac', 'mac-x64', 'mac-universal'];
    candidates = directories.map(directory => path.join(output, directory, `${product}.app`, 'Contents', 'MacOS', product));
  } else if (process.platform === 'linux') {
    candidates = [path.join(output, process.arch === 'x64' ? 'linux-unpacked' : `linux-${process.arch}-unpacked`, manifest.build?.linux?.executableName ?? manifest.name)];
  } else throw new Error('This smoke test supports Windows, macOS and Linux only.');

  for (const executable of candidates) {
    if (await fileExists(executable)) return { executable, source: 'native-unpacked-output' };
  }
  throw new Error('No native packaged executable found. Build first or supply CLIPBOX_SMOKE_EXECUTABLE.');
}

async function main() {
  // Packaged apps intentionally ignore CLIPBOX_TEST_USER_DATA. Never silently
  // run against a developer's real ClipBox profile or running desktop instance.
  if (!values['resolve-only'] && process.env.CI !== 'true') {
    throw new Error('Refusing to launch outside CI=true. Use a fresh CI host or --resolve-only.');
  }
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const output = path.resolve(root, values['output-dir'] ?? 'artifacts/packaged');
  const evidenceFile = path.join(output, `${process.platform}-${process.arch}.json`);
  const checks = [];
  const evidence = {
    version: manifest.version,
    hostPlatform: process.platform,
    hostArch: process.arch,
    result: 'failed',
    scope: 'Packaged startup, restricted preload, and first-run consent; no collection or clipboard interaction.',
    checks,
    rendererErrorCount: 0,
  };
  let application;
  let step = 'resolve-executable';
  let failure;
  const rendererErrors = [];
  try {
    const resolved = await resolveExecutable(manifest);
    if (process.platform !== 'win32') await access(resolved.executable, constants.X_OK);
    evidence.executableSource = resolved.source;
    evidence.executableName = path.basename(resolved.executable);
    if (values['resolve-only']) {
      console.log(JSON.stringify({ platform: process.platform, arch: process.arch, executable: resolved.executable, source: resolved.source, launched: false }, null, 2));
      return;
    }
    await mkdir(output, { recursive: true });
    step = 'launch';
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.VITE_DEV_SERVER_URL;
    delete env.CLIPBOX_TEST_USER_DATA;
    const args = [];
    if (process.platform === 'linux') {
      assert.ok(env.DISPLAY, 'Linux smoke requires DISPLAY; run through xvfb-run.');
      // Test the actual X11 path provided by Xvfb; do not claim Wayland coverage.
      env.XDG_SESSION_TYPE = 'x11';
      delete env.WAYLAND_DISPLAY;
      args.push('--ozone-platform=x11');
      evidence.displayBackend = 'x11';
    }
    application = await electron.launch({ executablePath: resolved.executable, args, env, cwd: root, chromiumSandbox: true, timeout: 60_000 });
    const observe = page => page.on('pageerror', error => rendererErrors.push(error.name));
    application.on('window', observe);
    for (const page of application.windows()) observe(page);

    step = 'runtime';
    const runtime = await application.evaluate(({ app }) => ({
      packaged: app.isPackaged, name: app.getName(), version: app.getVersion(), platform: process.platform, arch: process.arch,
      sandboxDisabled: app.commandLine.hasSwitch('no-sandbox'),
    }));
    assert.equal(runtime.packaged, true, 'Smoke must launch the packaged application.');
    assert.equal(runtime.name, manifest.build?.productName ?? 'ClipBox');
    assert.equal(runtime.version, manifest.version, 'Packaged version differs from source metadata.');
    assert.equal(runtime.platform, process.platform);
    assert.equal(runtime.arch, process.arch, 'Smoke must use the native runner architecture.');
    assert.equal(runtime.sandboxDisabled, false, 'The native sandbox must remain enabled during smoke tests.');
    evidence.runtime = runtime;
    checks.push('Packaged app identity, version and native architecture');

    step = 'renderer-and-preload';
    const page = await application.firstWindow({ timeout: 30_000 });
    await page.waitForFunction(() => typeof window.clipbox?.readStatus === 'function' && typeof window.clipbox?.list === 'function', undefined, { timeout: 30_000 });
    const status = await page.evaluate(() => window.clipbox.readStatus());
    assert.equal(status.platform, process.platform);
    checks.push('Manager renderer and restricted preload IPC are available');

    step = 'first-run-consent';
    assert.equal(status.settings.onboarded, false, 'Smoke requires a fresh CI profile; existing settings are preserved.');
    assert.equal(status.settings.collectionEnabled, false, 'Collection must remain off before consent.');
    assert.equal(status.settings.autoStart, false, 'Smoke must not register an OS startup item.');
    await expect(page.getByRole('dialog', { name: 'ClipBox 시작하기' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '동의하고 기록 시작' })).toBeVisible();
    await expect(page.getByRole('button', { name: '지금은 기록하지 않고 둘러보기' })).toBeVisible();
    const listing = await page.evaluate(() => window.clipbox.list({ limit: 1 }));
    assert.equal(listing.total, 0, 'A fresh CI profile should contain no clipboard records.');
    assert.equal(listing.stats.total, 0);
    checks.push('Visible first-run consent with collection disabled and empty history');

    step = 'security-preferences';
    const preferences = await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes('view=manager'));
      if (!window) return null;
      const current = window.webContents.getLastWebPreferences();
      return { sandbox: current.sandbox, contextIsolation: current.contextIsolation, nodeIntegration: current.nodeIntegration, webSecurity: current.webSecurity };
    });
    assert.deepEqual(preferences, { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true });
    const rendererGlobals = await page.evaluate(() => ({ nodeRequire: typeof window.require, nodeProcess: typeof window.process }));
    assert.deepEqual(rendererGlobals, { nodeRequire: 'undefined', nodeProcess: 'undefined' });
    checks.push('Renderer sandbox, isolation, web security and no Node globals');

    step = 'bundled-korean-font';
    const fonts = await page.evaluate(async () => {
      const faces = await document.fonts.load('400 16px "ClipBox Sans"', '한글 클립보드 기록');
      await document.fonts.ready;
      return faces.map(face => ({ family: face.family, status: face.status }));
    });
    assert.ok(fonts.length > 0 && fonts.every(face => face.status === 'loaded'), 'The bundled Korean font must load without relying on system fonts.');
    evidence.bundledKoreanFont = 'loaded';
    checks.push('Bundled Korean font loads for offline UI rendering');

    step = 'settled-ui';
    // Two browser paints allow initial layout and queued renderer work to settle.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(rendererErrors.length, 0, 'Renderer raised an exception during startup smoke.');
    checks.push('First-run UI rendered without observed renderer exceptions');
    if (values.screenshot) {
      const screenshotName = `${process.platform}-${process.arch}.png`;
      // Only capture after confirming no user records exist; never capture failures.
      await page.screenshot({ path: path.join(output, screenshotName) });
      evidence.screenshot = screenshotName;
    }
    evidence.result = 'passed';
  } catch (error) {
    failure = error;
    evidence.failureStep = step;
    evidence.failureType = error instanceof Error ? error.name : 'UnknownError';
  } finally {
    if (application) {
      try { await application.close(); }
      catch (error) {
        if (!failure) { failure = error; evidence.result = 'failed'; evidence.failureStep = 'shutdown'; evidence.failureType = 'ShutdownError'; }
      }
    }
    if (!values['resolve-only']) {
      evidence.rendererErrorCount = rendererErrors.length;
      await mkdir(output, { recursive: true });
      await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    }
  }
  if (failure) {
    // Evidence deliberately excludes clipboard data, local user paths and raw stacks.
    console.error(`FAIL packaged smoke (${evidence.failureStep}): ${failure instanceof Error ? failure.message : 'Unknown error'}`);
    process.exitCode = 1;
  } else console.log(`PASS packaged ${process.platform}/${process.arch} startup smoke (${checks.length} checks); no clipboard access or collection enabled.`);
}
