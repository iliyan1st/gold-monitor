import * as cheerio from 'cheerio';
import { fetchJson, fetchText, parseEuro } from '../http.js';
import type { Candle, DealerPrice, Metal } from '../types.js';

/** The market data behind Tavex's own price charts (tavex.bg/grafika-tseni-zlato-srebro/). */
const MARKET_DATA = 'https://market-data.tavex.eu/v1/';

interface SpotResponse {
  data: { ask: number; bid: number; mid: number; dateTime: string };
}

interface ChartResponse {
  data: { open: number; close: number; high: number; low: number; startDateTime: string }[];
}

export async function tavexSpot(metal: Metal): Promise<number> {
  const res = await fetchJson<SpotResponse>(`${MARKET_DATA}spot-price/xignite-metals?symbol=${metal}EUR`);
  if (!(res.data?.mid > 0)) throw new Error(`Tavex spot ${metal}: no price`);
  return res.data.mid;
}

/** Interval codes the Tavex chart itself uses: PT5M for 24 h, PT6H for a month. Others return HTML. */
export type ChartInterval = 'PT5M' | 'PT1H' | 'PT6H';

export async function tavexCandles(metal: Metal, from: Date, to: Date, interval: ChartInterval): Promise<Candle[]> {
  const iso = (d: Date) => d.toISOString().split('.')[0] + 'Z';
  const url =
    `${MARKET_DATA}chart-data/xignite-metals?symbol=${metal}&currency=EUR&priceType=Mid` +
    `&from=${iso(from)}&to=${iso(to)}&interval=${interval}`;
  const res = await fetchJson<ChartResponse>(url);
  return parseCandles(res);
}

export function parseCandles(res: ChartResponse): Candle[] {
  return (res.data ?? []).map((c) => ({
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    start: c.startDateTime,
  }));
}

export async function tavexProduct(url: string): Promise<DealerPrice> {
  return parseTavexProduct(await fetchText(url));
}

/**
 * Reads the "Продаваме / Купуваме" table on a product page — the prices the page shows.
 * Not the JSON-LD offer: when a product is sold out it carries the buy-back price instead.
 */
export function parseTavexProduct(html: string): DealerPrice {
  const $ = cheerio.load(html);
  const table = $('.product-poster__table').first();
  const head = table.find('.product-poster__table-row--head').first().children();
  const values = table.find('.product-poster__table-row').not('.product-poster__table-row--head').first().children();
  if (!head.length || head.length !== values.length) throw new Error('Tavex: price table not found');

  const price: DealerPrice = { sell: null, buy: null };
  head.each((i, el) => {
    const label = $(el).text().trim();
    const cell = values.eq(i);
    // Tiered prices list the 1-piece price first.
    const first = cell.find('.product-poster__pricelist-value').first();
    const value = parseEuro((first.length ? first : cell).text());
    if (label.startsWith('Продаваме')) price.sell = value;
    else if (label.startsWith('Купуваме')) price.buy = value;
  });
  if (price.sell === null && price.buy === null) throw new Error('Tavex: no prices in table');
  return price;
}
