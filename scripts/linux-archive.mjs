import { create, list } from 'tar';
import { rename, rm } from 'node:fs/promises';

const executables = new Set(['app.clipbox.desktop', 'chrome-sandbox', 'chrome_crashpad_handler']);
// This portable archive deliberately assigns no root ownership or setuid bits.
// DEB/RPM installers use electron-builder's native sandbox/AppArmor setup instead.

export async function createLinuxArchive(directory, destination, prefix) {
  const temporary = `${destination}.tmp`;
  try {
    await create({
      cwd: directory, file: temporary, gzip: true, portable: true, prefix,
      onWriteEntry(entry) {
        const relative = entry.path.replace(/^\.\//, '').replace(/\\/g, '/');
        if (entry.stat && entry.type === 'Directory') entry.stat.mode = 0o755;
        if (entry.stat && entry.type === 'File') {
          entry.stat.mode = executables.has(relative) ? 0o755 : 0o644;
        }
      },
    }, ['.']);
    const found = new Set();
    await list({ file: temporary, onReadEntry(entry) {
      const relative = entry.path.replace(`${prefix}/`, '').replace(/^\.\//, '');
      if (executables.has(relative)) {
        if ((entry.mode & 0o777) !== 0o755) throw new Error(`Linux executable permissions are missing: ${relative}`);
        found.add(relative);
      }
    } });
    for (const executable of executables) {
      if (!found.has(executable)) throw new Error(`Linux package is missing: ${executable}`);
    }
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
