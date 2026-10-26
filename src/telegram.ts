const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

/** The owner's chat(s), from TELEGRAM_CHAT_ID (comma-separated): always get the messages, and hear about new subscribers. */
export const configuredChats = () =>
  (process.env.TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export class TelegramError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function sendMessage(chatId: string | number, text: string): Promise<void> {
  const res = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  });
  if (!res.ok) throw new TelegramError(res.status, `Telegram ${res.status} for chat ${chatId}: ${await res.text()}`);
}

/**
 * Sends to every chat; one failing chat doesn't stop the others. Prints instead on a dry run
 * (DRY_RUN=1, or no bot configured locally). Returns the chats that blocked the bot (403).
 */
export async function broadcast(chatIds: string[], text: string): Promise<{ blocked: string[] }> {
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun || !process.env.TELEGRAM_BOT_TOKEN || !chatIds.length) {
    if (!dryRun && process.env.CI) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets are not set');
    console.log(`[dry-run telegram → ${chatIds.join(', ') || 'nobody'}]\n${text}\n`);
    return { blocked: [] };
  }
  let sent = 0;
  const blocked: string[] = [];
  for (const chatId of chatIds) {
    try {
      await sendMessage(chatId, text);
      sent++;
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      if (err instanceof TelegramError && err.status === 403) blocked.push(chatId);
    }
  }
  if (!sent) throw new Error('no chat received the message');
  return { blocked };
}
