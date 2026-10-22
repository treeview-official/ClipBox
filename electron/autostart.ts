import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { AUTOSTART_OWNER_MARKER, DESKTOP_FILE_NAME, linuxAutostartEntry } from './platform';

/** Only manages this app's marked file; no shell commands or system-wide writes. */
export class LinuxAutostartFile {
  private readonly target: string;

  constructor(target: string) {
    if (!path.isAbsolute(target) || path.basename(target) !== DESKTOP_FILE_NAME) throw new Error('자동 시작 파일 경로가 올바르지 않습니다.');
    this.target = path.resolve(target);
  }

  private readOwned(): string | null {
    let stat;
    try { stat = lstatSync(this.target); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 16_384) throw new Error('기존 자동 시작 파일을 안전하게 변경할 수 없습니다.');
    const contents = readFileSync(this.target, 'utf8');
    if (!contents.split(/\r?\n/).includes(AUTOSTART_OWNER_MARKER)) throw new Error('ClipBox에서 만든 자동 시작 파일이 아니므로 변경하지 않았습니다.');
    return contents;
  }

  private writeAtomic(contents: string): void {
    mkdirSync(path.dirname(this.target), { recursive: true, mode: 0o700 });
    const temporary = this.target + '.' + randomUUID() + '.tmp';
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, 'wx', 0o600);
      writeFileSync(descriptor, contents, 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporary, this.target);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      try { unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }

  /** Returns a rollback preserving the exact previous owned file. */
  set(enabled: boolean, executable?: string): () => void {
    const previous = this.readOwned();
    const next = enabled ? linuxAutostartEntry(executable ?? '') : null;
    if (next !== null) this.writeAtomic(next);
    else if (previous !== null) unlinkSync(this.target);
    return () => {
      // A concurrent external edit takes precedence over automatic rollback.
      if (this.readOwned() !== next) throw new Error('자동 시작 파일이 변경되어 이전 설정으로 되돌리지 못했습니다.');
      if (previous !== null) this.writeAtomic(previous);
      else if (next !== null) unlinkSync(this.target);
    };
  }
}
