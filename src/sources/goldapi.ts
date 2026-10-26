import { fetchJson } from '../http.js';
import type { Metal } from '../types.js';

/** Free, keyless spot prices — only used when Tavex's market data doesn't answer. */
export async function goldApiSpot(metal: Metal): Promise<number> {
  const res = await fetchJson<{ price: number; currency: string }>(`https://api.gold-api.com/price/${metal}/EUR`);
  if (res.currency !== 'EUR' || !(res.price > 0)) throw new Error(`gold-api ${metal}: unexpected answer`);
  return res.price;
}
