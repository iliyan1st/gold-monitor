import { signedPct, METAL_NAMES } from './format.js';
import { tavexCandles, type ChartInterval } from './sources/tavex.js';
import { METALS, type Candle, type Metal } from './types.js';

export type ChartPeriod = 'week' | 'month' | 'months6' | 'year';

interface PeriodSpec {
  label: string;
  days: number;
  interval: ChartInterval;
  /** Telegram command that draws it — separate commands, so they're tappable in a caption. */
  command: string;
}

export const CHART_PERIODS: Record<ChartPeriod, PeriodSpec> = {
  week: { label: '7 дни', days: 7, interval: 'PT1H', command: 'chart_7d' },
  month: { label: '1 месец', days: 30, interval: 'PT6H', command: 'chart' },
  months6: { label: '6 месеца', days: 182, interval: 'P1D', command: 'chart_6m' },
  year: { label: '1 година', days: 365, interval: 'P1D', command: 'chart_1y' },
};

/** "/chart_6m", or "/chart 6м" typed by hand → the period; undefined if it isn't a chart command. */
export function periodFor(cmd: string, arg = ''): ChartPeriod | undefined {
  const byCommand = (Object.keys(CHART_PERIODS) as ChartPeriod[]).find((p) => CHART_PERIODS[p].command === cmd);
  if (cmd !== 'chart') return byCommand;
  const a = arg.trim().toLowerCase().replace(/\s+/g, '');
  if (['7', '7д', 'седмица', '1с'].includes(a)) return 'week';
  if (['6', '6м', '6месеца'].includes(a)) return 'months6';
  if (['1г', 'г', 'година', '12', '12м'].includes(a)) return 'year';
  return 'month';
}

/** % change from the first close of the period, per candle start time. */
export interface Series {
  metal: Metal;
  points: Map<string, number>;
  change: number;
}

export function toSeries(candles: Partial<Record<Metal, Candle[]>>): Series[] {
  return METALS.flatMap((metal) => {
    const cs = candles[metal] ?? [];
    if (!cs.length) return [];
    const base = cs[0].close;
    const points = new Map(cs.map((c) => [c.start, ((c.close - base) / base) * 100]));
    return [{ metal, points, change: ((cs.at(-1)!.close - base) / base) * 100 }];
  });
}

const COLORS: Record<Metal, string> = { XAU: '#C9A227', XAG: '#7A8794', XPT: '#3D6FB6' };

const DAY = new Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit' });
const MONTH = new Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia', month: '2-digit', year: '2-digit' });

/** QuickChart's free tier refuses lines with more than ~300 points ("Maximum chart data exceeded"). */
export const MAX_POINTS = 200;

/** Every n-th time so at most MAX_POINTS remain; the latest one is always kept. */
export function thin(times: string[]): string[] {
  const step = Math.ceil(times.length / MAX_POINTS);
  return step <= 1 ? times : times.filter((_, i) => i % step === 0 || i === times.length - 1);
}

/** Chart.js config: the three metals on one axis, each as % change since the start. */
export function chartConfig(series: Series[], period: ChartPeriod): object {
  // One x axis for all: the union of candle times; a metal missing a candle leaves a gap.
  const times = thin([...new Set(series.flatMap((s) => [...s.points.keys()]))].sort());
  const fmt = period === 'year' ? MONTH : DAY;
  return {
    type: 'line',
    data: {
      labels: times.map((t) => fmt.format(new Date(t)).replace(/\s*г\.$/, '').replace(/\.$/, '')),
      datasets: series.map((s) => ({
        label: `${METAL_NAMES[s.metal]} ${signedPct(100, 100 + s.change)}`,
        data: times.map((t) => s.points.get(t) ?? null),
        borderColor: COLORS[s.metal],
        backgroundColor: COLORS[s.metal],
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2,
        spanGaps: true,
      })),
    },
    options: {
      plugins: {
        title: { display: true, text: `Промяна в % за ${CHART_PERIODS[period].label} (борса, €)`, font: { size: 18 } },
        legend: { position: 'bottom', labels: { font: { size: 15 } } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, maxRotation: 0 } },
        y: { title: { display: true, text: '%' } },
      },
    },
  };
}

/** Renders the chart as PNG through QuickChart (free, no key; the data is public prices). */
async function render(config: object): Promise<Blob> {
  const res = await fetch('https://quickchart.io/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: '4', backgroundColor: 'white', width: 900, height: 500, format: 'png', chart: config }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`QuickChart ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.blob();
}

export async function buildChart(period: ChartPeriod, now = new Date()): Promise<{ png: Blob; caption: string }> {
  const spec = CHART_PERIODS[period];
  const from = new Date(now.getTime() - spec.days * 86_400_000);
  const candles: Partial<Record<Metal, Candle[]>> = {};
  await Promise.all(METALS.map(async (m) => void (candles[m] = await tavexCandles(m, from, now, spec.interval))));
  const series = toSeries(candles);
  if (!series.length) throw new Error(`no chart data for ${period}`);
  const others = (Object.keys(CHART_PERIODS) as ChartPeriod[])
    .filter((p) => p !== period)
    .map((p) => `/${CHART_PERIODS[p].command} ${CHART_PERIODS[p].label}`);
  const changes = series.map((s) => `${METAL_NAMES[s.metal]} ${signedPct(100, 100 + s.change)}`).join(' · ');
  return {
    png: await render(chartConfig(series, period)),
    caption: `📈 ${spec.label}: ${changes}\n${others.join(' · ')}`,
  };
}
