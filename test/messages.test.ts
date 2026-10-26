import { describe, expect, it } from 'vitest';
import { sofiaClock } from '../src/clock.js';
import { command } from '../src/commands.js';
import { pct, summaryText, updateText } from '../src/format.js';
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

describe('pct', () => {
  it('signs and rounds to 2 decimals', () => {
    expect(pct(100, 100.25)).toBe('🔺 +0,25%');
    expect(pct(100, 98.9)).toBe('🔻 −1,10%');
    expect(pct(100, 100.001)).toBe('▫️ 0,00%');
  });
});

describe('price update', () => {
  // 08:00, 12:00, 16:00 UTC = 10:00, 14:00, 18:00 in Sofia (winter time).
  const morning = snap('2026-10-26T08:00:00Z', 3570, 131);
  const noon = snap('2026-10-26T12:00:00Z', 3580, 131);
  const now = snap('2026-10-26T16:00:00Z', 3588.65, 132);

  it('spot in €/oz and €/g, change since the last message and since the morning', () => {
    const text = updateText(now, noon, morning);
    expect(text).toContain('🕐 <b>18:00</b>');
    expect(text).toContain('🥇 Злато: <b>3588,65</b>/oz · 115,38/г');
    expect(text).toContain('от 14:00 🔺 +0,24% · от 10:00 🔺 +0,52%');
  });

  it('dealer prices with the change, "—" where the site shows none', () => {
    const text = updateText(now, noon, morning);
    expect(text).toContain('<b>Tavex</b> · продава / изкупува, € · промяна от 14:00');
    expect(text).toContain('1 г абонаментно кюлче Tavex</a>: 132,00 (🔺 +1,00) / 119,00');
    expect(text).toContain('0,25 г кюлче Tavex</a>: — / 33,00');
    expect(text).not.toContain('TopGold');
  });

  it('second message of the day: last = morning, shown once', () => {
    const text = updateText(noon, morning, morning);
    expect(text).toContain('от 10:00 🔺 +0,28%');
    expect(text).not.toContain('· от 10:00 🔺');
  });

  it('first message of the day: compared with last night', () => {
    const lastNight = snap('2026-10-25T20:00:00Z', 3560, 131);
    expect(updateText(morning, lastNight, undefined)).toContain('от 25.10 22:00 🔺 +0,28%');
  });

  it('lists failed sources and the fallback', () => {
    const text = updateText(
      snap('2026-10-26T12:00:00Z', 3588, 132, {
        spot: { XAU: { mid: 3588, source: 'gold-api' } },
        errors: ['TopGold'],
      }),
      undefined,
      undefined,
    );
    expect(text).toContain('🥈 Сребро: няма цена');
    expect(text).toContain('gold-api.com');
    expect(text).toContain('⚠️ Не отговориха: TopGold');
  });
});

describe('summary', () => {
  it('day range and week change', () => {
    const text = summaryText(
      snap('2026-10-26T20:00:00Z', 3588.65, 132),
      { day: { XAU: { open: 3565.35, high: 3595, low: 3560.1 } }, weekAgo: { XAU: 3726.95 }, errors: [] },
      snap('2026-10-26T08:00:00Z', 3570, 131),
    );
    expect(text).toContain('📊 <b>Обобщение · пн, 26.10</b>');
    expect(text).toContain('ден 🔺 +0,65% · мин 3560,10 · макс 3595,00');
    expect(text).toContain('седмица 🔻 −3,71%');
    expect(text).toContain('промяна от 10:00');
  });

  it('weekend: says the exchange was closed', () => {
    const text = summaryText(snap('2026-10-24T20:00:00Z', 3588, 132), { day: {}, weekAgo: {}, errors: [] }, undefined);
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
