import type { Metal } from './types.js';

/** How much a metal's exchange price moved, in % (positive = up). */
export interface Move {
  metal: Metal;
  /** Since the previous message; missing on the first message of the day. */
  hourPct?: number;
  /** Since the first message of the day. */
  dayPct?: number;
}

/**
 * Whether an hourly message rings the phones. When false, Telegram still delivers it — it just
 * arrives without sound or vibration (`disable_notification`). The evening summary always rings.
 */
export function shouldBuzz(moves: Move[]): boolean {
  // TODO(Iliyan): 14 messages a day × 3 phones — which moves are worth a sound?
  void moves;
  return true;
}
