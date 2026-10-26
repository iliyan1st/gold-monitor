import { sofiaMidnight } from './clock.js';
import { tavexCandles } from './sources/tavex.js';
import { METALS, type Candle, type Metal } from './types.js';
import { METAL_NAMES } from './format.js';

export interface MetalDay {
  open: number;
  high: number;
  low: number;
}

/** What the evening summary adds on top of the current prices. */
export interface MarketDay {
  /** Since midnight Sofia time; missing when the exchange was closed (weekends). */
  day: Partial<Record<Metal, MetalDay>>;
  /** Spot price 7 days ago. */
  weekAgo: Partial<Record<Metal, number>>;
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

/** Close of the last candle that started at or before `at`. */
export function closeAt(candles: Candle[], at: Date): number | undefined {
  const before = candles.filter((c) => Date.parse(c.start) <= at.getTime());
  return before.at(-1)?.close;
}

const DAY_MS = 86_400_000;

export async function marketDay(now = new Date()): Promise<MarketDay> {
  const out: MarketDay = { day: {}, weekAgo: {}, errors: [] };
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  await Promise.all(
    METALS.map(async (metal) => {
      try {
        const [today, week] = await Promise.all([
          tavexCandles(metal, sofiaMidnight(now), now, 'PT5M'),
          tavexCandles(metal, new Date(weekAgo.getTime() - DAY_MS), now, 'PT6H'),
        ]);
        out.day[metal] = dayStats(today);
        out.weekAgo[metal] = closeAt(week, weekAgo);
      } catch (err) {
        console.error(`Tavex chart ${metal}:`, err instanceof Error ? err.message : err);
        out.errors.push(`графика: ${METAL_NAMES[metal]}`);
      }
    }),
  );
  return out;
}
