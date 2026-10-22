import { createHash } from 'node:crypto';
import type { NativeImage } from 'electron';
import type { Settings } from '../shared/contracts';
import { MAX_IMAGE_BYTES, MAX_TEXT_BYTES } from './content';

interface ClipboardSource {
  readText(): string | Promise<string>;
  readImage(): NativeImage | null | Promise<NativeImage | null>;
  availableFormats(): string[] | Promise<string[]>;
}

interface MonitorOptions {
  clipboard: ClipboardSource;
  saveText(text: string): void;
  saveImage(png: Buffer, width: number, height: number, thumbnail: Buffer): void;
  onError(message: string | null): void;
}

/** No clipboard access occurs before configure() receives explicit consent. */
export class ClipboardMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private baselinePending = false;
  private fingerprint = '';
  private lastImageCheck = 0;
  private lastError: string | null = null;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private writesInProgress = 0;

  constructor(private readonly options: MonitorOptions) {}

  async configure(settings: Pick<Settings, 'onboarded' | 'collectionEnabled' | 'paused'>): Promise<void> {
    const next = settings.onboarded && settings.collectionEnabled && !settings.paused;
    if (next === this.enabled) return;
    this.stop();
    this.enabled = next;
    if (!next) return;
    // Startup/resume establishes a baseline; content copied while stopped is not collected.
    this.baselinePending = true;
    this.timer = setInterval(() => { void this.poll(); }, 400);
    this.timer.unref();
    await this.poll(true);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.enabled = false;
    this.generation++;
    this.fingerprint = '';
    this.baselinePending = false;
  }

  /** Invalidate any async read that was started before this application copied. */
  async suppressCurrent(): Promise<void> {
    if (!this.enabled) return;
    this.generation++;
    this.baselinePending = true;
    await this.poll(true);
  }

  async writeWithoutRecording(write: () => Promise<void>): Promise<void> {
    this.generation++;
    this.writesInProgress++;
    try { await write(); }
    finally {
      this.writesInProgress--;
      if (this.writesInProgress === 0) await this.suppressCurrent();
    }
  }

  private report(message: string | null): void {
    if (this.lastError === message) return;
    this.lastError = message;
    this.options.onError(message);
  }

  private async poll(forceImage = false): Promise<void> {
    if (this.pending) {
      if (!forceImage) return;
      await this.pending;
    }
    if (!this.enabled || this.writesInProgress > 0) return;
    const operation = this.readSnapshot(forceImage, this.generation);
    this.pending = operation;
    try { await operation; }
    finally { if (this.pending === operation) this.pending = null; }
  }

  private async readSnapshot(forceImage: boolean, generation: number): Promise<void> {
    const valid = () => this.enabled && this.generation === generation && this.writesInProgress === 0;
    try {
      const text = await this.options.clipboard.readText();
      if (!valid()) return;
      if (text.length > 0) {
        if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) {
          this.fingerprint = 'text:oversized';
          this.baselinePending = false;
          this.report('2MB를 넘는 텍스트는 기록하지 않습니다.');
          return;
        }
        const fingerprint = 'text:' + createHash('sha256').update(text).digest('hex');
        const changed = fingerprint !== this.fingerprint;
        if (changed && !this.baselinePending) this.options.saveText(text);
        this.fingerprint = fingerprint;
        this.baselinePending = false;
        this.report(null);
        return;
      }

      const now = Date.now();
      if (!forceImage && this.fingerprint.startsWith('image:') && now - this.lastImageCheck < 1200) return;
      const formats = await this.options.clipboard.availableFormats();
      if (!valid()) return;
      if (!formats.some(format => /image|bitmap|(^|\W)(dib|png)(\W|$)/i.test(format))) {
        this.fingerprint = '';
        this.baselinePending = false;
        this.report(null);
        return;
      }
      // Electron does not expose Windows' clipboard sequence number. Limit raw
      // image hashing to 1.2s; PNG conversion is performed only for a new image.
      this.lastImageCheck = now;
      const image = await this.options.clipboard.readImage();
      if (!valid()) return;
      if (!image || image.isEmpty()) return;
      const { width, height } = image.getSize();
      if (width > 16384 || height > 16384 || width * height > 32_000_000) {
        this.fingerprint = 'image:oversized';
        this.baselinePending = false;
        this.report('해상도가 너무 큰 이미지는 기록하지 않습니다. (최대 3,200만 화소)');
        return;
      }
      const fingerprint = 'image:' + createHash('sha256').update(`${width}:${height}:`).update(image.toBitmap()).digest('hex');
      if (fingerprint === this.fingerprint && !this.baselinePending) return;
      if (this.baselinePending) {
        this.fingerprint = fingerprint;
        this.baselinePending = false;
        this.report(null);
        return;
      }
      const png = image.toPNG();
      if (png.byteLength > MAX_IMAGE_BYTES) {
        this.fingerprint = fingerprint;
        this.report('10MB를 넘는 이미지는 기록하지 않습니다.');
        return;
      }
      const scale = Math.min(1, 240 / Math.max(width, height));
      const thumbnail = image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: 'good' }).toPNG();
      this.options.saveImage(png, width, height, thumbnail);
      this.fingerprint = fingerprint;
      this.report(null);
    } catch (error) {
      if (!valid()) return;
      // Clipboard locks and storage failures must never reveal clipboard text.
      if (error instanceof ClipboardImageTooLargeError) {
        this.fingerprint = 'image:oversized';
        this.baselinePending = false;
        this.report('10MB를 넘는 이미지는 기록하지 않습니다.');
      } else this.report('클립보드 또는 저장소에 접근하지 못했습니다. 잠시 후 다시 시도합니다.');
    }
  }
}

export class ClipboardImageTooLargeError extends Error {}
