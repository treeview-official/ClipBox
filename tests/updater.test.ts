import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compareVersions, installerFormat, installerName, parseRelease, UpdateService } from '../electron/updater';

const bytes = Buffer.from('Synthetic installer payload, never executed.');
const sha = createHash('sha256').update(bytes).digest('hex');
function release(version = '1.3.0', format: 'exe' | 'dmg' | 'deb' | 'rpm' | 'tar.gz' = 'exe', arch = 'x64') {
  const name = installerName(version, format, arch);
  return { tag_name: `v${version}`, draft: false, prerelease: false, html_url: `https://github.com/treeview-official/ClipBox/releases/tag/v${version}`, body: 'Synthetic release notes <script>never interpreted</script>', published_at: '2026-10-23T00:00:00Z', assets: [{ name, state: 'uploaded', size: bytes.length, digest: `sha256:${sha}`, browser_download_url: `https://github.com/treeview-official/ClipBox/releases/download/v${version}/${name}` }] };
}
async function fixture(t: TestContext, input = release(), options: { platform?: string; arch?: string; linuxRelease?: string; fetch?: typeof fetch; openInstaller?: (file: string) => Promise<void> } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'clipbox-update-test-'));
  t.after(async () => { assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); });
  const opened: string[] = []; const calls: string[] = [];
  const service = new UpdateService({ version: '1.2.0', platform: options.platform ?? 'win32', arch: options.arch ?? 'x64', linuxRelease: options.linuxRelease, tempDirectory: directory, changed: () => {}, openInstaller: options.openInstaller ?? (async file => { opened.push(file); }), fetch: options.fetch ?? (async url => { calls.push(String(url)); return String(url).includes('/releases/latest') ? Response.json(input) : new Response(bytes); }) });
  t.after(() => service.dispose());
  return { service, directory, opened, calls };
}

test('update versions compare numerically and refuse prerelease, paths and malformed input', () => {
  assert.equal(compareVersions('1.10.0', '1.2.99'), 1);
  assert.equal(compareVersions('1.2.0', '1.2.0'), 0);
  assert.equal(compareVersions('1.1.9', '1.2.0'), -1);
  for (const version of ['v1.2.0', '1.2', '01.2.0', '1.2.0-beta', '../1.2.0', '1.2.0\n']) assert.throws(() => compareVersions(version, '1.2.0'));
});
test('native installer selection respects OS, CPU and Linux distribution', () => {
  assert.equal(installerFormat('win32', 'x64'), 'exe');
  assert.equal(installerFormat('win32', 'arm64'), null);
  assert.equal(installerFormat('darwin', 'arm64'), 'dmg');
  assert.equal(installerFormat('linux', 'x64', 'ID=ubuntu'), 'deb');
  assert.equal(installerFormat('linux', 'x64', 'ID=custom\nID_LIKE="rhel fedora"'), 'rpm');
  assert.equal(installerFormat('linux', 'x64', 'ID=arch'), 'tar.gz');
  assert.equal(installerFormat('linux', 'arm64', 'ID=ubuntu'), null);
  assert.equal(installerFormat('freebsd', 'x64'), null);
  assert.equal(parseRelease(release('1.3.0', 'dmg', 'arm64'), 'darwin', 'arm64').release.filename, 'ClipBox-1.3.0-mac-arm64.dmg');
});
test('release validation rejects foreign sources, missing hashes, ambiguous files and drafts', () => {
  const edits = [
    (r: ReturnType<typeof release>) => { r.draft = true; },
    (r: ReturnType<typeof release>) => { r.prerelease = true; },
    (r: ReturnType<typeof release>) => { r.html_url = 'https://github.com/other/ClipBox/releases/tag/v1.3.0'; },
    (r: ReturnType<typeof release>) => { r.assets[0].browser_download_url = 'https://evil.example/installer.exe'; },
    (r: ReturnType<typeof release>) => { r.assets[0].digest = ''; },
    (r: ReturnType<typeof release>) => { r.assets.push(r.assets[0]); },
    (r: ReturnType<typeof release>) => { r.assets[0].size = 600 * 1024 * 1024; },
    (r: ReturnType<typeof release>) => { r.assets[0].name = '../ClipBox.exe'; },
  ];
  for (const edit of edits) { const data = release(); edit(data); assert.throws(() => parseRelease(data, 'win32', 'x64')); }
});
test('no network at construction; equal/older public versions never offer a downgrade', async t => {
  for (const version of ['1.2.0', '1.1.0']) {
    const { service, calls } = await fixture(t, release(version));
    assert.equal(calls.length, 0); assert.equal(service.read().phase, 'idle');
    assert.equal((await service.check()).phase, 'current');
    await service.download(); assert.equal(calls.length, 1);
  }
});
test('verified download and installer handoff work for each offered native package', async t => {
  for (const [platform, arch, linuxRelease, format] of [['win32', 'x64', '', 'exe'], ['darwin', 'arm64', '', 'dmg'], ['darwin', 'x64', '', 'dmg'], ['linux', 'x64', 'ID=ubuntu', 'deb'], ['linux', 'x64', 'ID=fedora', 'rpm']] as const) {
    const { service, opened } = await fixture(t, release('1.3.0', format, arch), { platform, arch, linuxRelease });
    assert.equal((await service.check()).phase, 'available');
    const downloaded = await service.download(); assert.equal(downloaded.phase, 'ready'); assert.equal(downloaded.progress, 100);
    assert.equal(opened.length, 0);
    assert.equal((await service.install()).phase, 'opened'); assert.equal(opened.length, 1);
    assert.deepEqual(await readFile(opened[0]), bytes);
    await service.install(); assert.equal(opened.length, 1);
  }
});
test('changed download and truncated files are removed and never offered for installation', async t => {
  for (const body of [Buffer.from('x'.repeat(bytes.length)), bytes.subarray(0, 8), Buffer.concat([bytes, bytes])]) {
    const { service, directory, opened } = await fixture(t, release(), { fetch: async url => String(url).includes('/latest') ? Response.json(release()) : new Response(body) });
    await service.check(); assert.equal((await service.download()).phase, 'error');
    assert.deepEqual(await readdir(directory), []); await service.install(); assert.equal(opened.length, 0);
  }
});
test('installer is rehashed at handoff and local tampering is rejected', async t => {
  const { service, directory, opened } = await fixture(t);
  await service.check(); await service.download();
  const folder = path.join(directory, (await readdir(directory))[0]);
  const file = path.join(folder, (await readdir(folder))[0]);
  await writeFile(file, 'x'.repeat(bytes.length));
  assert.equal((await service.install()).phase, 'error'); assert.equal(opened.length, 0); assert.deepEqual(await readdir(directory), []);
});
test('failed OS handoff keeps verified file ready for retry', async t => {
  let attempts = 0;
  const { service } = await fixture(t, release(), { openInstaller: async () => { if (++attempts === 1) throw new Error('Synthetic opener failure'); } });
  await service.check(); await service.download();
  assert.equal((await service.install()).phase, 'ready');
  assert.equal((await service.install()).phase, 'opened'); assert.equal(attempts, 2);
});
test('foreign redirect is blocked before any request to its host', async t => {
  const calls: string[] = [];
  const { service } = await fixture(t, release(), { fetch: async url => { calls.push(String(url)); return new Response(null, { status: 302, headers: { location: 'https://evil.example/payload' } }); } });
  assert.equal((await service.check()).phase, 'error'); assert.equal(calls.length, 1);
});
test('GitHub rate limits and offline errors remain recoverable', async t => {
  let count = 0;
  const { service } = await fixture(t, release(), { fetch: async () => ++count === 1 ? new Response(null, { status: 429 }) : count === 2 ? Promise.reject(new Error('Offline')) : Response.json(release()) });
  assert.match((await service.check()).message, /한도/);
  assert.equal((await service.check()).phase, 'error');
  assert.equal((await service.check()).phase, 'available');
});
test('concurrent checks are coalesced and cancellation leaves a retryable download', async t => {
  let requests = 0, started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  const { service, opened } = await fixture(t, release(), { fetch: async (url, init) => {
    requests++;
    if (String(url).includes('/latest')) { await new Promise(resolve => setTimeout(resolve, 10)); return Response.json(release()); }
    if (requests > 2) return new Response(bytes);
    started();
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true }));
  } });
  await Promise.all([service.check(), service.check()]); assert.equal(requests, 1);
  const downloading = service.download(); await waiting; service.cancel();
  assert.equal((await downloading).phase, 'available'); assert.equal(opened.length, 0);
  assert.equal((await service.download()).phase, 'ready');
});
