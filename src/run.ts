import { sofiaClock } from './clock.js';
import { summaryText, updateText } from './format.js';
import { marketDay } from './market.js';
import { modeFor, slotFor, slotKey, type Mode } from './schedule.js';
import { takeSnapshot } from './snapshot.js';
import { loadState, saveState } from './state.js';
import { send } from './telegram.js';

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

  const snap = await takeSnapshot(now);
  if (!Object.keys(snap.spot).length && !Object.keys(snap.products).length) {
    throw new Error(`every source failed: ${snap.errors.join(', ')}`);
  }
  const dayOpen = state.dayOpen?.date === snap.date ? state.dayOpen : undefined;

  if (mode === 'update') {
    await send(updateText(snap, state.last, dayOpen));
    state.lastSlot = slotKey(clock.date, slotFor(clock) ?? clock.hour);
  } else {
    await send(summaryText(snap, await marketDay(now), dayOpen ?? state.last));
    state.summarySentOn = clock.date;
  }
  state.dayOpen = dayOpen ?? snap;
  state.last = snap;
  if (!dryRun) saveState(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
