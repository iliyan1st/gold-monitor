# gold-monitor — progress notes

Goal: gold/silver/platinum prices in € to a Telegram group of 2–3 people who buy at Tavex and TopGold.
"Не сме дей трейдъри" — a few updates a day, plus prices on demand.

## How it works
- Scheduled (GitHub Actions, `src/run.ts`): updates at 10:00, 14:00, 18:00 Mon–Fri; summary at 22:00 every day (weekends: summary only). `src/schedule.ts` decides by Sofia time; a second trigger for the same slot sends nothing.
- On demand (Vercel, `api/telegram.ts` → `src/commands.ts`): `/gold` prices now; `/chart` (month), `/chart_7d`, `/chart_6m`, `/chart_1y` (or `/chart 6м`); `/stop`; `/id`.
- Open subscription (user's ask: "без номер, пише start и започва"): Start → subscribed, welcome + prices; `/stop` → removed. Subscribers = one private blob per chat in Vercel Blob store `gold-monitor-subscribers` (`src/subscribers.ts`), shared by Vercel (writes) and Actions (`BLOB_READ_WRITE_TOKEN` secret, reads). The owner (`TELEGRAM_CHAT_ID`) gets "➕/➖" notices; max 20 chats; chats that block the bot (403) are dropped.
- Chart (`src/chart.ts`): the three metals as % change from the period start, Tavex candles, rendered by quickchart.io (free, no key). Free tier refuses >~300 points per line → thinned to 200. The month chart follows the 22:00 summary.
- Update message: a 35-char monospace table (fits a phone) — spot €/oz, €/г, % since the previous message, day, week, month, 6 months, year (user's ask 2026-10-26); then dealer sell/buy with the change since the previous message.
- Summary: same table + day min/max; dealer changes since the morning.
- History (`src/market.ts`): Tavex charts — PT5M since Sofia midnight (day), PT6H (week, ±6 h), P1D for a year (month/6m/year, ±1 day). Daily candles run 15:00→15:00 UTC.
- `/gold` reads the scheduled runs' state from raw.githubusercontent.com (public repo, ≤5 min cache) for the "от 14:00" changes; it never writes state.
- `src/products.ts` — the watched products.
- `MODE=update DRY_RUN=1 npm start` — print a message with live prices, send nothing, save nothing.

## Sources (verified 2026-10-26)
- Spot: `https://market-data.tavex.eu/v1/spot-price/xignite-metals?symbol=XAUEUR` (XAG/XPT) — the data behind tavex.bg's own charts. Fallback: `api.gold-api.com/price/XAU/EUR`.
- Charts: `…/v1/chart-data/xignite-metals?symbol=XAU&currency=EUR&priceType=Mid&from=…Z&to=…Z&interval=PT5M|PT6H`. Unknown interval codes return an HTML page with status 200.
- Tavex products: the "Продаваме / Купуваме" table on the product page. The JSON-LD price is the buy-back price when sold out — don't use it.
- TopGold: `POST /wp-content/plugins/wad-mods/ajax-prices.php` `action=get_dynamic_prices&ids[]=…` → `{buy, sell}` per WooCommerce id (what product pages poll every 60 s). Ids: `/wp-json/wc/store/v1/products?search=…`.
- TopGold shows Купуваме = Продаваме on some items (1 г CombiBar 121/121, платина Кенгуру 1760/1760) — that's what the site shows.
- All sources answer from GitHub runners and Vercel (iad1).

## Hosting
- GitHub Actions, public repo `iliyan1st/gold-monitor` (free minutes; nothing secret in the code). Secrets: `TELEGRAM_BOT_TOKEN` (@GoldBulgariaMonitorBot), `TELEGRAM_CHAT_ID` (group id; several comma-separated).
- Triggers: GitHub `schedule:` at :10 (backup) + cron-job.org at :00 (needs a GitHub token with Actions read/write on this repo).
- Vercel project `gold-monitor` (team is-projects-311967fd) → https://gold-monitor-eta.vercel.app/api/telegram. Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID`. Deploy: `npx vercel deploy --prod --yes --token … --scope is-projects-311967fd` — redeploy after changing `src/` or env vars.
- While the webhook is set, getUpdates returns 409 — `deleteWebhook` first if you need it.
- Push with plain `git push` (Git Credential Manager); `gh`'s token lacks the `workflow` scope.

## Status
- [x] Sources + messages, 37 tests, live dry run on GitHub 2026-10-26
- [x] Vercel function deployed; rejects calls without the secret (403)
- [x] 2026-10-26 22:38: live. No group — `TELEGRAM_CHAT_ID` = 1107076415 (the user's private chat). Webhook + /gold command set; /gold tested end to end; first scheduled update sent from Actions.
- [x] Open subscription via Start (Blob store), tested live: add/list/remove locally, /stop and /chart on Vercel.
- [ ] GitHub `schedule:` hasn't fired yet for this repo (imoti-monitor's never did) — check the 10:10 run on 2026-10-27.
- [ ] cron-job.org job (needs the GitHub token)
