/**
 * Sends a message to every chat in TELEGRAM_CHAT_ID (comma-separated: a group, or each person's
 * private chat), or prints it on a dry run (DRY_RUN=1, or no bot configured locally).
 */
export async function send(text: string, { silent = false } = {}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun || !token || !chatIds.length) {
    if (!dryRun && process.env.CI) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets are not set');
    console.log(`[dry-run telegram${silent ? ', silent' : ''}]\n${text}\n`);
    return;
  }
  for (const chatId of chatIds) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_notification: silent,
        link_preview_options: { is_disabled: true },
      }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status} for chat ${chatId}: ${await res.text()}`);
    // Telegram allows ~1 message/second per chat.
    await new Promise((r) => setTimeout(r, 1100));
  }
}
