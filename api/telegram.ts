import { handleUpdate, type Update } from '../src/commands.js';

/**
 * Telegram webhook (Vercel function): answers /gold right away. Telegram signs each call with the
 * secret given to setWebhook, so nobody else can make the bot fetch prices.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    await handleUpdate((await request.json()) as Update);
  } catch (err) {
    console.error(err);
  }
  // Always 200: Telegram re-sends updates that fail, which would mean duplicate answers.
  return new Response('ok');
}
