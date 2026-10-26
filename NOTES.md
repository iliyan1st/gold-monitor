# gold-monitor — progress notes

Goal: gold/silver/platinum prices in € to a Telegram group of 2–3 people who buy at Tavex and TopGold —
every hour on weekdays, plus one evening summary every day.

## How it works
- `src/run.ts` — decides what to send by Sofia time (`src/schedule.ts`), reads all prices once (`src/snapshot.ts`), sends, saves `data/state.json`.
- Hourly 08:00–21:00 Mon–Fri; 22:00 = summary instead (every day, weekends included). A second trigger in the same hour sends nothing.
- Hourly: spot €/oz + €/g with change "за час" and "от 08:00"; dealer sell/buy prices with the change since the last message.
- Summary: day open→now %, day min/max, week % (Tavex charts), dealer changes since the morning.
- `src/products.ts` — the watched products. `src/notify.ts` — `shouldBuzz()`: which hourly messages ring vs arrive silently.
- `MODE=hourly DRY_RUN=1 npm start` — print a message with live prices, send nothing, save nothing.

## Sources (verified 2026-10-26)
- Spot: `https://market-data.tavex.eu/v1/spot-price/xignite-metals?symbol=XAUEUR` (XAG/XPT) — the data behind tavex.bg's own charts. Fallback: `api.gold-api.com/price/XAU/EUR`.
- Charts: `…/v1/chart-data/xignite-metals?symbol=XAU&currency=EUR&priceType=Mid&from=…Z&to=…Z&interval=PT5M|PT6H`. Unknown interval codes return an HTML page with status 200.
- Tavex products: the "Продаваме / Купуваме" table on the product page. The JSON-LD price is the buy-back price when sold out — don't use it.
- TopGold: `POST /wp-content/plugins/wad-mods/ajax-prices.php` `action=get_dynamic_prices&ids[]=…` → `{buy, sell}` per WooCommerce id (what product pages poll every 60 s). Ids: `/wp-json/wc/store/v1/products?search=…`.
- TopGold shows Купуваме = Продаваме on some items (1 г CombiBar 121/121, платина Кенгуру 1760/1760) — that's what the site shows.

## Hosting
GitHub Actions, public repo `iliyan1st/gold-monitor` (free minutes; nothing secret in the code).
Secrets: `TELEGRAM_BOT_TOKEN` (@GoldBulgariaMonitorBot), `TELEGRAM_CHAT_ID` (group id, or several ids comma-separated).
Triggers: GitHub `schedule:` at :10 (backup) + cron-job.org at :00 (needs a GitHub token with Actions read/write on this repo).

## Status
- [x] Sources + messages, 28 tests, live dry run 2026-10-26
- [ ] Telegram group → `TELEGRAM_CHAT_ID`
- [ ] cron-job.org job (needs the GitHub token)
- [ ] `shouldBuzz()` rule — the user's call (default: every message rings)
