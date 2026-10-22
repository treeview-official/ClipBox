import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ClipRepository } from '../electron/database';
import { SettingsStore, validateSettingsPatch } from '../electron/settings';
import { classifyText } from '../electron/content';
import { DEFAULT_SETTINGS } from '../shared/contracts';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+afo0AAAAASUVORK5CYII=', 'base64');
const day = 86_400_000;

function fixture(t: { after: (fn: () => void) => void }): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'clipbox-storage-test-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('clipbox-storage-test-'));
    rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

test('text/URL and favorite persist, repeated content moves latest without losing identity', (t) => {
  const root = fixture(t);
  let repo = new ClipRepository(root);
  try {
    repo.upsertText('한국어 😀\nSecond line', 100);
    const first = repo.list().items[0]!;
    repo.toggleFavorite(first.id);
    repo.upsertText('https://example.com/a?b=1', 200);
    repo.upsertText('한국어 😀\nSecond line', 300);
    const listing = repo.list();
    assert.equal(listing.total, 2);
    assert.equal(listing.items[0]!.id, first.id);
    assert.equal(listing.items[0]!.isFavorite, true);
    assert.equal(listing.items[0]!.createdAt, 300);
    assert.equal(listing.stats.text, 1);
    assert.equal(listing.stats.link, 1);
    assert.equal(repo.get(first.id)!.contentText, '한국어 😀\nSecond line');
    repo.close();
    repo = new ClipRepository(root);
    assert.equal(repo.get(first.id)!.isFavorite, true);
    assert.equal(repo.list().stats.byteSize, Buffer.byteLength('한국어 😀\nSecond linehttps://example.com/a?b=1'));
  } finally { repo.close(); }
});

test('search is Unicode case insensitive and treats SQL wildcard/injection strings literally', (t) => {
  const repo = new ClipRepository(fixture(t));
  try {
    repo.upsertText('ÉCOLE 한국어 파일 100%_done\\path', 1);
    repo.upsertText('ecole 한국어 파일 100ZZdone/path', 2);
    repo.upsertText("literal ' OR 1=1 --", 3);
    assert.equal(repo.list({ query: 'école' }).total, 1);
    assert.equal(repo.list({ query: 'E\u0301COLE' }).total, 1);
    assert.equal(repo.list({ query: '한국어' }).total, 2);
    assert.equal(repo.list({ query: '%_' }).total, 1);
    assert.equal(repo.list({ query: '\\path' }).total, 1);
    assert.equal(repo.list({ query: "' OR 1=1 --" }).total, 1);
    assert.equal(repo.list({ query: 'missing' }).total, 0);
  } finally { repo.close(); }
});

test('pagination, sort and filters keep total and global counts distinct', (t) => {
  const repo = new ClipRepository(fixture(t));
  try {
    repo.upsertText('one', 1); repo.upsertText('two', 2); repo.upsertText('https://example.com', 3);
    const id = repo.list({ sort: 'oldest' }).items[0]!.id;
    repo.toggleFavorite(id);
    assert.deepEqual(repo.list({ limit: 1, offset: 1, sort: 'oldest' }).items.map((item) => item.previewText), ['two']);
    const filtered = repo.list({ kind: 'text', favorite: true });
    assert.equal(filtered.total, 1); assert.equal(filtered.stats.total, 3);
    assert.equal(filtered.items[0]!.id, id);
    assert.equal(repo.list({ favorite: false }).total, 2);
    assert.throws(() => repo.list({ limit: 201 }));
    assert.throws(() => repo.list({ offset: -1 }));
    assert.throws(() => repo.list({ query: 'a'.repeat(2001) }));
  } finally { repo.close(); }
});

test('retention and count limits exclude favorites and keep newest nonfavorites', (t) => {
  const repo = new ClipRepository(fixture(t));
  try {
    repo.upsertText('old favorite', day);
    const favorite = repo.list().items[0]!.id;
    repo.toggleFavorite(favorite);
    repo.upsertText('old expired', 2 * day);
    repo.upsertText('recent one', 35 * day);
    repo.upsertText('recent two', 36 * day);
    repo.upsertText('recent three', 37 * day);
    repo.cleanup(2, 30, 40 * day);
    assert.deepEqual(repo.list().items.map((item) => item.previewText), ['recent three', 'recent two', 'old favorite']);
    repo.cleanup(0, 0, 100 * day);
    assert.equal(repo.list().total, 1);
    assert.equal(repo.get(favorite)!.isFavorite, true);
    repo.remove(favorite);
    assert.equal(repo.list().total, 0);
  } finally { repo.close(); }
});

test('image storage, thumbnail, recopy, dedup and deletion clear both files', (t) => {
  const root = fixture(t);
  const repo = new ClipRepository(root);
  try {
    repo.upsertImage(png, 1, 1, png, 100);
    const item = repo.list().items[0]!;
    assert.equal(item.kind, 'image'); assert.equal(item.width, 1);
    assert.equal(item.thumbnailDataUrl, `data:image/png;base64,${png.toString('base64')}`);
    assert.deepEqual(repo.getImageBuffer(item.id), png);
    assert.equal(repo.get(item.id)!.imageDataUrl, item.thumbnailDataUrl);
    assert.equal(readdirSync(path.join(root, 'images')).length, 2);
    repo.toggleFavorite(item.id);
    repo.upsertImage(png, 1, 1, png, 200);
    assert.equal(repo.list().total, 1);
    assert.equal(repo.get(item.id)!.isFavorite, true);
    assert.equal(readdirSync(path.join(root, 'images')).length, 2);
    repo.remove(item.id);
    assert.equal(repo.getImageBuffer(item.id), null);
    assert.equal(readdirSync(path.join(root, 'images')).length, 0);
    repo.upsertImage(png, 1, 1, png, 300);
    repo.upsertText('also clear this', 400);
    repo.clear();
    assert.equal(repo.list().total, 0);
    assert.equal(readdirSync(path.join(root, 'images')).length, 0);
  } finally { repo.close(); }
});

test('expired images are removed, invalid and oversized inputs never create files', (t) => {
  const root = fixture(t);
  const repo = new ClipRepository(root);
  try {
    assert.throws(() => repo.upsertImage(Buffer.from('not png'), 1, 1));
    assert.throws(() => repo.upsertImage(png, 2, 1));
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    png.copy(oversized);
    assert.throws(() => repo.upsertImage(oversized, 1, 1));
    assert.throws(() => repo.upsertText('x'.repeat(2 * 1024 * 1024 + 1)));
    repo.upsertText(' \n\t ');
    assert.equal(repo.list().total, 0);
    assert.deepEqual(readdirSync(path.join(root, 'images')), []);
    repo.upsertImage(png, 1, 1, png, day);
    repo.cleanup(100, 7, 10 * day);
    assert.equal(repo.list().total, 0);
    assert.deepEqual(readdirSync(path.join(root, 'images')), []);
  } finally { repo.close(); }
});

test('a tampered image path cannot read or delete files outside the image root', (t) => {
  const root = fixture(t);
  let repo = new ClipRepository(root);
  let id: string;
  try {
    repo.upsertImage(png, 1, 1);
    id = repo.list().items[0]!.id;
  } finally { repo.close(); }
  const outside = path.join(root, 'private.png');
  writeFileSync(outside, 'private sentinel');
  const db = new DatabaseSync(path.join(root, 'clipbox.sqlite'));
  db.prepare('UPDATE clipboard_items SET image_relpath = ? WHERE id = ?').run('../private.png', id);
  db.close();
  repo = new ClipRepository(root);
  try {
    assert.throws(() => repo.getImageBuffer(id), /경로/);
    assert.throws(() => repo.remove(id), /경로/);
    assert.equal(readFileSync(outside, 'utf8'), 'private sentinel');
  } finally { repo.close(); }
});

test('committed image deletion jobs are retried after restart', (t) => {
  const root = fixture(t);
  let repo = new ClipRepository(root);
  repo.upsertImage(png, 1, 1, png);
  repo.close();
  const db = new DatabaseSync(path.join(root, 'clipbox.sqlite'));
  db.exec(`BEGIN; INSERT INTO deleted_image_files SELECT image_relpath FROM clipboard_items;
    INSERT INTO deleted_image_files SELECT thumbnail_relpath FROM clipboard_items;
    DELETE FROM clipboard_items; COMMIT;`);
  db.close();
  assert.equal(readdirSync(path.join(root, 'images')).length, 2);
  repo = new ClipRepository(root);
  try {
    assert.equal(repo.list().total, 0);
    assert.equal(readdirSync(path.join(root, 'images')).length, 0);
  } finally { repo.close(); }
});

test('missing images return no image while corrupted or oversized disk files are rejected', (t) => {
  const root = fixture(t);
  const repo = new ClipRepository(root);
  try {
    repo.upsertImage(png, 1, 1);
    const id = repo.list().items[0]!.id;
    const imageFile = path.join(root, 'images', `${id}.png`);
    writeFileSync(imageFile, 'corrupted file');
    assert.throws(() => repo.getImageBuffer(id), /읽지 못/);
    writeFileSync(imageFile, Buffer.alloc(10 * 1024 * 1024 + 1));
    assert.throws(() => repo.getImageBuffer(id), /읽지 못/);
    rmSync(imageFile);
    assert.equal(repo.getImageBuffer(id), null);
    assert.equal(repo.get(id)!.imageDataUrl, undefined);
  } finally { repo.close(); }
});

test('schema v1 migration keeps records, favorites and Unicode search', (t) => {
  const root = fixture(t);
  const db = new DatabaseSync(path.join(root, 'clipbox.sqlite'));
  db.exec(`CREATE TABLE clipboard_items (
    id TEXT PRIMARY KEY, kind TEXT, content_text TEXT, image_relpath TEXT,
    content_hash TEXT UNIQUE, preview_text TEXT, mime_type TEXT, byte_size INTEGER,
    image_width INTEGER, image_height INTEGER, is_favorite INTEGER, created_at INTEGER,
    last_copied_at INTEGER); PRAGMA user_version=1;`);
  db.prepare(`INSERT INTO clipboard_items (id,kind,content_text,content_hash,preview_text,byte_size,is_favorite,created_at)
    VALUES ('legacy','text','ÉCOLE','legacy-hash','ÉCOLE',6,1,1)`).run();
  db.close();
  const repo = new ClipRepository(root);
  try {
    assert.equal(repo.list({ query: 'école' }).total, 1);
    assert.equal(repo.get('legacy')!.isFavorite, true);
  } finally { repo.close(); }
  const verification = new DatabaseSync(path.join(root, 'clipbox.sqlite'));
  assert.equal(verification.prepare('PRAGMA user_version').get()!.user_version, 2);
  verification.close();
});

test('future schemas and damaged databases are rejected without replacement', (t) => {
  const root = fixture(t);
  const databaseFile = path.join(root, 'clipbox.sqlite');
  writeFileSync(databaseFile, 'not a database');
  assert.throws(() => new ClipRepository(root));
  assert.equal(readFileSync(databaseFile, 'utf8'), 'not a database');
  rmSync(databaseFile);
  const db = new DatabaseSync(databaseFile);
  db.exec('PRAGMA user_version=999'); db.close();
  assert.throws(() => new ClipRepository(root), /새로운/);
  const check = new DatabaseSync(databaseFile);
  assert.equal(check.prepare('PRAGMA user_version').get()!.user_version, 999); check.close();
});

test('settings use safe defaults, survive reload and return detached snapshots', (t) => {
  const root = fixture(t);
  const store = new SettingsStore(root);
  assert.deepEqual(store.get(), DEFAULT_SETTINGS);
  store.update({ onboarded: true, collectionEnabled: true, theme: 'dark', hotkey: 'Ctrl+Alt+K', maxItems: 500 });
  const copy = store.get(); copy.paused = true;
  assert.equal(store.get().paused, false);
  const reload = new SettingsStore(root);
  assert.equal(reload.get().theme, 'dark');
  assert.equal(reload.get().onboarded, true);
  assert.equal(reload.get().hotkey, 'Ctrl+Alt+K');
  assert.equal(readdirSync(root).filter((name) => name.endsWith('.tmp')).length, 0);
});

test('settings validation rejects unexpected keys, bad values and bare shortcuts', () => {
  for (const invalid of [null, [], { maxItems: 1001 }, { maxItems: '100' }, { retentionDays: -1 },
    { theme: 'pink' }, { paused: 1 }, { hotkey: 'V' }, { hotkey: 'Shift+V' }, { hotkey: 'Ctrl+Ctrl+V' }, { unknown: true }, { hotkey: 'Ctrl+V; shutdown' }]) {
    assert.throws(() => validateSettingsPatch(invalid));
  }
  assert.deepEqual(validateSettingsPatch({ hotkey: 'CommandOrControl+Shift+V', retentionDays: 0 }), { hotkey: 'CommandOrControl+Shift+V', retentionDays: 0 });
});

test('corrupt settings stay untouched; a failed atomic save leaves in-memory settings unchanged', (t) => {
  const root = fixture(t);
  const file = path.join(root, 'settings.json');
  writeFileSync(file, '{broken');
  assert.throws(() => new SettingsStore(root), /보존/);
  assert.equal(readFileSync(file, 'utf8'), '{broken');
  rmSync(file);
  const store = new SettingsStore(root);
  mkdirSync(file);
  assert.throws(() => store.update({ paused: true }), /저장/);
  assert.equal(store.get().paused, false);
  assert.equal(existsSync(file), true);
  assert.equal(readdirSync(root).filter((name) => name.endsWith('.tmp')).length, 0);
});

test('links are whole valid HTTP(S) URLs and all original text remains unmodified', () => {
  assert.equal(classifyText(' HTTPS://example.com/a?q=한국어 '), 'link');
  assert.equal(classifyText('visit https://example.com'), 'text');
  assert.equal(classifyText('https://example.com extra'), 'text');
  assert.equal(classifyText('javascript:alert(1)'), 'text');
  assert.equal(classifyText('https://'), 'text');
});

test('POSIX app directories and persisted files are private without changing ancestors', {
  skip: process.platform === 'win32' ? 'POSIX permission bits require native Linux/macOS CI; Windows uses profile ACLs.' : false,
}, (t) => {
  const parent = fixture(t);
  chmodSync(parent, 0o755);
  const root = path.join(parent, 'app-data');
  mkdirSync(root, { mode: 0o777 }); chmodSync(root, 0o777);
  const images = path.join(root, 'images');
  mkdirSync(images, { mode: 0o777 }); chmodSync(images, 0o777);
  const settingsFile = path.join(root, 'settings.json');
  writeFileSync(settingsFile, JSON.stringify(DEFAULT_SETTINGS)); chmodSync(settingsFile, 0o666);
  const databaseFile = path.join(root, 'clipbox.sqlite');
  const legacyConnection = new DatabaseSync(databaseFile);
  let repo: ClipRepository | undefined;
  try {
    legacyConnection.exec('PRAGMA journal_mode=WAL; CREATE TABLE legacy_marker(value INTEGER)');
    for (const filename of [databaseFile, `${databaseFile}-wal`, `${databaseFile}-shm`]) chmodSync(filename, 0o666);
    const settings = new SettingsStore(root);
    repo = new ClipRepository(root);
    repo.upsertText('private history'); repo.upsertImage(png, 1, 1, png);
    settings.update({ theme: 'dark' });
    assert.equal(statSync(parent).mode & 0o777, 0o755);
    assert.equal(statSync(root).mode & 0o777, 0o700);
    assert.equal(statSync(images).mode & 0o777, 0o700);
    for (const filename of [databaseFile, `${databaseFile}-wal`, `${databaseFile}-shm`, settingsFile,
      ...readdirSync(images).map((name) => path.join(images, name))]) {
      assert.equal(statSync(filename).mode & 0o777, 0o600, path.basename(filename));
    }
  } finally { repo?.close(); legacyConnection.close(); }
});

test('linked image folders are rejected without touching their targets', (t) => {
  const parent = fixture(t);
  const root = path.join(parent, 'app-data');
  const outside = path.join(parent, 'outside');
  mkdirSync(root); mkdirSync(outside);
  writeFileSync(path.join(outside, 'sentinel.txt'), 'untouched');
  const modeBefore = statSync(outside).mode;
  symlinkSync(outside, path.join(root, 'images'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => new ClipRepository(root), /연결된 경로/);
  assert.equal(readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'untouched');
  assert.equal(statSync(outside).mode, modeBefore);
});

test('POSIX linked database/settings files are not followed or chmodded', {
  skip: process.platform === 'win32' ? 'POSIX file symlinks require Linux/macOS CI; Windows developer-mode privilege is not assumed.' : false,
}, (t) => {
  const parent = fixture(t);
  const root = path.join(parent, 'app-data');
  mkdirSync(root);
  const outside = path.join(parent, 'outside.txt');
  writeFileSync(outside, 'untouched'); chmodSync(outside, 0o644);
  symlinkSync(outside, path.join(root, 'clipbox.sqlite'));
  assert.throws(() => new ClipRepository(root), /연결된 파일/);
  symlinkSync(outside, path.join(root, 'settings.json'));
  assert.throws(() => new SettingsStore(root), /보존/);
  assert.equal(readFileSync(outside, 'utf8'), 'untouched');
  assert.equal(statSync(outside).mode & 0o777, 0o644);
});
