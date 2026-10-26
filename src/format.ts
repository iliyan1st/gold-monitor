import { sofiaDay, sofiaTime, sofiaWeekday } from './clock.js';
import { PERIODS, type Market } from './market.js';
import { PRODUCTS, type Dealer } from './products.js';
import { GRAMS_PER_OZ, METALS, type Metal, type Snapshot } from './types.js';

export const METAL_NAMES: Record<Metal, string> = { XAU: 'Злато', XAG: 'Сребро', XPT: 'Платина' };

const NUM = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "3588,65", "14 167,00", "—" for a price the site doesn't show. */
export const eur = (n: number | null | undefined) => (n == null ? '—' : NUM.format(n));

export const pctChange = (from: number, to: number) => ((to - from) / from) * 100;

/** "+0,25%", "−1,10%", "0,00%"; "—" when there's nothing to compare with. */
export function signedPct(from: number | undefined, to: number | undefined): string {
  if (!from || !to) return '—';
  const p = Math.round(pctChange(from, to) * 100) / 100;
  if (p === 0) return '0,00%';
  return `${p > 0 ? '+' : '−'}${NUM.format(Math.abs(p))}%`;
}

/** " (🔺 +1,00)" when a dealer price moved; nothing when it didn't or there's nothing to compare. */
function delta(from: number | null | undefined, to: number | null): string {
  if (from == null || to === null) return '';
  const d = Math.round((to - from) * 100) / 100;
  if (d === 0) return '';
  return ` (${d > 0 ? '🔺 +' : '🔻 −'}${NUM.format(Math.abs(d))})`;
}

/** "от 14:00" (same day) or "от 24.10" — short enough for the table's label column. */
export function sinceLabel(ref: Snapshot, now: Snapshot): string {
  return ref.date === now.date ? `от ${sofiaTime(ref.at)}` : `от ${sofiaDay(ref.at)}`;
}

const LABEL = 8;
const CELL = 9;
const row = (label: string, cells: string[]) => label.padEnd(LABEL) + cells.map((c) => c.padStart(CELL)).join('');

/**
 * Spot prices and their changes as a monospace table: 6 changes × 3 metals don't read as prose.
 * 35 characters wide, so it fits a phone screen without wrapping.
 */
function spotTable(snap: Snapshot, market: Market, last: Snapshot | undefined, withDayRange = false): string {
  const mid = (m: Metal) => snap.spot[m]?.mid;
  const cells = (f: (m: Metal) => string) => METALS.map(f);
  const rows = [
    row('', cells((m) => METAL_NAMES[m])),
    row('€/oz', cells((m) => eur(mid(m)))),
    row('€/г', cells((m) => eur(mid(m) && mid(m)! / GRAMS_PER_OZ))),
  ];
  if (last) rows.push(row(sinceLabel(last, snap), cells((m) => signedPct(last.spot[m]?.mid, mid(m)))));
  for (const p of PERIODS) {
    rows.push(row(p.label, cells((m) => signedPct(market.metals[m]?.ref[p.key], mid(m)))));
    if (p.key === 'day' && withDayRange) {
      rows.push(row('мин', cells((m) => eur(market.metals[m]?.day?.low))));
      rows.push(row('макс', cells((m) => eur(market.metals[m]?.day?.high))));
    }
  }
  return `<pre>${esc(rows.join('\n'))}</pre>`;
}

function dealerBlock(dealer: Dealer, snap: Snapshot, ref: Snapshot | undefined): string[] {
  const lines = PRODUCTS.filter((p) => p.dealer === dealer && snap.products[p.key]).map((p) => {
    const now = snap.products[p.key];
    const was = ref?.products[p.key];
    return (
      `• <a href="${p.url}">${esc(p.name)}</a>: ` +
      `${eur(now.sell)}${delta(was?.sell, now.sell)} / ${eur(now.buy)}${delta(was?.buy, now.buy)}`
    );
  });
  if (!lines.length) return [];
  const since = ref ? ` · промяна ${sinceLabel(ref, snap)}` : '';
  return ['', `<b>${dealer}</b> · продава / изкупува, €${since}`, ...lines];
}

function footer(snap: Snapshot, market: Market): string[] {
  const lines: string[] = [];
  if (METALS.some((m) => snap.spot[m]?.source === 'gold-api')) {
    lines.push('ℹ️ Борсовите цени са от gold-api.com — Tavex не отговори.');
  }
  const errors = [...snap.errors, ...market.errors];
  if (errors.length) lines.push(`⚠️ Не отговориха: ${esc(errors.join(', '))}`);
  return lines.length ? ['', ...lines] : [];
}

/** The scheduled update and the /gold answer. `last` = prices of the previous scheduled message. */
export function updateText(snap: Snapshot, market: Market, last: Snapshot | undefined): string {
  return [
    `🕐 <b>${sofiaTime(snap.at)}</b> · борсова цена (Tavex), €`,
    spotTable(snap, market, last),
    ...dealerBlock('Tavex', snap, last),
    ...dealerBlock('TopGold', snap, last),
    ...footer(snap, market),
  ].join('\n');
}

/** `morning` = the day's first prices (or the last ones sent, on weekends), for the dealer changes. */
export function summaryText(
  snap: Snapshot,
  market: Market,
  last: Snapshot | undefined,
  morning: Snapshot | undefined,
): string {
  const closed = METALS.every((m) => !market.metals[m]?.day) && !market.errors.length;
  return [
    `📊 <b>Обобщение · ${sofiaWeekday(snap.at)}, ${sofiaDay(snap.at)}</b>`,
    ...(closed ? ['Борсата не е работила днес.'] : []),
    spotTable(snap, market, last, true),
    ...dealerBlock('Tavex', snap, morning),
    ...dealerBlock('TopGold', snap, morning),
    ...footer(snap, market),
  ].join('\n');
}
