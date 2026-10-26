import { fetchJson, parseEuro } from '../http.js';
import type { DealerPrice } from '../types.js';

/**
 * TopGold's product pages refresh their "Продаваме / Купуваме" prices every minute from this
 * endpoint; it takes any number of product ids at once.
 */
const PRICES_URL = 'https://topgold.bg/wp-content/plugins/wad-mods/ajax-prices.php';

interface PricesResponse {
  success: boolean;
  data?: Record<string, { buy: string; sell: string }>;
}

export async function topgoldPrices(ids: number[]): Promise<Record<number, DealerPrice>> {
  const body = new URLSearchParams({ action: 'get_dynamic_prices' });
  for (const id of ids) body.append('ids[]', String(id));
  const res = await fetchJson<PricesResponse>(PRICES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://topgold.bg/',
    },
    body,
  });
  return parseTopgoldPrices(res);
}

export function parseTopgoldPrices(res: PricesResponse): Record<number, DealerPrice> {
  if (!res.success || !res.data) throw new Error('TopGold: price endpoint answered without data');
  const out: Record<number, DealerPrice> = {};
  for (const [id, p] of Object.entries(res.data)) {
    out[Number(id)] = { sell: parseEuro(String(p.sell ?? '')), buy: parseEuro(String(p.buy ?? '')) };
  }
  return out;
}
