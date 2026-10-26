import { buildChart, CHART_PERIODS, periodFor, type ChartPeriod } from './chart.js';
import { esc, updateText } from './format.js';
import { fetchJson } from './http.js';
import { fetchMarket } from './market.js';
import { takeSnapshot } from './snapshot.js';
import type { State } from './state.js';
import { addSubscriber, listSubscribers, MAX_SUBSCRIBERS, removeSubscriber } from './subscribers.js';
import { configuredChats, sendMessage, sendPhoto } from './telegram.js';

interface Message {
  text?: string;
  chat: { id: number; type: string; title?: string };
  from?: { id: number; first_name?: string; username?: string };
}

export interface Update {
  message?: Message;
}

/**
 * The scheduled runs' state, for the "от 14:00" changes. The repo is public, so it can be read
 * without a token; GitHub caches it for up to 5 minutes, which is fine for that.
 */
const STATE_URL = 'https://raw.githubusercontent.com/iliyan1st/gold-monitor/main/data/state.json';

const HELP =
  '/gold — цените сега\n' +
  `/chart — графика за месец (още /${CHART_PERIODS.week.command}, /${CHART_PERIODS.months6.command}, /${CHART_PERIODS.year.command})\n` +
  '/stop — спирам съобщенията';
const WELCOME =
  '✅ Готово! Ще получаваш цените на златото, среброто и платината в 10:00, 14:00 и 18:00 ' +
  `(пон–пет) и обобщение в 22:00 всеки ден.\n${HELP}`;

const COMMAND = /^\/([a-z0-9_]+)(?:@\w+)?(?:\s+(.*))?$/is;

/** "/gold", "/gold@GoldBulgariaMonitorBot", "/Gold сега" → "gold"; anything else → undefined. */
export function command(text: string | undefined): string | undefined {
  return text?.match(COMMAND)?.[1].toLowerCase();
}

/** "/chart 6м" → "6м" */
export const commandArg = (text: string | undefined) => text?.match(COMMAND)?.[2]?.trim() ?? '';

/** "Иван @ivan", or the group's title. */
export function who(msg: Message): string {
  const person = [msg.from?.first_name, msg.from?.username && `@${msg.from.username}`].filter(Boolean).join(' ');
  return msg.chat.title ?? (person || String(msg.chat.id));
}

/** Tells the owner who joined or left — the only control over an open bot. */
async function notifyOwner(text: string, except: number): Promise<void> {
  for (const chat of configuredChats().filter((c) => c !== String(except))) {
    await sendMessage(chat, text).catch((err) => console.error('owner notice:', err instanceof Error ? err.message : err));
  }
}

async function start(msg: Message): Promise<void> {
  const chatId = msg.chat.id;
  const subscribers = await listSubscribers();
  if (!subscribers.includes(chatId) && !configuredChats().includes(String(chatId))) {
    if (subscribers.length >= MAX_SUBSCRIBERS) {
      await sendMessage(chatId, 'Ботът е пълен. Помоли човека, който го поддържа, да те добави.');
      return;
    }
    await addSubscriber(chatId, who(msg));
    await notifyOwner(`➕ Нов абонат: ${esc(who(msg))}`, chatId);
  }
  await sendMessage(chatId, WELCOME);
  await gold(msg);
}

async function stop(msg: Message): Promise<void> {
  const chatId = msg.chat.id;
  if (configuredChats().includes(String(chatId))) {
    await sendMessage(chatId, 'Този чат е зададен в настройките на бота (TELEGRAM_CHAT_ID) — махни го оттам.');
    return;
  }
  await removeSubscriber(chatId);
  await sendMessage(chatId, 'Спрях съобщенията. /start — за да ги пуснеш пак.');
  await notifyOwner(`➖ Спря абонамента: ${esc(who(msg))}`, chatId);
}

async function gold(msg: Message): Promise<void> {
  const now = new Date();
  const [snap, market, state] = await Promise.all([
    takeSnapshot(now),
    fetchMarket(now),
    fetchJson<State>(STATE_URL).catch((err) => {
      console.error('state:', err instanceof Error ? err.message : err);
      return {} as State;
    }),
  ]);
  await sendMessage(msg.chat.id, updateText(snap, market, state.last));
}

async function chart(msg: Message, period: ChartPeriod): Promise<void> {
  const { png, caption } = await buildChart(period);
  await sendPhoto(msg.chat.id, png, caption);
}

export async function handleUpdate(update: Update): Promise<void> {
  const msg = update.message;
  const cmd = command(msg?.text);
  if (!msg || !cmd) return;
  const period = periodFor(cmd, commandArg(msg.text));
  if (period) await chart(msg, period);
  else if (cmd === 'start') await start(msg);
  else if (cmd === 'stop') await stop(msg);
  else if (cmd === 'gold') await gold(msg);
  else if (cmd === 'id') await sendMessage(msg.chat.id, `Номер на този чат: <code>${msg.chat.id}</code>`);
  else if (cmd === 'help') await sendMessage(msg.chat.id, HELP);
}
