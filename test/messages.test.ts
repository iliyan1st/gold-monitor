import { describe, expect, it } from 'vitest';
import { sofiaClock } from '../src/clock.js';
import { command } from '../src/commands.js';
import { signedPct, summaryText, updateText } from '../src/format.js';
import type { Market } from '../src/market.js';
import { modeFor } from '../src/schedule.js';
import type { Snapshot } from '../src/types.js';

const snap = (at: string, gold: number, subscriptionSell: number, extra: Partial<Snapshot> = {}): Snapshot => ({
  at,
  date: sofiaClock(new Date(at)).date,
  spot: { XAU: { mid: gold, source: 'tavex' }, XAG: { mid: 48.18, source: 'tavex' }, XPT: { mid: 1367.93, source: 'tavex' } },
  products: {
    'tavex-gold-1g-subscription': { sell: subscriptionSell, buy: 119 },
    'tavex-gold-0.25g': { sell: null, buy: 33 },
  },
  errors: [],
  ...extra,
});

const market: Market = {
  metals: {
    XAU: {
      day: { open: 3565.35, high: 3595, low: 3560.1 },
      ref: { day: 3565.35, week: 3726.95, month: 3800, months6: 3000, year: 2700 },
    },
  },
  errors: [],
};

/** The <pre> table's row starting with `label`, cells split on runs of spaces. */
const tableRow = (text: string, label: string) => {
  const line = text
    .split('\n')
    .map((l) => l.replace('<pre>', '').replace('</pre>', ''))
    .find((l) => l.startsWith(label));
  return line?.slice(8).trim().split(/\s+/);
};

describe('signedPct', () => {
  it('signs and rounds to 2 decimals', () => {
    expect(signedPct(100, 100.25)).toBe('+0,25%');
    expect(signedPct(100, 98.9)).toBe('−1,10%');
    expect(signedPct(100, 100.001)).toBe('0,00%');
    expect(signedPct(undefined, 100)).toBe('—');
  });
});

describe('price update', () => {
  // 12:00 and 16:00 UTC = 14:00 and 18:00 in Sofia (winter time).
  const noon = snap('2026-10-26T12:00:00Z', 3580, 131);
  const now = snap('2026-10-26T16:00:00Z', 3588.65, 132);
  const text = updateText(now, market, noon);

  it('table: price per oz and per gram for each metal', () => {
    expect(text).toContain('🕐 <b>18:00</b>');
    expect(tableRow(text, ' ')).toEqual(['Злато', 'Сребро', 'Платина']);
    expect(tableRow(text, '€/oz')).toEqual(['3588,65', '48,18', '1367,93']);
    expect(tableRow(text, '€/г')).toEqual(['115,38', '1,55', '43,98']);
  });

  it('table: change since the previous message, day, week, month, 6 months, year', () => {
    expect(tableRow(text, 'от 14:00')).toEqual(['+0,24%', '0,00%', '0,00%']);
    expect(tableRow(text, 'ден')).toEqual(['+0,65%', '—', '—']);
    expect(tableRow(text, 'седмица')).toEqual(['−3,71%', '—', '—']);
    expect(tableRow(text, 'месец')).toEqual(['−5,56%', '—', '—']);
    expect(tableRow(text, '6 месеца')).toEqual(['+19,62%', '—', '—']);
    expect(tableRow(text, 'година')).toEqual(['+32,91%', '—', '—']);
  });

  it('table fits a phone: every row 35 characters', () => {
    const rows = text.slice(text.indexOf('<pre>') + 5, text.indexOf('</pre>')).split('\n');
    for (const r of rows) expect(r.length).toBe(35);
  });

  it('dealer prices with the change, "—" where the site shows none', () => {
    expect(text).toContain('<b>Tavex</b> · продава / изкупува, € · промяна от 14:00');
    expect(text).toContain('1 г абонаментно кюлче Tavex</a>: 132,00 (🔺 +1,00) / 119,00');
    expect(text).toContain('0,25 г кюлче Tavex</a>: — / 33,00');
    expect(text).not.toContain('TopGold');
  });

  it('first message of the day: compared with the last one, labelled by date', () => {
    const lastNight = snap('2026-10-23T20:00:00Z', 3560, 131);
    expect(tableRow(updateText(noon, market, lastNight), 'от 23.10')).toEqual(['+0,56%', '0,00%', '0,00%']);
  });

  it('lists failed sources and the fallback', () => {
    const failed = updateText(
      snap('2026-10-26T12:00:00Z', 3588, 132, { spot: { XAU: { mid: 3588, source: 'gold-api' } }, errors: ['TopGold'] }),
      { metals: {}, errors: ['графика: Злато'] },
      undefined,
    );
    expect(tableRow(failed, '€/oz')).toEqual(['3588,00', '—', '—']);
    expect(failed).toContain('gold-api.com');
    expect(failed).toContain('⚠️ Не отговориха: TopGold, графика: Злато');
  });
});

describe('summary', () => {
  it('adds the day range; dealer changes since the morning', () => {
    const text = summaryText(
      snap('2026-10-26T20:00:00Z', 3588.65, 132),
      market,
      snap('2026-10-26T16:00:00Z', 3585, 132),
      snap('2026-10-26T08:00:00Z', 3570, 131),
    );
    expect(text).toContain('📊 <b>Обобщение · пн, 26.10</b>');
    expect(tableRow(text, 'от 18:00')).toEqual(['+0,10%', '0,00%', '0,00%']);
    expect(tableRow(text, 'мин')).toEqual(['3560,10', '—', '—']);
    expect(tableRow(text, 'макс')).toEqual(['3595,00', '—', '—']);
    expect(text).toContain('промяна от 10:00');
  });

  it('weekend: says the exchange was closed', () => {
    const text = summaryText(snap('2026-10-24T20:00:00Z', 3588, 132), { metals: {}, errors: [] }, undefined, undefined);
    expect(text).toContain('Борсата не е работила днес.');
  });
});

describe('modeFor', () => {
  const at = (iso: string) => sofiaClock(new Date(iso));
  // Mon 26.10.2026; Sofia = UTC+2.
  it('updates at 10, 14 and 18 on weekdays, once per slot', () => {
    expect(modeFor(at('2026-10-26T06:00:00Z'), {})).toBe('none'); // 08:00
    expect(modeFor(at('2026-10-26T08:00:00Z'), {})).toBe('update'); // 10:00
    expect(modeFor(at('2026-10-26T08:10:00Z'), { lastSlot: '2026-10-26 10' })).toBe('none');
    expect(modeFor(at('2026-10-26T10:00:00Z'), { lastSlot: '2026-10-26 10' })).toBe('none'); // 12:00
    expect(modeFor(at('2026-10-26T16:00:00Z'), { lastSlot: '2026-10-26 14' })).toBe('update'); // 18:00
  });

  it('a trigger an hour late (GitHub backup in summer time) still sends the slot', () => {
    expect(modeFor(at('2026-10-26T09:10:00Z'), { lastSlot: '2026-10-25 18' })).toBe('update'); // 11:10
  });

  it('summary from 22:00, once a day, weekends included', () => {
    expect(modeFor(at('2026-10-26T20:00:00Z'), {})).toBe('summary');
    expect(modeFor(at('2026-10-26T20:10:00Z'), { summarySentOn: '2026-10-26' })).toBe('none');
    expect(modeFor(at('2026-10-24T20:00:00Z'), {})).toBe('summary'); // Saturday
  });

  it('weekends: nothing during the day', () => {
    expect(modeFor(at('2026-10-24T08:00:00Z'), {})).toBe('none');
  });
});

describe('command', () => {
  it.each([
    ['/gold', 'gold'],
    ['/gold@GoldBulgariaMonitorBot', 'gold'],
    ['/Gold сега', 'gold'],
    ['/start', 'start'],
    ['gold', undefined],
    ['/golden', 'golden'],
    [undefined, undefined],
  ])('%s → %s', (text, expected) => expect(command(text)).toBe(expected));
});
