import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdtemp, open, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import type { InstallerFormat, UpdateRelease, UpdateState } from '../shared/contracts';

const REPO = 'https://github.com/treeview-official/ClipBox';
const LATEST = 'https://api.github.com/repos/treeview-official/ClipBox/releases/latest';
const MAX_PACKAGE = 512 * 1024 * 1024;
const trustedHosts = new Set(['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
class UpdateError extends Error {}
interface Candidate { release: UpdateRelease; url: string; sha256: string }
interface Options {
  version: string; platform: string; arch: string; linuxRelease?: string; tempDirectory: string;
  fetch?: typeof globalThis.fetch; changed: (state: UpdateState) => void;
  openInstaller: (filename: string) => Promise<void>;
  revealInstaller?: (filename: string) => void;
}
async function* responseChunks(response: Response) {
  const reader = response.body!.getReader();
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; yield value; }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
function stableVersion(value: unknown): number[] {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,7})\.(0|[1-9]\d{0,7})\.(0|[1-9]\d{0,7})$/.test(value)) throw new UpdateError('배포 버전 정보가 올바르지 않습니다.');
  return value.split('.').map(Number);
}
export function compareVersions(left: string, right: string): number {
  const a = stableVersion(left), b = stableVersion(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
export function installerFormat(platform: string, arch: string, osRelease = ''): InstallerFormat | null {
  if (platform === 'win32') return arch === 'x64' ? 'exe' : null;
  if (platform === 'darwin') return ['arm64', 'x64'].includes(arch) ? 'dmg' : null;
  if (platform !== 'linux' || arch !== 'x64') return null;
  const ids = osRelease.split(/\r?\n/).filter(line => /^(ID|ID_LIKE)=/.test(line)).map(line => line.slice(line.indexOf('=') + 1).replace(/["']/g, '')).join(' ').split(/\s+/);
  if (ids.some(id => ['debian', 'ubuntu', 'linuxmint', 'pop'].includes(id))) return 'deb';
  if (ids.some(id => ['fedora', 'rhel', 'centos', 'rocky', 'almalinux', 'opensuse', 'suse'].includes(id))) return 'rpm';
  return 'tar.gz';
}
export function installerName(version: string, format: InstallerFormat, arch: string): string {
  stableVersion(version);
  if (format === 'exe') return `ClipBox-Setup-${version}.exe`;
  if (format === 'dmg') return `ClipBox-${version}-mac-${arch}.dmg`;
  return `ClipBox-${version}-linux-${format === 'deb' ? 'amd64' : format === 'rpm' ? 'x86_64' : 'x64'}.${format}`;
}
export function parseRelease(input: unknown, platform: string, arch: string, osRelease = ''): Candidate {
  const data = input as Record<string, any> | null;
  if (!data || typeof data !== 'object' || data.draft !== false || data.prerelease !== false || typeof data.tag_name !== 'string' || !data.tag_name.startsWith('v')) throw new UpdateError('공식 정식 배포 정보를 확인하지 못했습니다.');
  const version = data.tag_name.slice(1); stableVersion(version);
  if (data.html_url !== `${REPO}/releases/tag/v${version}`) throw new UpdateError('배포 출처가 올바르지 않습니다.');
  const format = installerFormat(platform, arch, osRelease);
  if (!format) throw new UpdateError('현재 운영체제·CPU용 업데이트 설치 파일이 없습니다.');
  const filename = installerName(version, format, arch);
  if (!Array.isArray(data.assets) || data.assets.length > 100) throw new UpdateError('배포 파일 목록이 올바르지 않습니다.');
  const matches = data.assets.filter((asset: any) => asset?.name === filename);
  const asset = matches[0];
  const url = `${REPO}/releases/download/v${version}/${filename}`;
  if (matches.length !== 1 || asset.state !== 'uploaded' || asset.browser_download_url !== url || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_PACKAGE || typeof asset.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(asset.digest)) throw new UpdateError('이 운영체제의 설치 파일 또는 무결성 정보가 아직 준비되지 않았습니다. 잠시 후 다시 확인해 주세요.');
  return { release: { version, filename, format, bytes: asset.size, notes: typeof data.body === 'string' ? data.body.slice(0, 20_000) : '', publishedAt: typeof data.published_at === 'string' ? data.published_at.slice(0, 40) : '' }, url, sha256: asset.digest.slice(7) };
}

/** Main-process only, user initiated; never receives clipboard data or renderer URLs. */
export class UpdateService {
  private state: UpdateState;
  private candidate?: Candidate;
  private operation?: AbortController;
  private file?: string;
  private directory?: string;
  private opened = false;
  constructor(private readonly options: Options) {
    this.state = { phase: 'idle', currentVersion: options.version, progress: 0, downloadedBytes: 0, message: '버튼을 눌러 최신 버전을 확인하세요.' };
  }
  read(): UpdateState { return structuredClone(this.state); }
  private set(patch: Partial<UpdateState>) { this.state = { ...this.state, ...patch }; this.options.changed(this.read()); }
  private async request(url: string, signal: AbortSignal): Promise<Response> {
    for (let redirect = 0; redirect <= 5; redirect++) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !trustedHosts.has(parsed.hostname)) throw new UpdateError('허용되지 않은 다운로드 경로입니다.');
      const response = await (this.options.fetch ?? globalThis.fetch)(url, { redirect: 'manual', signal, headers: { Accept: parsed.hostname === 'api.github.com' ? 'application/vnd.github+json' : 'application/octet-stream', 'User-Agent': 'ClipBox-Update', 'X-GitHub-Api-Version': '2022-11-28' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location) throw new UpdateError('다운로드 주소를 확인하지 못했습니다.');
        url = new URL(location, url).href; continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new UpdateError(response.status === 403 || response.status === 429 ? 'GitHub 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' : response.status === 404 ? '공개된 업데이트 파일을 찾지 못했습니다. 잠시 후 다시 확인해 주세요.' : '업데이트 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      return response;
    }
    throw new UpdateError('다운로드 주소 이동이 너무 많습니다.');
  }
  private async discard(): Promise<void> {
    // Only unlink the exact temporary file we created, never user data or a tree.
    if (this.file) await unlink(this.file).catch(() => {});
    if (this.directory) await rmdir(this.directory).catch(() => {});
    this.file = undefined; this.directory = undefined;
  }
  async check(): Promise<UpdateState> {
    if (this.operation || this.opened) return this.read();
    const controller = new AbortController(); this.operation = controller;
    this.set({ phase: 'checking', release: undefined, progress: 0, downloadedBytes: 0, message: '최신 버전을 확인하고 있어요…' });
    this.candidate = undefined;
    try {
      await this.discard();
      if (!installerFormat(this.options.platform, this.options.arch, this.options.linuxRelease)) { this.set({ phase: 'unsupported', message: '현재 운영체제·CPU용 설치 파일은 제공하지 않습니다.' }); return this.read(); }
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]);
      const response = await this.request(LATEST, signal);
      if (!response.body) throw new UpdateError('배포 정보를 읽을 수 없습니다.');
      const chunks: Uint8Array[] = []; let size = 0;
      for await (const chunk of responseChunks(response)) {
        size += chunk.length; if (size > 512 * 1024) throw new UpdateError('배포 정보가 너무 큽니다.');
        chunks.push(chunk);
      }
      const candidate = parseRelease(JSON.parse(Buffer.concat(chunks).toString('utf8')), this.options.platform, this.options.arch, this.options.linuxRelease);
      const newer = compareVersions(candidate.release.version, this.options.version) > 0;
      this.candidate = newer ? candidate : undefined;
      this.set({ phase: newer ? 'available' : 'current', release: candidate.release, message: newer ? `새 버전 ${candidate.release.version}을 설치할 수 있어요.` : '사용 가능한 새 버전이 없습니다. 현재 버전을 계속 사용하세요.' });
    } catch (error) { this.set({ phase: 'error', message: error instanceof UpdateError ? error.message : '업데이트를 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.' }); }
    finally { this.operation = undefined; }
    return this.read();
  }
  cancel(): void { if (this.state.phase === 'downloading') this.operation?.abort(); }
  reveal(): void { if (this.state.phase === 'ready' && this.file) this.options.revealInstaller?.(this.file); }
  async download(): Promise<UpdateState> {
    if (this.operation || !this.candidate || this.state.phase !== 'available') return this.read();
    const candidate = this.candidate, controller = new AbortController(); this.operation = controller;
    this.set({ phase: 'downloading', progress: 0, downloadedBytes: 0, message: '공식 설치 파일을 내려받고 있어요…' });
    try {
      await this.discard();
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15 * 60_000)]);
      const response = await this.request(candidate.url, signal);
      if (!response.body) throw new UpdateError('설치 파일이 비어 있습니다.');
      this.directory = await mkdtemp(path.join(this.options.tempDirectory, 'ClipBox-update-'));
      this.file = path.join(this.directory, candidate.release.filename);
      const file = await open(this.file, 'wx', 0o600);
      const hash = createHash('sha256'); let size = 0, lastProgress = -1;
      try {
        for await (const chunk of responseChunks(response)) {
          if (signal.aborted) throw new UpdateError('다운로드가 중단되었습니다.');
          size += chunk.length;
          if (size > candidate.release.bytes) throw new UpdateError('설치 파일 크기가 배포 정보와 다릅니다. 다시 확인해 주세요.');
          hash.update(chunk); await file.writeFile(chunk);
          const progress = Math.floor(size / candidate.release.bytes * 100);
          if (progress !== lastProgress) { lastProgress = progress; this.set({ progress, downloadedBytes: size }); }
        }
        if (size !== candidate.release.bytes || hash.digest('hex') !== candidate.sha256) throw new UpdateError('파일 무결성 확인에 실패했습니다. 설치하지 않았습니다. 업데이트를 다시 확인해 주세요.');
        if (signal.aborted) throw new UpdateError('다운로드가 중단되었습니다.');
        await file.sync();
        if (signal.aborted) throw new UpdateError('다운로드가 중단되었습니다.');
      } finally { await file.close(); }
      this.set({ phase: 'ready', progress: 100, message: '다운로드와 무결성 확인이 끝났습니다. 설치를 진행할 수 있어요.' });
    } catch (error) {
      const cancelled = controller.signal.aborted;
      controller.abort();
      await this.discard();
      this.set({ phase: cancelled ? 'available' : 'error', progress: 0, downloadedBytes: 0, message: cancelled ? '다운로드를 취소했습니다. 원할 때 다시 받을 수 있어요.' : error instanceof UpdateError ? error.message : '다운로드하지 못했습니다. 인터넷 연결과 저장 공간을 확인한 뒤 다시 시도해 주세요.' });
    } finally { this.operation = undefined; }
    return this.read();
  }
  async install(): Promise<UpdateState> {
    if (this.operation || this.state.phase !== 'ready' || !this.file || !this.candidate) return this.read();
    this.operation = new AbortController();
    this.set({ phase: 'opening', message: '설치 파일을 확인하고 여는 중…' });
    try {
      const info = await lstat(this.file);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size !== this.candidate.release.bytes) throw new UpdateError('다운로드한 파일이 변경되었습니다. 업데이트를 다시 확인해 주세요.');
      const hash = createHash('sha256');
      const handle = await open(this.file, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW));
      try { for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk); }
      finally { await handle.close(); }
      if (hash.digest('hex') !== this.candidate.sha256) throw new UpdateError('다운로드한 파일이 변경되었습니다. 설치하지 않았습니다. 업데이트를 다시 확인해 주세요.');
      await this.options.openInstaller(this.file);
      this.opened = true;
      this.set({ phase: 'opened', message: '설치 파일을 열었습니다. 운영체제의 안내에 따라 업데이트를 완료하세요.' });
    } catch (error) {
      if (error instanceof UpdateError) { await this.discard(); this.set({ phase: 'error', message: error.message }); }
      else this.set({ phase: 'ready', message: '설치 파일을 열지 못했습니다. 기본 설치 프로그램을 확인하고 다시 시도해 주세요.' });
    } finally { this.operation = undefined; }
    return this.read();
  }
  dispose(): void { this.operation?.abort(); }
}
