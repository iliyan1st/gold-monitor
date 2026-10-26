import { sofiaClock } from './clock.js';
import { PRODUCTS } from './products.js';
import { goldApiSpot } from './sources/goldapi.js';
import { tavexProduct, tavexSpot } from './sources/tavex.js';
import { topgoldPrices } from './sources/topgold.js';
import { METALS, type DealerPrice, type Snapshot } from './types.js';
import { METAL_NAMES } from './format.js';

const perPiece = (p: DealerPrice, pieces = 1): DealerPrice => ({
  sell: p.sell === null ? null : p.sell / pieces,
  buy: p.buy === null ? null : p.buy / pieces,
});

/** Reads every price once. A failing source is listed in `errors`; the rest still go out. */
export async function takeSnapshot(now = new Date()): Promise<Snapshot> {
  const snap: Snapshot = { at: now.toISOString(), date: sofiaClock(now).date, spot: {}, products: {}, errors: [] };
  const fail = (label: string) => (err: unknown) => {
    console.error(`${label}:`, err instanceof Error ? err.message : err);
    snap.errors.push(label);
  };

  const spot = METALS.map(async (metal) => {
    try {
      snap.spot[metal] = { mid: await tavexSpot(metal), source: 'tavex' };
    } catch (err) {
      console.error(`Tavex spot ${metal}, falling back to gold-api:`, err instanceof Error ? err.message : err);
      snap.spot[metal] = { mid: await goldApiSpot(metal), source: 'gold-api' };
    }
  });

  const tavex = PRODUCTS.filter((p) => p.dealer === 'Tavex').map((p) =>
    tavexProduct(p.url).then((price) => void (snap.products[p.key] = price), fail(`Tavex: ${p.name}`)),
  );

  const topgold = PRODUCTS.filter((p) => p.topgoldId !== undefined);
  const topgoldAll = topgoldPrices(topgold.map((p) => p.topgoldId!)).then((prices) => {
    for (const p of topgold) {
      const price = prices[p.topgoldId!];
      if (price) snap.products[p.key] = perPiece(price, p.pieces);
      else fail(`TopGold: ${p.name}`)('missing from the price endpoint');
    }
  }, fail('TopGold'));

  await Promise.all([
    ...spot.map((s, i) => s.catch(fail(`борса: ${METAL_NAMES[METALS[i]]}`))),
    ...tavex,
    topgoldAll,
  ]);
  return snap;
}
