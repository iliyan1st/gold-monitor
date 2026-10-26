const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept-Language': 'bg,en;q=0.8',
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Network errors, rate limits and server errors are worth retrying; 403/404 are answers. */
const retryable = (err: unknown) => !(err instanceof HttpError) || err.status === 429 || err.status >= 500;

/** Runs `fn` up to 3 times with a growing pause, so one hiccup doesn't cost an hourly message. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= 3 || !retryable(err)) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

export function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  return withRetry(async () => {
    const res = await fetch(url, {
      ...init,
      headers: { ...HEADERS, ...(init.headers as Record<string, string>) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText} for ${url}`);
    return res.text();
  });
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const text = await fetchText(url, init);
  try {
    return JSON.parse(text) as T;
  } catch {
    // Tavex's market-data answers unknown parameters with an HTML page and status 200.
    throw new Error(`not JSON from ${url}: ${text.slice(0, 80)}`);
  }
}

/**
 * Parses a price as the sites print it: "1 573,00 €", "66,58 €", "3654", "-".
 * A separator followed by 1–2 digits is the decimal one; any other is a thousands separator.
 */
export function parseEuro(text: string): number | null {
  const t = text.replace(/[\s €]/g, '');
  if (!/\d/.test(t)) return null;
  const lastSep = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  const hasDecimals = lastSep >= 0 && t.length - lastSep - 1 <= 2;
  const whole = (hasDecimals ? t.slice(0, lastSep) : t).replace(/[.,]/g, '');
  const n = Number(hasDecimals ? `${whole}.${t.slice(lastSep + 1)}` : whole);
  return Number.isFinite(n) ? n : null;
}
