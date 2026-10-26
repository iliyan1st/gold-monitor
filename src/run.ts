import { buildChart } from './chart.js';
import { sofiaClock } from './clock.js';
import { summaryText, updateText } from './format.js';
import { fetchMarket } from './market.js';
import { modeFor, slotFor, slotKey, type Mode } from './schedule.js';
import { takeSnapshot } from './snapshot.js';
import { loadState, saveState } from './state.js';
import { listSubscribers, removeSubscriber } from './subscribers.js';
import { broadcast, broadcastPhoto, configuredChats } from './telegram.js';

/** MODE=update|summary forces a message (manual runs); DRY_RUN=1 prints it and saves nothing. */
const forced = process.env.MODE === 'update' || process.env.MODE === 'summary' ? (process.env.MODE as Mode) : undefined;
const dryRun = process.env.DRY_RUN === '1';

async function main() {
  const now = new Date();
  const clock = sofiaClock(now);
  const state = loadState();
  const mode = forced ?? modeFor(clock, state);
  console.log(`Sofia ${clock.date} ${clock.hour}:${String(clock.minute).padStart(2, '0')} (${clock.weekday}) → ${mode}`);
  if (mode === 'none') return;

  const [snap, market] = await Promise.all([takeSnapshot(now), fetchMarket(now)]);
  if (!Object.keys(snap.spot).length && !Object.keys(snap.products).length) {
    throw new Error(`every source failed: ${snap.errors.join(', ')}`);
  }
  const dayOpen = state.dayOpen?.date === snap.date ? state.dayOpen : undefined;

  const owners = configuredChats();
  const chats = [...new Set([...owners, ...(await listSubscribers()).map(String)])];
  const text = mode === 'update' ? updateText(snap, market, state.last) : summaryText(snap, market, state.last, dayOpen ?? state.last);
  const { blocked } = await broadcast(chats, text);
  // Someone who blocked the bot has left for good; drop them so every run doesn't fail on them.
  for (const chat of blocked.filter((c) => !owners.includes(c))) await removeSubscriber(Number(chat));
  if (mode === 'summary') {
    // The month's chart under the summary; without it the summary still counts as sent.
    await buildChart('month', now)
      .then(({ png, caption }) => broadcastPhoto(chats.filter((c) => !blocked.includes(c)), png, caption))
      .catch((err) => console.error('chart:', err instanceof Error ? err.message : err));
  }

  if (mode === 'update') state.lastSlot = slotKey(clock.date, slotFor(clock) ?? clock.hour);
  else state.summarySentOn = clock.date;
  state.dayOpen = dayOpen ?? snap;
  state.last = snap;
  if (!dryRun) saveState(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
