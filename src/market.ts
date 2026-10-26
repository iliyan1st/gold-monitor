import { sofiaMidnight } from './clock.js';
import { tavexCandles } from './sources/tavex.js';
import { METALS, type Candle, type Metal } from './types.js';
import { METAL_NAMES } from './format.js';

export interface MetalDay {
  open: number;
  high: number;
  low: number;
}

export type Period = 'day' | 'week' | 'month' | 'months6' | 'year';

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'ден' },
  { key: 'week', label: 'седмица' },
  { key: 'month', label: 'месец' },
  { key: 'months6', label: '6 месеца' },
  { key: 'year', label: 'година' },
];

export interface MetalHistory {
  /** Since midnight Sofia; missing when the exchange was closed (weekends). */
  day?: MetalDay;
  /** Spot price at the start of each period: today's open, then the close that long ago. */
  ref: Partial<Record<Period, number>>;
}

export interface Market {
  metals: Partial<Record<Metal, MetalHistory>>;
  errors: string[];
}

export function dayStats(candles: Candle[]): MetalDay | undefined {
  if (!candles.length) return undefined;
  return {
    open: candles[0].open,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
  };
}

/** Close of the last candle that ended at or before `at`. */
export function closeAt(candles: Candle[], at: Date): number | undefined {
  const before = candles.filter((c) => Date.parse(c.end) <= at.getTime());
  return before.at(-1)?.close;
}

const DAY_MS = 86_400_000;

export function monthsBack(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() - months);
  return out;
}

/** Tavex's charts: today's range plus the price a week, a month, 6 months and a year ago. */
export async function fetchMarket(now = new Date()): Promise<Market> {
  const out: Market = { metals: {}, errors: [] };
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const yearAgo = monthsBack(now, 12);
  await Promise.all(
    METALS.map(async (metal) => {
      try {
        // 6-hour candles for the week (±6 h), daily ones for the longer periods (±1 day).
        const [today, week, daily] = await Promise.all([
          tavexCandles(metal, sofiaMidnight(now), now, 'PT5M'),
          tavexCandles(metal, new Date(weekAgo.getTime() - DAY_MS), now, 'PT6H'),
          tavexCandles(metal, new Date(yearAgo.getTime() - 7 * DAY_MS), now, 'P1D'),
        ]);
        const day = dayStats(today);
        out.metals[metal] = {
          day,
          ref: {
            day: day?.open,
            week: closeAt(week, weekAgo),
            month: closeAt(daily, monthsBack(now, 1)),
            months6: closeAt(daily, monthsBack(now, 6)),
            year: closeAt(daily, yearAgo),
          },
        };
      } catch (err) {
        console.error(`Tavex chart ${metal}:`, err instanceof Error ? err.message : err);
        out.errors.push(`графика: ${METAL_NAMES[metal]}`);
      }
    }),
  );
  return out;
}
