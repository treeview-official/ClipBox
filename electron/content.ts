import { createHash } from 'node:crypto';
import type { ClipboardKind } from '../shared/contracts';

export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function contentHash(kind: ClipboardKind, value: string | Buffer): string {
  return createHash('sha256').update(kind).update('\0').update(value).digest('hex');
}

export function classifyText(text: string): 'text' | 'link' {
  const trimmed = text.trim();
  if (!/^https?:\/\//i.test(trimmed) || /\s/.test(trimmed)) return 'text';
  try {
    const url = new URL(trimmed);
    return url.hostname && ['http:', 'https:'].includes(url.protocol) ? 'link' : 'text';
  } catch { return 'text'; }
}

export function makePreviewText(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, 180).join('');
}

/** Normalize both operands in JS: SQLite's built-in NOCASE handles ASCII only. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFC').toLowerCase();
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
