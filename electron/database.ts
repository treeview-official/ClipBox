import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ClipDetail, ClipItem, ClipboardKind, ListQuery, ListResult, Stats } from '../shared/contracts';
import { classifyText, contentHash, escapeLike, makePreviewText, MAX_IMAGE_BYTES, MAX_TEXT_BYTES, normalizeSearch } from './content';

interface ClipRow {
  id: string; kind: ClipboardKind; content_text: string | null;
  image_relpath: string | null; thumbnail_relpath: string | null;
  preview_text: string; byte_size: number; image_width: number | null;
  image_height: number | null; is_favorite: number; created_at: number;
}

const SCHEMA_VERSION = 2;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.thumb)?\.png$/;

function secureDatabaseFiles(databasePath: string): void {
  for (const filename of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    const info = lstatSync(filename, { throwIfNoEntry: false });
    if (!info) continue;
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('저장소에 연결된 파일 경로를 사용할 수 없습니다.');
    if (process.platform !== 'win32') chmodSync(filename, 0o600);
  }
}

export class ClipRepository {
  private readonly db: DatabaseSync;
  private readonly imagesRoot: string;
  private closed = false;

  constructor(root: string) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    if (lstatSync(root).isSymbolicLink()) throw new Error('저장 폴더에 연결된 경로를 사용할 수 없습니다.');
    // Only this app-owned directory is restricted; never chmod its ancestors.
    if (process.platform !== 'win32') chmodSync(root, 0o700);
    const images = path.join(root, 'images');
    mkdirSync(images, { recursive: true, mode: 0o700 });
    if (lstatSync(images).isSymbolicLink()) throw new Error('이미지 저장 폴더에 연결된 경로를 사용할 수 없습니다.');
    if (process.platform !== 'win32') chmodSync(images, 0o700);
    this.imagesRoot = realpathSync(images);
    const databasePath = path.join(root, 'clipbox.sqlite');
    secureDatabaseFiles(databasePath);
    this.db = new DatabaseSync(databasePath, { timeout: 5000 });
    try {
      // SQLite derives new sidecar permissions from the database. Restrict it
      // before WAL activation or migrations can write any clipboard content.
      secureDatabaseFiles(databasePath);
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;');
      secureDatabaseFiles(databasePath);
      this.migrate();
      secureDatabaseFiles(databasePath);
      this.purgeDeletedFiles();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private migrate(): void {
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
    if (version > SCHEMA_VERSION) throw new Error('더 새로운 ClipBox 버전에서 만든 데이터입니다. 앱을 업데이트해 주세요.');
    this.transaction(() => {
      if (version < 1) {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS clipboard_items (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('text', 'link', 'image')),
            content_text TEXT,
            image_relpath TEXT,
            content_hash TEXT NOT NULL,
            preview_text TEXT NOT NULL DEFAULT '',
            mime_type TEXT,
            byte_size INTEGER NOT NULL DEFAULT 0,
            image_width INTEGER,
            image_height INTEGER,
            is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
            created_at INTEGER NOT NULL,
            last_copied_at INTEGER,
            CHECK ((kind = 'image' AND image_relpath IS NOT NULL)
              OR (kind IN ('text', 'link') AND content_text IS NOT NULL))
          );
          CREATE INDEX IF NOT EXISTS idx_clips_created ON clipboard_items(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_clips_favorite ON clipboard_items(is_favorite, created_at DESC);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_clips_hash ON clipboard_items(content_hash);
          PRAGMA user_version = 1;
        `);
      }
      if (version < 2) {
        this.db.exec(`
          ALTER TABLE clipboard_items ADD COLUMN search_text TEXT NOT NULL DEFAULT '';
          ALTER TABLE clipboard_items ADD COLUMN thumbnail_relpath TEXT;
          CREATE TABLE deleted_image_files (relpath TEXT PRIMARY KEY);
        `);
        const update = this.db.prepare('UPDATE clipboard_items SET search_text = ? WHERE id = ?');
        for (const row of this.db.prepare('SELECT id, content_text FROM clipboard_items').all()) {
          update.run(normalizeSearch(String(row.content_text ?? '')), row.id as string);
        }
        this.db.exec('PRAGMA user_version = 2');
      }
    });
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  list(query: ListQuery = {}): ListResult {
    if (!query || typeof query !== 'object' || Array.isArray(query)) throw new Error('검색 조건이 올바르지 않습니다.');
    const clauses: string[] = [];
    const values: SQLInputValue[] = [];
    if (query.kind !== undefined) {
      if (!['text', 'link', 'image'].includes(query.kind)) throw new Error('기록 종류가 올바르지 않습니다.');
      clauses.push('kind = ?'); values.push(query.kind);
    }
    if (query.favorite !== undefined) {
      if (typeof query.favorite !== 'boolean') throw new Error('즐겨찾기 조건이 올바르지 않습니다.');
      clauses.push('is_favorite = ?'); values.push(query.favorite ? 1 : 0);
    }
    if (query.query !== undefined) {
      if (typeof query.query !== 'string' || query.query.length > 2000) throw new Error('검색어는 2,000자 이하로 입력해 주세요.');
      if (query.query) {
        clauses.push("kind IN ('text', 'link') AND search_text LIKE ? ESCAPE '\\'");
        values.push(`%${escapeLike(normalizeSearch(query.query))}%`);
      }
    }
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('페이지 범위가 올바르지 않습니다.');
    if (query.sort !== undefined && !['newest', 'oldest'].includes(query.sort)) throw new Error('정렬 방식이 올바르지 않습니다.');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const order = query.sort === 'oldest' ? 'ASC' : 'DESC';
    const rows = this.db.prepare(`SELECT id, kind, preview_text, created_at, is_favorite, byte_size,
      image_width, image_height, image_relpath, thumbnail_relpath
      FROM clipboard_items ${where} ORDER BY created_at ${order}, rowid ${order} LIMIT ? OFFSET ?`).all(...values, limit, offset) as unknown as ClipRow[];
    const total = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM clipboard_items ${where}`).get(...values)?.count ?? 0);
    const stats = this.db.prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(kind = 'text'), 0) AS text, COALESCE(SUM(kind = 'link'), 0) AS link,
      COALESCE(SUM(kind = 'image'), 0) AS image, COALESCE(SUM(is_favorite), 0) AS favorite,
      COALESCE(SUM(byte_size), 0) AS byteSize FROM clipboard_items`).get() as unknown as Stats;
    return { items: rows.map((row) => this.toItem(row)), total, stats: { ...stats } };
  }

  get(id: string): ClipDetail | null {
    const row = this.row(id);
    if (!row) return null;
    const item: ClipDetail = this.toItem(row);
    if (row.content_text !== null) item.contentText = row.content_text;
    if (row.kind === 'image' && row.image_relpath) {
      const image = this.readImage(row.image_relpath);
      if (image) item.imageDataUrl = `data:image/png;base64,${image.toString('base64')}`;
    }
    return item;
  }

  upsertText(text: string, now = Date.now()): void {
    if (typeof text !== 'string') throw new Error('텍스트 형식이 올바르지 않습니다.');
    if (!text.trim()) return;
    const byteSize = Buffer.byteLength(text, 'utf8');
    if (byteSize > MAX_TEXT_BYTES) throw new Error('2MB를 초과하는 텍스트는 저장하지 않습니다.');
    this.validateTimestamp(now);
    const kind = classifyText(text);
    this.db.prepare(`INSERT INTO clipboard_items
      (id, kind, content_text, content_hash, preview_text, mime_type, byte_size, created_at, search_text)
      VALUES (?, ?, ?, ?, ?, 'text/plain', ?, ?, ?)
      ON CONFLICT(content_hash) DO UPDATE SET created_at = excluded.created_at, last_copied_at = excluded.created_at`)
      .run(randomUUID(), kind, text, contentHash(kind, text), makePreviewText(text), byteSize, now, normalizeSearch(text));
  }

  upsertImage(png: Buffer, width: number, height: number, thumbnail?: Buffer, now = Date.now()): void {
    this.validatePng(png, MAX_IMAGE_BYTES);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 32768 || height > 32768 || width * height > 100_000_000 || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) throw new Error('이미지 크기가 올바르지 않거나 너무 큽니다.');
    if (thumbnail) this.validatePng(thumbnail, 512 * 1024);
    this.validateTimestamp(now);
    const hash = contentHash('image', png);
    const duplicate = this.db.prepare('SELECT id FROM clipboard_items WHERE content_hash = ?').get(hash);
    if (duplicate) {
      this.db.prepare('UPDATE clipboard_items SET created_at = ?, last_copied_at = ? WHERE id = ?').run(now, now, duplicate.id as string);
      return;
    }
    const id = randomUUID();
    const imagePath = `${id}.png`;
    const thumbnailPath = thumbnail ? `${id}.thumb.png` : null;
    const written: string[] = [];
    try {
      this.writeImage(imagePath, png); written.push(imagePath);
      if (thumbnail && thumbnailPath) { this.writeImage(thumbnailPath, thumbnail); written.push(thumbnailPath); }
      this.db.prepare(`INSERT INTO clipboard_items
        (id, kind, image_relpath, thumbnail_relpath, content_hash, preview_text, mime_type, byte_size, image_width, image_height, created_at)
        VALUES (?, 'image', ?, ?, ?, '캡처 이미지', 'image/png', ?, ?, ?, ?)`)
        .run(id, imagePath, thumbnailPath, hash, png.length, width, height, now);
    } catch (error) {
      for (const filename of written) this.deleteImage(filename);
      throw error;
    }
  }

  getImageBuffer(id: string): Buffer | null {
    const row = this.row(id);
    return row?.kind === 'image' && row.image_relpath ? this.readImage(row.image_relpath) : null;
  }

  toggleFavorite(id: string): void {
    this.db.prepare('UPDATE clipboard_items SET is_favorite = 1 - is_favorite WHERE id = ?').run(id);
  }

  remove(id: string): void {
    const row = this.row(id);
    if (row) this.deleteRows([row]);
  }

  clear(): void {
    this.deleteRows(this.db.prepare('SELECT * FROM clipboard_items').all() as unknown as ClipRow[]);
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }

  cleanup(maxItems: number, retentionDays: number, now = Date.now()): void {
    if (!Number.isSafeInteger(maxItems) || maxItems < 0 || !Number.isSafeInteger(retentionDays) || retentionDays < 0) throw new Error('자동 정리 조건이 올바르지 않습니다.');
    this.validateTimestamp(now);
    const cutoff = retentionDays === 0 ? -1 : now - retentionDays * 86_400_000;
    const expired = this.db.prepare('SELECT * FROM clipboard_items WHERE is_favorite = 0 AND created_at < ?').all(cutoff) as unknown as ClipRow[];
    const overflow = this.db.prepare(`SELECT * FROM clipboard_items WHERE is_favorite = 0 AND created_at >= ?
      ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ?`).all(cutoff, maxItems) as unknown as ClipRow[];
    this.deleteRows([...expired, ...overflow]);
  }

  close(): void {
    if (this.closed) return;
    this.db.close();
    this.closed = true;
  }

  private row(id: string): ClipRow | undefined {
    return this.db.prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id) as unknown as ClipRow | undefined;
  }

  private toItem(row: ClipRow): ClipItem {
    const item: ClipItem = { id: row.id, kind: row.kind, previewText: row.preview_text,
      createdAt: row.created_at, isFavorite: row.is_favorite === 1, byteSize: row.byte_size };
    if (row.image_width !== null) item.width = row.image_width;
    if (row.image_height !== null) item.height = row.image_height;
    const thumbnailPath = row.thumbnail_relpath ?? (row.byte_size <= 256 * 1024 ? row.image_relpath : null);
    if (thumbnailPath) {
      const thumbnail = this.readImage(thumbnailPath, 512 * 1024);
      if (thumbnail && thumbnail.length <= 512 * 1024) item.thumbnailDataUrl = `data:image/png;base64,${thumbnail.toString('base64')}`;
    }
    return item;
  }

  private deleteRows(rows: ClipRow[]): void {
    for (const row of rows) {
      if (row.image_relpath) this.imagePath(row.image_relpath);
      if (row.thumbnail_relpath) this.imagePath(row.thumbnail_relpath);
    }
    this.transaction(() => {
      const queue = this.db.prepare('INSERT OR IGNORE INTO deleted_image_files (relpath) VALUES (?)');
      const remove = this.db.prepare('DELETE FROM clipboard_items WHERE id = ?');
      for (const row of rows) {
        if (row.image_relpath) queue.run(row.image_relpath);
        if (row.thumbnail_relpath) queue.run(row.thumbnail_relpath);
        remove.run(row.id);
      }
    });
    this.purgeDeletedFiles();
  }

  /** Committed deletion jobs survive a crash between the SQLite commit and unlink. */
  private purgeDeletedFiles(): void {
    for (const row of this.db.prepare('SELECT relpath FROM deleted_image_files').all()) {
      const relative = row.relpath as string;
      this.deleteImage(relative);
      this.db.prepare('DELETE FROM deleted_image_files WHERE relpath = ?').run(relative);
    }
  }

  private imagePath(relative: string): string {
    if (!IMAGE_NAME.test(relative)) throw new Error('저장된 이미지 경로가 올바르지 않습니다.');
    const full = path.resolve(this.imagesRoot, relative);
    if (path.dirname(full) !== this.imagesRoot || realpathSync(this.imagesRoot) !== this.imagesRoot || (existsSync(full) && lstatSync(full).isSymbolicLink())) throw new Error('허용되지 않는 이미지 경로입니다.');
    return full;
  }

  private readImage(relative: string, maxBytes = MAX_IMAGE_BYTES): Buffer | null {
    const full = this.imagePath(relative);
    try {
      if (lstatSync(full).size > maxBytes) throw new Error('저장된 이미지가 용량 제한을 초과합니다.');
      const data = readFileSync(full);
      this.validatePng(data, maxBytes);
      return data;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new Error('저장된 이미지를 읽지 못했습니다.');
    }
  }

  private deleteImage(relative: string): void {
    const full = this.imagePath(relative);
    try { unlinkSync(full); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('이미지 파일을 삭제하지 못했습니다.');
    }
  }

  private writeImage(relative: string, data: Buffer): void {
    const finalPath = this.imagePath(relative);
    const temporary = `${finalPath}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, 'wx', 0o600);
      writeFileSync(descriptor, data);
      fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined;
      renameSync(temporary, finalPath);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }

  private validatePng(data: Buffer, maxBytes: number): void {
    if (!Buffer.isBuffer(data) || data.length < 24 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('PNG 이미지 형식이 올바르지 않습니다.');
    if (data.length > maxBytes) throw new Error('이미지 용량이 저장 제한을 초과합니다.');
  }

  private validateTimestamp(now: number): void {
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('저장 시간이 올바르지 않습니다.');
  }
}
