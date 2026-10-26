import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEuro } from '../src/http.js';
import { closeAt, dayStats } from '../src/market.js';
import { parseCandles, parseTavexProduct } from '../src/sources/tavex.js';
import { parseTopgoldPrices } from '../src/sources/topgold.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8');

describe('parseEuro', () => {
  it.each([
    ['132,00 €', 132],
    ['1573,00 €', 1573],
    ['1 573,00 €', 1573],
    ['1 573,50 €', 1573.5],
    ['3654', 3654],
    ['3.654', 3654],
    ['1,758.50', 1758.5],
    ['-', null],
    ['', null],
  ])('%s → %s', (text, expected) => expect(parseEuro(text)).toBe(expected));
});

describe('Tavex product pages (saved 2026-10-26)', () => {
  it('reads sell and buy', () => {
    expect(parseTavexProduct(fixture('tavex-gold-1g-subscription.html'))).toEqual({ sell: 132, buy: 119 });
  });

  it('sold out: no sell price, buy-back still shown', () => {
    expect(parseTavexProduct(fixture('tavex-gold-025g-out-of-stock.html'))).toEqual({ sell: null, buy: 33 });
    expect(parseTavexProduct(fixture('tavex-platinum-kangaroo.html'))).toEqual({ sell: null, buy: 1573 });
  });

  it('three-column table with "Продаваме (вкл. ДДС)" and spread', () => {
    expect(parseTavexProduct(fixture('tavex-silver-maple.html'))).toEqual({ sell: 66.58, buy: 51.09 });
  });

  it('fails loudly on a page without the table', () => {
    expect(() => parseTavexProduct('<html><body>maintenance</body></html>')).toThrow(/price table/);
  });
});

describe('TopGold price endpoint', () => {
  it('reads buy and sell per id', () => {
    const res = { success: true, data: { '2130': { buy: '78', sell: '84' }, '1926': { buy: '1758', sell: '1758' } } };
    expect(parseTopgoldPrices(res)).toEqual({ 2130: { sell: 84, buy: 78 }, 1926: { sell: 1758, buy: 1758 } });
  });

  it('fails on an unsuccessful answer', () => {
    expect(() => parseTopgoldPrices({ success: false })).toThrow(/without data/);
  });
});

describe('Tavex chart (gold, 24 h of 5-minute candles)', () => {
  const candles = parseCandles(JSON.parse(fixture('tavex-chart-xau-day.json')));

  it('day open, high and low', () => {
    const day = dayStats(candles)!;
    expect(day.open).toBe(3565.35);
    expect(day.high).toBeGreaterThanOrEqual(Math.max(day.open, ...candles.map((c) => c.close)));
    expect(day.low).toBeLessThanOrEqual(Math.min(day.open, ...candles.map((c) => c.close)));
  });

  it('no candles (weekend) → no day stats', () => {
    expect(dayStats([])).toBeUndefined();
  });

  it('close at a moment = last candle started before it', () => {
    expect(closeAt(candles, new Date('2026-10-25T22:12:00Z'))).toBe(3562.95);
    expect(closeAt(candles, new Date('2026-10-01T00:00:00Z'))).toBeUndefined();
  });
});
