export interface SofiaClock {
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
  weekday: string; // 'Mon' … 'Sun'
}

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Sofia',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

/** Date and time in Sofia, regardless of the runner's time zone or summer time. */
export function sofiaClock(now = new Date()): SofiaClock {
  const parts = PARTS.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: get('weekday'),
  };
}

export const isWeekend = (c: SofiaClock) => c.weekday === 'Sat' || c.weekday === 'Sun';

/** Midnight in Sofia as a Date, for "since the start of the day" chart requests. */
export function sofiaMidnight(now = new Date()): Date {
  const c = sofiaClock(now);
  const d = new Date(now.getTime() - (c.hour * 60 + c.minute) * 60_000);
  d.setUTCSeconds(0, 0);
  return d;
}

const TIME = new Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY = new Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia', weekday: 'short' });

/** "14:00" */
export const sofiaTime = (iso: string | Date) => TIME.format(new Date(iso));
/** "26.10" */
export const sofiaDay = (iso: string | Date) => DAY.format(new Date(iso)).replace(/\.$/, '');
/** "пн" */
export const sofiaWeekday = (iso: string | Date) => WEEKDAY.format(new Date(iso));
