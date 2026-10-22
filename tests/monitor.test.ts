import test from 'node:test';
import assert from 'node:assert/strict';
import type { NativeImage } from 'electron';
import { ClipboardMonitor } from '../electron/clipboard-monitor';

function fixture() {
  let text = 'before consent'; let locked = false; let reads = 0; let image: NativeImage | null = null;
  const saved: string[] = []; const images: Buffer[] = []; const errors: (string | null)[] = [];
  const monitor = new ClipboardMonitor({
    clipboard: {
      readText() { reads++; if (locked) throw Error('private text must not leak'); return text; },
      availableFormats: () => image ? ['image/png'] : [],
      readImage: () => image!,
    },
    saveText: value => { saved.push(value); },
    saveImage: value => { images.push(value); },
    onError: value => { errors.push(value); },
  });
  const poll = () => (monitor as unknown as { poll(force: boolean): Promise<void> }).poll(true);
  return { monitor, saved, images, errors, poll, setText: (value: string) => { text = value; image = null; }, setLocked: (value: boolean) => { locked = value; }, reads: () => reads,
    setImage: (value: string) => { text = ''; image = { isEmpty: () => false, getSize: () => ({width: 8, height: 8}), toBitmap: () => Buffer.from(value), toPNG: () => Buffer.from(value), resize() { return this; } } as unknown as NativeImage; } };
}
const enabled = { onboarded: true, collectionEnabled: true, paused: false };

test('consent gate does not access clipboard and enabling skips existing content', async () => {
  const f = fixture();
  try {
    await f.monitor.configure({ ...enabled, onboarded: false }); await f.poll();
    assert.equal(f.reads(), 0);
    await f.monitor.configure(enabled); await f.poll(); assert.deepEqual(f.saved, []);
    f.setText('한글 🌿\n새 기록'); await f.poll(); await f.poll();
    assert.deepEqual(f.saved, ['한글 🌿\n새 기록']);
  } finally { f.monitor.stop(); }
});
test('pause/resume does not collect content copied during pause', async () => {
  const f = fixture();
  try {
    await f.monitor.configure(enabled); f.setText('first'); await f.poll();
    await f.monitor.configure({ ...enabled, paused: true });
    const reads = f.reads(); f.setText('while paused'); await f.poll(); assert.equal(f.reads(), reads);
    await f.monitor.configure(enabled); await f.poll(); f.setText('after resume'); await f.poll();
    assert.deepEqual(f.saved, ['first', 'after resume']);
  } finally { f.monitor.stop(); }
});
test('self recopy suppression and changed image deduplication', async () => {
  const f = fixture();
  try {
    await f.monitor.configure(enabled); f.setText('app recopy'); await f.monitor.suppressCurrent(); await f.poll();
    assert.equal(f.saved.length, 0);
    f.setImage('image-one'); await f.poll(); await f.poll();
    f.setImage('image-two'); await f.poll();
    assert.deepEqual(f.images.map(b => b.toString()), ['image-one', 'image-two']);
  } finally { f.monitor.stop(); }
});
test('locked clipboard retries safely without logging its content', async () => {
  const f = fixture();
  try {
    await f.monitor.configure(enabled); f.setLocked(true); await f.poll(); await f.poll();
    assert.equal(f.errors.length, 1);
    assert.ok(!f.errors.join('').includes('private'));
    f.setLocked(false); f.setText('recovered'); await f.poll();
    assert.deepEqual(f.saved, ['recovered']); assert.equal(f.errors.at(-1), null);
  } finally { f.monitor.stop(); }
});
test('oversized text is skipped and following normal text is accepted', async () => {
  const f = fixture();
  try {
    await f.monitor.configure(enabled); f.setText('x'.repeat(2 * 1024 * 1024 + 1)); await f.poll();
    assert.equal(f.saved.length, 0); assert.match(f.errors.at(-1)!, /2MB/);
    f.setText('normal'); await f.poll(); assert.deepEqual(f.saved, ['normal']);
  } finally { f.monitor.stop(); }
});

test('a clipboard read already in flight cannot persist after collection is paused', async () => {
  let resolveRead: ((value: string) => void) | null = null;
  let defer = false;
  const saved: string[] = [];
  const monitor = new ClipboardMonitor({
    clipboard: {
      readText: () => defer ? new Promise<string>(resolve => { resolveRead = resolve; }) : Promise.resolve('baseline'),
      availableFormats: () => [], readImage: () => null,
    },
    saveText: text => { saved.push(text); }, saveImage: () => {}, onError: () => {},
  });
  try {
    await monitor.configure(enabled);
    defer = true;
    const pending = (monitor as unknown as { poll(force: boolean): Promise<void> }).poll(true);
    await monitor.configure({ ...enabled, paused: true });
    assert.ok(resolveRead);
    (resolveRead as (value: string) => void)('private copy after pause');
    await pending;
    assert.deepEqual(saved, []);
  } finally { monitor.stop(); }
});

test('async application clipboard writes suppress stale reads and their own content', async () => {
  let text = 'baseline';
  let resolveRead: ((value: string) => void) | null = null;
  let deferNext = false;
  const saved: string[] = [];
  const monitor = new ClipboardMonitor({
    clipboard: {
      readText: () => {
        if (deferNext) { deferNext = false; return new Promise<string>(resolve => { resolveRead = resolve; }); }
        return Promise.resolve(text);
      },
      availableFormats: () => [], readImage: () => null,
    },
    saveText: value => { saved.push(value); }, saveImage: () => {}, onError: () => {},
  });
  const poll = () => (monitor as unknown as { poll(force: boolean): Promise<void> }).poll(true);
  try {
    await monitor.configure(enabled);
    deferNext = true;
    const stale = poll();
    const writing = monitor.writeWithoutRecording(async () => { text = 'self copied'; });
    assert.ok(resolveRead);
    (resolveRead as (value: string) => void)('stale result');
    await Promise.all([stale, writing]);
    await poll();
    assert.deepEqual(saved, []);
    text = 'new external copy'; await poll();
    assert.deepEqual(saved, ['new external copy']);
  } finally { monitor.stop(); }
});
