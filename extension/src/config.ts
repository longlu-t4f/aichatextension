const DEFAULT_IFRAME_URL =
  (import.meta.env.VITE_IFRAME_URL as string | undefined)?.trim() ||
  'http://localhost:5173/';

const envAllowed =
  (import.meta.env.VITE_IFRAME_ALLOWED_ORIGINS as string | undefined)
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

function toOrigin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

const derivedOrigin = toOrigin(DEFAULT_IFRAME_URL);

export const IFRAME_URL = DEFAULT_IFRAME_URL;

export const IFRAME_ALLOWED_ORIGINS = Array.from(
  new Set(
    [...envAllowed, derivedOrigin].filter(
      (origin): origin is string => typeof origin === 'string' && origin.length > 0
    )
  )
);

export function buildIframeUrl(tabId?: number): string {
  try {
    const url = new URL(IFRAME_URL);
    if (tabId != null) {
      url.searchParams.set('tabId', String(tabId));
    }
    return url.toString();
  } catch {
    return IFRAME_URL;
  }
}

