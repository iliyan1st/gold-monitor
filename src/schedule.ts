import { isWeekend, type SofiaClock } from './clock.js';
import type { State } from './state.js';

/** Hourly messages 08:00–21:00 on weekdays; the 22:00 run sends the summary instead, every day. */
export const FIRST_HOUR = 8;
export const SUMMARY_HOUR = 22;

export type Mode = 'hourly' | 'summary' | 'none';

export const hourKey = (c: SofiaClock) => `${c.date} ${String(c.hour).padStart(2, '0')}`;

/**
 * What this run should send. Triggers can arrive late, twice (cron-job.org + GitHub's backup
 * schedule) or outside the hours, so the decision rests on Sofia time and what was already sent.
 */
export function modeFor(clock: SofiaClock, state: State): Mode {
  if (clock.hour >= SUMMARY_HOUR) return state.summarySentOn === clock.date ? 'none' : 'summary';
  if (clock.hour < FIRST_HOUR || isWeekend(clock)) return 'none';
  return state.lastHourly === hourKey(clock) ? 'none' : 'hourly';
}
