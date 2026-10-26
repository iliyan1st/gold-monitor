import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Snapshot } from './types.js';

/** Persisted between runs (committed back to the repo by the workflow). */
export interface State {
  /** Prices of the previous message → the "от 14:00" change. */
  last?: Snapshot;
  /** First prices of the Sofia day → the change since the morning. */
  dayOpen?: Snapshot;
  /** 'YYYY-MM-DD HH' of the last slot sent, so a second trigger for the same slot sends nothing. */
  lastSlot?: string;
  /** Day (YYYY-MM-DD) the evening summary was sent. */
  summarySentOn?: string;
}

export const STATE_FILE = 'data/state.json';

export function loadState(file = STATE_FILE): State {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf-8')) as State;
}

export function saveState(state: State, file = STATE_FILE): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 1) + '\n');
}
