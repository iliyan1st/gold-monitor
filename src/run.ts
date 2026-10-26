import { sofiaClock } from './clock.js';
import { hourlyText, pctChange, summaryText } from './format.js';
import { marketDay } from './market.js';
import { shouldBuzz, type Move } from './notify.js';
import { hourKey, modeFor, type Mode } from './schedule.js';
import { takeSnapshot } from './snapshot.js';
import { loadState, saveState } from './state.js';
import { send } from './telegram.js';
import { METALS, type Snapshot } from './types.js';

/** MODE=hourly|summary forces a message (manual runs); DRY_RUN=1 prints it and saves nothing. */
const forced = process.env.MODE === 'hourly' || process.env.MODE === 'summary' ? (process.env.MODE as Mode) : undefined;
const dryRun = process.env.DRY_RUN === '1';

function moves(snap: Snapshot, last: Snapshot | undefined, dayOpen: Snapshot | undefined): Move[] {
  return METALS.flatMap((metal) => {
    const now = snap.spot[metal]?.mid;
    if (!now) return [];
    const was = (ref: Snapshot | undefined) => ref?.spot[metal]?.mid;
    const hour = was(last);
    const day = dayOpen?.date === snap.date ? was(dayOpen) : undefined;
    return [{ metal, hourPct: hour && pctChange(hour, now), dayPct: day && pctChange(day, now) }];
  });
}

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

  if (mode === 'hourly') {
    await send(hourlyText(snap, state.last, dayOpen), { silent: !shouldBuzz(moves(snap, state.last, dayOpen)) });
    state.lastHourly = hourKey(clock);
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
