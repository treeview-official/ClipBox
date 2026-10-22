// Uses only Node builtins so release staging does not install or run app code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const checks = [
  'Packaged app identity, version and native architecture',
  'Manager renderer and restricted preload IPC are available',
  'Visible first-run consent with collection disabled and empty history',
  'Renderer sandbox, isolation, web security and no Node globals',
  'First-run UI rendered without observed renderer exceptions',
];
const nativeTargets = ['win32-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64'];
const artifactTargets = ['win-x64', 'mac-arm64', 'mac-x64', 'linux-x64'];

function repository(value = process.env.GITHUB_REPOSITORY) {
  assert.match(value ?? '', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Invalid repository identity.');
  return value;
}

function version(value) {
  assert.match(value ?? '', /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Expected a stable numeric package version.');
  return value;
}

function runId(value) {
  assert.match(value ?? '', /^[1-9]\d{0,19}$/, 'Run ID must contain digits only.');
  return value;
}

async function github(endpoint, allowMissing = false) {
  assert.ok(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN is required.');
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30_000),
  });
  if (allowMissing && response.status === 404) return null;
  assert.ok(response.ok, `GitHub metadata request failed (HTTP ${response.status}).`);
  return response.json();
}

export function expectedPackages(releaseVersion) {
  const v = version(releaseVersion);
  return [
    `ClipBox-Setup-${v}.exe`,
    `ClipBox-${v}-mac-arm64.dmg`, `ClipBox-${v}-mac-x64.dmg`,
    `ClipBox-${v}-mac-arm64.zip`, `ClipBox-${v}-mac-x64.zip`,
    `ClipBox-${v}-linux-amd64.deb`, `ClipBox-${v}-linux-x86_64.rpm`,
    `ClipBox-${v}-linux-x64.tar.gz`,
  ];
}

export async function assertReleaseAbsent(releaseVersion, repo = repository()) {
  const tag = `v${version(releaseVersion)}`;
  assert.equal(await github(`/repos/${repo}/releases/tags/${tag}`, true), null, `Release ${tag} already exists; nothing will be overwritten.`);
  // gh ignores --target when a tag already exists. Refuse that ambiguity too.
  assert.equal(await github(`/repos/${repo}/git/ref/tags/${tag}`, true), null, `Tag ${tag} already exists; inspect it before creating a release.`);
}

export async function readBuildMetadata() {
  const repo = repository();
  const id = runId(process.env.RUN_ID);
  const run = await github(`/repos/${repo}/actions/runs/${id}`);
  assert.equal(String(run.id), id, 'Build run ID differs.');
  assert.equal(run.repository?.full_name?.toLowerCase(), repo.toLowerCase(), 'Build belongs to another repository.');
  assert.equal(run.head_repository?.full_name?.toLowerCase(), repo.toLowerCase(), 'Build source belongs to another repository.');
  assert.equal(run.path, '.github/workflows/build-desktop.yml', 'Selected run is not the desktop packaging workflow.');
  assert.equal(run.event, 'workflow_dispatch', 'Selected build was not manually dispatched.');
  assert.equal(run.head_branch, 'main', 'Selected build is not from main.');
  assert.equal(run.status, 'completed', 'Selected build is still running.');
  assert.equal(run.conclusion, 'success', 'Selected build did not succeed.');
  assert.match(run.head_sha ?? '', /^[0-9a-f]{40}$/, 'Build commit must be a full SHA.');
  const runUrl = `https://github.com/${repo}/actions/runs/${id}`;
  assert.equal(run.html_url?.toLowerCase(), runUrl.toLowerCase(), 'Unexpected build URL.');

  const source = await github(`/repos/${repo}/contents/package.json?ref=${run.head_sha}`);
  assert.equal(source.encoding, 'base64', 'Expected a versioned package manifest.');
  assert.ok(source.size > 0 && source.size < 1_048_576, 'Unexpected manifest size.');
  const manifest = JSON.parse(Buffer.from(source.content, 'base64').toString('utf8'));
  assert.equal(manifest.name, 'clipbox', 'Unexpected package identity.');
  const releaseVersion = version(manifest.version);
  const artifacts = await github(`/repos/${repo}/actions/runs/${id}/artifacts?per_page=100`);
  const expected = artifactTargets.flatMap(target => [`ClipBox-${target}`, `startup-${target}`]).sort();
  assert.equal(artifacts.total_count, expected.length, 'Expected exactly four package and four startup artifacts.');
  assert.deepEqual(artifacts.artifacts.map(item => item.name).sort(), expected, 'Build artifact names differ from expected native targets.');
  assert.ok(artifacts.artifacts.every(item => item.expired === false && item.size_in_bytes > 0), 'A required build artifact is expired or empty.');
  await assertReleaseAbsent(releaseVersion, repo);

  assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required.');
  await appendFile(process.env.GITHUB_OUTPUT, `run_id=${id}\nversion=${releaseVersion}\nbuild_sha=${run.head_sha}\nrun_url=${runUrl}\n`);
  console.log(`Verified desktop build ${id}, commit ${run.head_sha}, version ${releaseVersion}; all eight artifacts are available.`);
}

async function filesWithin(directory, depth = 0) {
  assert.ok(depth <= 8, 'Unexpected artifact directory depth.');
  assert.ok((await lstat(directory)).isDirectory(), 'Artifact root must be a real directory.');
  const entries = await readdir(directory, { withFileTypes: true });
  assert.ok(entries.length <= 100, 'Unexpected artifact entry count.');
  const files = [];
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Artifact symlinks are not allowed.');
    if (entry.isDirectory()) files.push(...await filesWithin(filename, depth + 1));
    else {
      assert.ok(entry.isFile(), 'Unsupported artifact file type.');
      files.push(filename);
    }
  }
  return files;
}

export function validateEvidence(evidence, target, releaseVersion) {
  const [platform, arch] = target.split('-');
  assert.equal(evidence.result, 'passed', `${target}: startup did not pass.`);
  assert.equal(evidence.version, releaseVersion, `${target}: evidence version differs.`);
  assert.equal(evidence.hostPlatform, platform, `${target}: evidence host differs.`);
  assert.equal(evidence.hostArch, arch, `${target}: evidence architecture differs.`);
  assert.equal(evidence.runtime?.packaged, true, `${target}: app was not packaged.`);
  assert.equal(evidence.runtime?.name, 'ClipBox', `${target}: app identity differs.`);
  assert.equal(evidence.runtime?.version, releaseVersion, `${target}: runtime version differs.`);
  assert.equal(evidence.runtime?.platform, platform, `${target}: runtime platform differs.`);
  assert.equal(evidence.runtime?.arch, arch, `${target}: runtime is not native.`);
  assert.equal(evidence.runtime?.sandboxDisabled, false, `${target}: sandbox was disabled.`);
  assert.equal(evidence.bundledKoreanFont, 'loaded', `${target}: bundled Korean font was not verified as loaded.`);
  assert.equal(evidence.rendererErrorCount, 0, `${target}: renderer errors were observed.`);
  assert.equal(evidence.executableSource, 'explicit', `${target}: expected the installed/copied executable.`);
  assert.ok(Array.isArray(evidence.checks) && evidence.checks.length <= 30
    && evidence.checks.every(item => typeof item === 'string' && item.length <= 300)
    && checks.every(item => evidence.checks.includes(item)), `${target}: required startup checks are missing or different.`);
  assert.ok(!evidence.failureStep && !evidence.failureType, `${target}: evidence contains a failure.`);
  if (platform === 'linux') assert.equal(evidence.displayBackend, 'x11', 'Linux evidence must identify the tested X11 backend.');
  return {
    target, result: 'passed', version: releaseVersion, hostPlatform: platform, hostArch: arch,
    runtime: { packaged: true, name: 'ClipBox', version: releaseVersion, platform, arch, sandboxDisabled: false },
    bundledKoreanFont: 'loaded', rendererErrorCount: 0, checks: [...evidence.checks],
    ...(platform === 'linux' ? { displayBackend: 'x11' } : {}),
  };
}

async function copyAndHash(source, destination) {
  const info = await lstat(source);
  assert.ok(info.isFile() && info.size > 0, 'Install packages must be nonempty regular files.');
  const hash = createHash('sha256');
  let bytes = 0;
  const digest = new Transform({ transform(chunk, encoding, callback) { bytes += chunk.length; hash.update(chunk); callback(null, chunk); } });
  await pipeline(createReadStream(source), digest, createWriteStream(destination, { flags: 'wx', mode: 0o644 }));
  assert.equal(bytes, info.size, 'Install package changed during staging.');
  return { filename: path.basename(destination), bytes, sha256: hash.digest('hex') };
}

function releaseNotes(v, repo, runUrl, sha) {
  const base = `https://github.com/${repo}`;
  const download = name => `${base}/releases/download/v${v}/${name}`;
  return `# ClipBox ${v}

내 컴퓨터에 맞는 설치 파일을 내려받아 실행하세요. Node.js·npm·소스 코드 설치는 필요하지 않습니다.

| 컴퓨터 | 다운로드 | 설치 방법 |
|---|---|---|
| Windows 10/11 · Intel/AMD 64비트 | [Windows 설치 파일 (.exe)](${download(`ClipBox-Setup-${v}.exe`)}) | [Windows 안내](${base}/blob/main/docs/INSTALL.md#windows) |
| Mac · Apple Silicon | [Apple Silicon용 (.dmg)](${download(`ClipBox-${v}-mac-arm64.dmg`)}) | [Mac 안내](${base}/blob/main/docs/INSTALL.md#mac) |
| Mac · Intel | [Intel용 (.dmg)](${download(`ClipBox-${v}-mac-x64.dmg`)}) | [Mac 안내](${base}/blob/main/docs/INSTALL.md#mac) |
| Ubuntu/Debian 계열 · Intel/AMD 64비트 | [DEB 설치 파일 (.deb)](${download(`ClipBox-${v}-linux-amd64.deb`)}) | [Linux 안내](${base}/blob/main/docs/INSTALL.md#linux) |
| Fedora/RHEL 계열 · Intel/AMD 64비트 | [RPM 설치 파일 (.rpm)](${download(`ClipBox-${v}-linux-x86_64.rpm`)}) | [Linux 안내](${base}/blob/main/docs/INSTALL.md#linux) · 해당 배포판 설치·실행 미검증 |

추가 압축 배포물: [Mac Apple Silicon ZIP](${download(`ClipBox-${v}-mac-arm64.zip`)}), [Mac Intel ZIP](${download(`ClipBox-${v}-mac-x64.zip`)}), [Linux TAR.GZ](${download(`ClipBox-${v}-linux-x64.tar.gz`)}).

## 설치 후 처음 사용하기

최초 안내에서 기록 수집에 동의하면 새로 복사한 내용을 저장합니다. Windows/Linux는 Ctrl+Shift+V, Mac은 ⌘+Shift+V로 기록을 열고 Enter로 다시 복사한 다음 대상 앱에서 Ctrl+V / ⌘+V로 붙여넣습니다. 자세한 순서는 [설치·사용 안내](${base}/blob/main/docs/INSTALL.md)에 있습니다.

## 이번 배포물의 검증 범위

[네이티브 빌드 실행 기록](${runUrl})의 네 작업이 성공했습니다. Windows x64는 NSIS 설치 후, macOS arm64·x64는 DMG를 마운트하고 앱을 복사한 후, Ubuntu x64는 DEB 설치 후 X11/Xvfb에서 실행했습니다. 네 환경 모두 패키지 버전·네이티브 아키텍처, 관리 화면·제한된 preload API, 기록 수집이 꺼진 최초 동의 화면과 빈 기록, 렌더러 sandbox·격리·웹 보안·Node 접근 차단, 시작 시 관찰된 렌더러 예외 0건을 확인했습니다. 테스트 중 sandbox를 끄지 않았으며 클립보드 읽기·쓰기나 기록 수집 동의를 수행하지 않았습니다.

이 검사는 시작 화면 확인이며 설치 마법사 전체, 재부팅·로그인 자동 시작, 앱 사이 클립보드·전역 단축키 사용을 모두 검증한 것은 아닙니다. RPM은 패키지 메타데이터 조회만 확인했으며 Fedora/RHEL 설치·실행은 미검증입니다. ZIP/TAR 파일은 별도 설치·실행 검사를 하지 않았습니다. Wayland는 미검증이며 클립보드 수집·단축키·창 포커스에 제한이 있을 수 있습니다.

Windows 개발자 인증서 서명과 Apple Developer ID 서명·공증은 적용되지 않았습니다. 운영체제에서 추가 확인을 요청할 수 있으므로 [공식 배포 파일 확인 및 OS별 설치 안내](${base}/blob/main/docs/INSTALL.md)를 참고하세요.

빌드 커밋: [${sha}](${base}/commit/${sha}). 설치 파일의 SHA-256은 [SHA256SUMS.txt](${download('SHA256SUMS.txt')}), 네이티브 실행 검증과 파일별 해시는 [검증 JSON](${download(`ClipBox-${v}-verification.json`)})에 있습니다.
`;
}

export async function stageRelease(root = process.cwd()) {
  const v = version(process.env.MANIFEST_VERSION);
  const repo = repository();
  const id = runId(process.env.BUILD_RUN_ID);
  const sha = process.env.BUILD_SHA;
  assert.match(sha ?? '', /^[0-9a-f]{40}$/, 'Expected a full build commit SHA.');
  const runUrl = `https://github.com/${repo}/actions/runs/${id}`;
  assert.equal(process.env.BUILD_RUN_URL, runUrl, 'Build run URL differs.');
  const packages = await filesWithin(path.join(root, 'staged/packages'));
  assert.deepEqual(packages.map(item => path.basename(item)).sort(), expectedPackages(v).sort(), 'Expected exactly eight install/archive filenames for this version.');
  const evidenceFiles = await filesWithin(path.join(root, 'staged/evidence'));
  const jsonFiles = evidenceFiles.filter(item => item.endsWith('.json'));
  assert.deepEqual(jsonFiles.map(item => path.basename(item)).sort(), nativeTargets.map(target => `${target}.json`).sort(), 'Expected four native startup JSON files.');
  assert.ok(evidenceFiles.every(item => /\.(json|png)$/.test(item)), 'Unexpected startup evidence file type.');
  const nativeStartup = [];
  for (const target of nativeTargets) {
    const filename = jsonFiles.find(item => path.basename(item) === `${target}.json`);
    assert.ok((await lstat(filename)).size <= 65_536, 'Startup evidence is unexpectedly large.');
    nativeStartup.push(validateEvidence(JSON.parse(await readFile(filename, 'utf8')), target, v));
  }

  // Refuse existing output directories/files, including previous partial runs.
  const output = path.join(root, 'release-upload');
  await mkdir(output);
  const artifacts = [];
  for (const filename of packages.sort()) artifacts.push(await copyAndHash(filename, path.join(output, path.basename(filename))));
  const verificationName = `ClipBox-${v}-verification.json`;
  const verification = {
    schemaVersion: 1, version: v, generatedAt: new Date().toISOString(),
    source: { repository: repo, commit: sha, runId: id, runUrl },
    scope: 'Packaged native startup and first-run consent only; no clipboard access or collection opt-in.',
    limitations: ['No complete interactive installer or cross-application clipboard test.', 'No Apple Developer ID signing/notarization or Windows developer-certificate signing.', 'RPM metadata only; Fedora/RHEL installation and startup not tested.', 'ZIP/TAR startup, login auto-start and Wayland not tested.'],
    nativeStartup, artifacts,
  };
  const verificationBytes = Buffer.from(`${JSON.stringify(verification, null, 2)}\n`);
  await writeFile(path.join(output, verificationName), verificationBytes, { flag: 'wx' });
  const allHashes = [...artifacts, { filename: verificationName, sha256: createHash('sha256').update(verificationBytes).digest('hex') }];
  await writeFile(path.join(output, 'SHA256SUMS.txt'), allHashes.map(item => `${item.sha256}  ${item.filename}\n`).join(''), { flag: 'wx' });
  await writeFile(path.join(root, 'release-notes.md'), releaseNotes(v, repo, runUrl, sha), { flag: 'wx' });
  assert.equal((await readdir(output)).length, 10, 'Expected ten release upload files.');
  console.log(`Validated eight packages and four passing native startup reports; ten upload files prepared for v${v}.`);
  for (const artifact of artifacts) console.log(`${artifact.filename}: ${artifact.bytes} bytes, SHA-256 ${artifact.sha256}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === 'metadata') await readBuildMetadata();
  else if (mode === 'stage') await stageRelease();
  else if (mode === 'check-release') await assertReleaseAbsent(process.env.MANIFEST_VERSION);
  else throw new Error('Usage: node scripts/prepare-release.mjs metadata|stage|check-release');
}
