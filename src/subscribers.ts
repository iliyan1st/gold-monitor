import { del, list, put } from '@vercel/blob';

/**
 * People who pressed Start, one private blob each (Vercel Blob store gold-monitor-subscribers).
 * One file per chat means two people subscribing at once can't overwrite each other.
 * The Vercel webhook adds/removes them; the scheduled GitHub runs list them.
 */
const PREFIX = 'subscribers/';

/** At most this many chats, so a stranger who finds the bot can't make it spam Telegram. */
export const MAX_SUBSCRIBERS = 20;

const pathname = (chatId: number) => `${PREFIX}${chatId}.json`;

export function chatIdFromPathname(p: string): number | undefined {
  const m = p.match(/^subscribers\/(-?\d+)\.json$/);
  return m ? Number(m[1]) : undefined;
}

export async function listSubscribers(): Promise<number[]> {
  // Local dry runs have no store.
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const ids: number[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor });
    for (const b of page.blobs) {
      const id = chatIdFromPathname(b.pathname);
      if (id !== undefined) ids.push(id);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return ids;
}

export async function addSubscriber(chatId: number, name: string): Promise<void> {
  const body = JSON.stringify({ chatId, name, since: new Date().toISOString() });
  await put(pathname(chatId), body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function removeSubscriber(chatId: number): Promise<void> {
  await del(pathname(chatId));
}
