import { build } from 'electron-builder';
import { build as viteBuild } from 'vite';
import { buildElectron } from './build.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createLinuxArchive } from './linux-archive.mjs';

const requested = process.argv[2] ?? 'native';
const current = { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform];
const mode = requested === 'native' || requested === 'pack' ? current : requested;
if (!mode || !['win', 'mac', 'linux', 'linux-archive'].includes(mode)) throw new Error('지원하는 빌드 대상: win, mac, linux, linux-archive');
if (mode === 'mac' && process.platform !== 'darwin') throw new Error('macOS DMG/서명 빌드는 macOS에서 실행하세요. .github/workflows/build-desktop.yml의 macOS 작업도 사용할 수 있습니다.');
await Promise.all([buildElectron(), viteBuild()]);
const { Platform, Arch } = await import('electron-builder');
const platform = mode === 'mac' ? Platform.MAC : mode.startsWith('linux') ? Platform.LINUX : Platform.WINDOWS;
// Windows cannot preserve POSIX executable bits in extracted Electron files.
// Build the Linux directory, then set explicit modes in a portable TAR archive.
const isLinux = platform === Platform.LINUX;
const targets = requested === 'pack' || isLinux ? ['dir'] : undefined;
const architectures = mode === 'mac' ? [Arch.x64, Arch.arm64] : [Arch.x64];
await build({ targets: platform.createTarget(targets, ...architectures), publish: 'never' });
if (isLinux && requested !== 'pack') {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const output = path.resolve(pkg.build.directories.output);
  const prefix = `ClipBox-${pkg.version}-linux-x64`;
  const archive = path.join(output, `${prefix}.tar.gz`);
  await createLinuxArchive(path.join(output, 'linux-unpacked'), archive, prefix);
  console.log(`Linux archive with verified executable permissions: ${archive}`);
}
