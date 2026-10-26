import { describe, expect, it } from 'vitest';
import { chartConfig, MAX_POINTS, periodFor, thin, toSeries } from '../src/chart.js';
import { commandArg } from '../src/commands.js';
import type { Candle } from '../src/types.js';

const candle = (start: string, close: number): Candle => ({ open: close, high: close, low: close, close, start, end: start });

describe('periodFor', () => {
  it.each([
    ['chart', '', 'month'],
    ['chart', '6м', 'months6'],
    ['chart', '7д', 'week'],
    ['chart', 'година', 'year'],
    ['chart_7d', '', 'week'],
    ['chart_6m', '', 'months6'],
    ['chart_1y', '', 'year'],
    ['gold', '', undefined],
  ])('/%s %s → %s', (cmd, arg, expected) => expect(periodFor(cmd, arg)).toBe(expected));

  it('reads the argument after the command', () => {
    expect(commandArg('/chart 6м')).toBe('6м');
    expect(commandArg('/chart@GoldBulgariaMonitorBot   1г ')).toBe('1г');
    expect(commandArg('/chart')).toBe('');
  });
});

describe('thin', () => {
  it('a year of daily points fits QuickChart, keeping the first and the latest', () => {
    const times = Array.from({ length: 313 }, (_, i) => `t${String(i).padStart(3, '0')}`);
    const kept = thin(times);
    expect(kept.length).toBeLessThanOrEqual(MAX_POINTS);
    expect(kept[0]).toBe('t000');
    expect(kept.at(-1)).toBe('t312');
  });

  it('short periods untouched', () => {
    expect(thin(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('toSeries + chartConfig', () => {
  const series = toSeries({
    XAU: [candle('2026-10-01T00:00:00Z', 100), candle('2026-10-02T00:00:00Z', 102), candle('2026-10-03T00:00:00Z', 101)],
    XAG: [candle('2026-10-01T00:00:00Z', 50), candle('2026-10-03T00:00:00Z', 45)],
  });

  it('% change from the first close; metals without data are left out', () => {
    expect(series.map((s) => s.metal)).toEqual(['XAU', 'XAG']);
    expect(series[0].change).toBeCloseTo(1);
    expect(series[1].change).toBeCloseTo(-10);
  });

  it('one shared x axis; a missing candle is a gap, not a shifted line', () => {
    const config = chartConfig(series, 'month') as {
      data: { labels: string[]; datasets: { label: string; data: (number | null)[] }[] };
    };
    expect(config.data.labels).toEqual(['01.10', '02.10', '03.10']);
    expect(config.data.datasets[0].label).toBe('Злато +1,00%');
    expect(config.data.datasets[1].data).toEqual([0, null, -10]);
  });
});
