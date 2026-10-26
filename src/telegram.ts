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

/** Sends a photo (a PNG, or a file_id Telegram already has) and returns its file_id for reuse. */
export async function sendPhoto(chatId: string | number, photo: Blob | string, caption: string): Promise<string> {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  if (typeof photo === 'string') form.append('photo', photo);
  else form.append('photo', photo, 'chart.png');
  const res = await fetch(api('sendPhoto'), { method: 'POST', body: form });
  if (!res.ok) throw new TelegramError(res.status, `Telegram ${res.status} for chat ${chatId}: ${await res.text()}`);
  const { result } = (await res.json()) as { result: { photo: { file_id: string }[] } };
  return result.photo.at(-1)!.file_id;
}

/** The same photo to every chat: uploaded once, then re-sent by file_id. Failures are only logged. */
export async function broadcastPhoto(chatIds: string[], png: Blob, caption: string): Promise<void> {
  if (process.env.DRY_RUN === '1' || !process.env.TELEGRAM_BOT_TOKEN) {
    console.log(`[dry-run photo → ${chatIds.join(', ') || 'nobody'}] ${png.size} bytes\n${caption}\n`);
    return;
  }
  let photo: Blob | string = png;
  for (const chatId of chatIds) {
    try {
      photo = await sendPhoto(chatId, photo, caption);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
    }
  }
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
