import { isWeekend, type SofiaClock } from './clock.js';
import type { State } from './state.js';

/** Price updates at 10:00, 14:00 and 18:00 on weekdays; the summary at 22:00 every day. */
export const SLOTS = [10, 14, 18];
export const SUMMARY_HOUR = 22;
/** GitHub's backup schedule runs an hour late in summer time, so a slot stays open for 2 hours. */
const SLOT_HOURS = 2;

export type Mode = 'update' | 'summary' | 'none';

export const slotKey = (date: string, slot: number) => `${date} ${String(slot).padStart(2, '0')}`;

/** The slot this hour belongs to, if any. */
export function slotFor(clock: SofiaClock): number | undefined {
  return SLOTS.findLast((s) => clock.hour >= s && clock.hour < s + SLOT_HOURS);
}

/**
 * What this run should send. Triggers can arrive late, twice (cron-job.org + GitHub's backup
 * schedule) or outside the slots, so the decision rests on Sofia time and what was already sent.
 */
export function modeFor(clock: SofiaClock, state: State): Mode {
  if (clock.hour >= SUMMARY_HOUR) return state.summarySentOn === clock.date ? 'none' : 'summary';
  const slot = slotFor(clock);
  if (slot === undefined || isWeekend(clock)) return 'none';
  return state.lastSlot === slotKey(clock.date, slot) ? 'none' : 'update';
}
