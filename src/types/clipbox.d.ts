import type { ClipBoxAPI } from '../../shared/contracts';

declare global {
  interface Window { clipbox?: ClipBoxAPI }
}

export {};
