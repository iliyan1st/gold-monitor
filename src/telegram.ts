const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

/** Chats that get the scheduled messages and may use /gold: TELEGRAM_CHAT_ID, comma-separated. */
export const configuredChats = () =>
  (process.env.TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export async function sendMessage(chatId: string | number, text: string): Promise<void> {
  const res = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status} for chat ${chatId}: ${await res.text()}`);
}

/** Whether `userId` is in the group `chatId` (so they may also ask the bot privately). */
export async function isMember(chatId: string, userId: number): Promise<boolean> {
  const res = await fetch(api(`getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`));
  if (!res.ok) return false;
  const { result } = (await res.json()) as { result: { status: string; is_member?: boolean } };
  return ['creator', 'administrator', 'member'].includes(result.status) || result.is_member === true;
}

/**
 * Sends a message to every configured chat, or prints it on a dry run (DRY_RUN=1, or no bot
 * configured locally).
 */
export async function send(text: string): Promise<void> {
  const chatIds = configuredChats();
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun || !process.env.TELEGRAM_BOT_TOKEN || !chatIds.length) {
    if (!dryRun && process.env.CI) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets are not set');
    console.log(`[dry-run telegram]\n${text}\n`);
    return;
  }
  for (const chatId of chatIds) {
    await sendMessage(chatId, text);
    // Telegram allows ~1 message/second per chat.
    await new Promise((r) => setTimeout(r, 1100));
  }
}
