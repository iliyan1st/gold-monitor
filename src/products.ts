import type { Metal } from './types.js';

export type Dealer = 'Tavex' | 'TopGold';

export interface Product {
  /** Stable id in data/state.json — don't rename, or the "за час" change is lost for one run. */
  key: string;
  dealer: Dealer;
  metal: Metal;
  name: string;
  url: string;
  /** TopGold's WooCommerce product id (from the price endpoint / store API). */
  topgoldId?: number;
  /** Pieces in the package, so a tube of 25 coins is shown per coin. */
  pieces?: number;
}

/**
 * What the bot watches. To add a product: Tavex → its page URL; TopGold → its id from
 * https://topgold.bg/wp-json/wc/store/v1/products?search=<name>.
 */
export const PRODUCTS: Product[] = [
  {
    key: 'tavex-gold-0.25g',
    dealer: 'Tavex',
    metal: 'XAU',
    name: '0,25 г кюлче Tavex',
    url: 'https://tavex.bg/zlato/0-25-gr-zlatno-kyulche-tavex/',
  },
  {
    key: 'tavex-gold-1g-subscription',
    dealer: 'Tavex',
    metal: 'XAU',
    name: '1 г абонаментно кюлче Tavex',
    url: 'https://tavex.bg/zlato/1-gram-abonamentno-zlatno-kulche-tavex/',
  },
  {
    key: 'tavex-silver-maple-1oz',
    dealer: 'Tavex',
    metal: 'XAG',
    name: '1 oz Кленов лист (сребро)',
    url: 'https://tavex.bg/srebro/1-unciya-sreburen-kanadski-klenov-list/',
  },
  {
    key: 'tavex-platinum-kangaroo-1oz',
    dealer: 'Tavex',
    metal: 'XPT',
    name: '1 oz Кенгуру (платина)',
    url: 'https://tavex.bg/platina/1-unciya-platinena-moneta-avstraliisko-kenguru/',
  },
  {
    key: 'topgold-gold-0.5g-valcambi',
    dealer: 'TopGold',
    metal: 'XAU',
    name: '0,5 г кюлче Valcambi',
    url: 'https://topgold.bg/product/0-5-grama-zlatno-kyulche-valcambi/',
    topgoldId: 2130,
  },
  {
    key: 'topgold-gold-1g-combibar',
    dealer: 'TopGold',
    metal: 'XAU',
    name: '1 г Valcambi CombiBar',
    url: 'https://topgold.bg/product/1-gram-zlatno-kyulche-valcambi-combibar/',
    topgoldId: 1325,
  },
  {
    key: 'topgold-silver-maple-1oz',
    dealer: 'TopGold',
    metal: 'XAG',
    name: '1 oz Кленов лист (сребро, от тубус 25 бр.)',
    url: 'https://topgold.bg/product/tubus-ot-25h-1-uncziya-31-1-gr-srebarna-moneta-klenov-list-2025-kanada/',
    topgoldId: 762,
    pieces: 25,
  },
  {
    key: 'topgold-platinum-kangaroo-1oz',
    dealer: 'TopGold',
    metal: 'XPT',
    name: '1 oz Кенгуру (платина)',
    url: 'https://topgold.bg/product/1-uncziya-31-1-gr-platinena-moneta-avstralijsko-kenguru/',
    topgoldId: 1926,
  },
];
