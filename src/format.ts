import { sofiaDay, sofiaTime, sofiaWeekday } from './clock.js';
import type { MarketDay } from './market.js';
import { PRODUCTS, type Dealer } from './products.js';
import { GRAMS_PER_OZ, METALS, type Metal, type Snapshot } from './types.js';

export const METAL_NAMES: Record<Metal, string> = { XAU: 'Злато', XAG: 'Сребро', XPT: 'Платина' };
const METAL_ICONS: Record<Metal, string> = { XAU: '🥇', XAG: '🥈', XPT: '⚪' };

const NUM = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "3588,65", "14 167,00", "—" for a price the site doesn't show. */
export const eur = (n: number | null | undefined) => (n == null ? '—' : NUM.format(n));

export const pctChange = (from: number, to: number) => ((to - from) / from) * 100;

/** "🔺 +0,25%", "🔻 −1,10%", "▫️ 0,00%" */
export function pct(from: number, to: number): string {
  const p = Math.round(pctChange(from, to) * 100) / 100;
  if (p === 0) return '▫️ 0,00%';
  return `${p > 0 ? '🔺 +' : '🔻 −'}${NUM.format(Math.abs(p))}%`;
}

/** " (🔺 +1,00)" when a dealer price moved; nothing when it didn't or there's nothing to compare. */
function delta(from: number | null | undefined, to: number | null): string {
  if (from == null || to === null) return '';
  const d = Math.round((to - from) * 100) / 100;
  if (d === 0) return '';
  return ` (${d > 0 ? '🔺 +' : '🔻 −'}${NUM.format(Math.abs(d))})`;
}

/** "за час" when `ref` is about an hour old, otherwise "от 08:00" / "от 24.10 22:00". */
export function sinceLabel(ref: Snapshot, now: Snapshot): string {
  const minutes = (Date.parse(now.at) - Date.parse(ref.at)) / 60_000;
  if (minutes <= 90) return 'за час';
  return ref.date === now.date ? `от ${sofiaTime(ref.at)}` : `от ${sofiaDay(ref.at)} ${sofiaTime(ref.at)}`;
}

function spotHead(snap: Snapshot, metal: Metal): string {
  const s = snap.spot[metal];
  const name = `${METAL_ICONS[metal]} ${METAL_NAMES[metal]}`;
  return s ? `${name}: <b>${eur(s.mid)}</b>/oz · ${eur(s.mid / GRAMS_PER_OZ)}/г` : `${name}: няма цена`;
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

function footer(snap: Snapshot, extraErrors: string[] = []): string[] {
  const lines: string[] = [];
  if (METALS.some((m) => snap.spot[m]?.source === 'gold-api')) {
    lines.push('ℹ️ Борсовите цени са от gold-api.com — Tavex не отговори.');
  }
  const errors = [...snap.errors, ...extraErrors];
  if (errors.length) lines.push(`⚠️ Не отговориха: ${esc(errors.join(', '))}`);
  return lines.length ? ['', ...lines] : [];
}

/** Previous snapshots worth comparing against, oldest last, without repeating the same one. */
function references(snap: Snapshot, candidates: (Snapshot | undefined)[]): Snapshot[] {
  const seen = new Set<string>([snap.at]);
  return candidates.filter((r): r is Snapshot => !!r && !seen.has(r.at) && !!seen.add(r.at));
}

export function hourlyText(snap: Snapshot, last: Snapshot | undefined, dayOpen: Snapshot | undefined): string {
  const refs = references(snap, [last, dayOpen?.date === snap.date ? dayOpen : undefined]);
  const spot = METALS.flatMap((m) => {
    const now = snap.spot[m];
    const changes = now
      ? refs.filter((r) => r.spot[m]).map((r) => `${sinceLabel(r, snap)} ${pct(r.spot[m]!.mid, now.mid)}`)
      : [];
    return changes.length ? [spotHead(snap, m), `      ${changes.join(' · ')}`] : [spotHead(snap, m)];
  });
  return [
    `🕐 <b>${sofiaTime(snap.at)}</b> · борсови цени, €`,
    ...spot,
    ...dealerBlock('Tavex', snap, last),
    ...dealerBlock('TopGold', snap, last),
    ...footer(snap),
  ].join('\n');
}

/** `ref` = the morning's first prices (or the last ones sent, on days without hourly messages). */
export function summaryText(snap: Snapshot, market: MarketDay, ref: Snapshot | undefined): string {
  const lines = [`📊 <b>Обобщение · ${sofiaWeekday(snap.at)}, ${sofiaDay(snap.at)}</b>`];
  if (METALS.every((m) => !market.day[m]) && !market.errors.length) lines.push('Борсата не е работила днес.');
  for (const m of METALS) {
    lines.push(spotHead(snap, m));
    const now = snap.spot[m]?.mid;
    const day = market.day[m];
    const week = market.weekAgo[m];
    if (now && day) lines.push(`      ден ${pct(day.open, now)} · мин ${eur(day.low)} · макс ${eur(day.high)}`);
    if (now && week) lines.push(`      седмица ${pct(week, now)}`);
  }
  return [
    ...lines,
    ...dealerBlock('Tavex', snap, ref),
    ...dealerBlock('TopGold', snap, ref),
    ...footer(snap, market.errors),
  ].join('\n');
}
