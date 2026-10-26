import { updateText } from './format.js';
import { fetchJson } from './http.js';
import { takeSnapshot } from './snapshot.js';
import type { State } from './state.js';
import { configuredChats, isMember, sendMessage } from './telegram.js';

interface Message {
  text?: string;
  chat: { id: number; type: string; title?: string };
  from?: { id: number; first_name?: string };
}

export interface Update {
  message?: Message;
}

/**
 * The scheduled runs' state, for the "от 14:00" changes. The repo is public, so it can be read
 * without a token; GitHub caches it for up to 5 minutes, which is fine for that.
 */
const STATE_URL = 'https://raw.githubusercontent.com/iliyan1st/gold-monitor/main/data/state.json';

/** "/gold", "/gold@GoldBulgariaMonitorBot", "/Gold сега" → "gold"; anything else → undefined. */
export function command(text: string | undefined): string | undefined {
  return text?.match(/^\/([a-z]+)(?:@\w+)?(?:\s|$)/i)?.[1].toLowerCase();
}

/** The group(s) the bot posts to, and their members in a private chat with the bot. */
async function allowed(msg: Message): Promise<boolean> {
  const chats = configuredChats();
  if (chats.includes(String(msg.chat.id))) return true;
  if (msg.chat.type !== 'private' || !msg.from) return false;
  for (const chat of chats) if (await isMember(chat, msg.from.id)) return true;
  return false;
}

export async function handleUpdate(update: Update): Promise<void> {
  const msg = update.message;
  const cmd = command(msg?.text);
  if (!msg || !cmd) return;

  if (cmd === 'start' || cmd === 'id') {
    await sendMessage(msg.chat.id, `Цените сега: /gold\nНомер на този чат: <code>${msg.chat.id}</code>`);
    return;
  }
  if (cmd !== 'gold') return;
  if (!(await allowed(msg))) {
    console.log(`/gold from a chat that isn't set up: ${msg.chat.id} (${msg.chat.title ?? msg.from?.first_name ?? '?'})`);
    await sendMessage(msg.chat.id, 'Този бот е за една група. Помоли човека, който го поддържа, да те добави.');
    return;
  }

  const [snap, state] = await Promise.all([
    takeSnapshot(),
    fetchJson<State>(STATE_URL).catch((err) => {
      console.error('state:', err instanceof Error ? err.message : err);
      return {} as State;
    }),
  ]);
  const dayOpen = state.dayOpen?.date === snap.date ? state.dayOpen : undefined;
  await sendMessage(msg.chat.id, updateText(snap, state.last, dayOpen));
}
