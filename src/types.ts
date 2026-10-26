export type Metal = 'XAU' | 'XAG' | 'XPT';

export const METALS: Metal[] = ['XAU', 'XAG', 'XPT'];

/** Exchange (spot) price of one troy ounce in €. */
export interface Spot {
  mid: number;
  /** 'gold-api' only when Tavex's own market data didn't answer. */
  source: 'tavex' | 'gold-api';
}

/** A dealer's prices in €; null where the site shows "-" (sold out / not bought back). */
export interface DealerPrice {
  /** "Продаваме" — what you pay the dealer. */
  sell: number | null;
  /** "Купуваме" — what the dealer pays you. */
  buy: number | null;
}

export interface Snapshot {
  at: string; // ISO time
  date: string; // YYYY-MM-DD, Europe/Sofia
  spot: Partial<Record<Metal, Spot>>;
  products: Record<string, DealerPrice>;
  /** Sources that failed this run, shown at the bottom of the message. */
  errors: string[];
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  start: string; // ISO time
  end: string; // ISO time
}

export const GRAMS_PER_OZ = 31.1034768;
