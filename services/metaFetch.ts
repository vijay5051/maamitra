/**
 * URL metadata fetcher — uses microlink.io (free, CORS-safe)
 * Returns Open Graph / page metadata from any URL.
 */

export interface PageMeta {
  title: string;
  description: string;
  imageUrl?: string;
  url: string;
  publisher?: string;
}

/**
 * Fetch metadata for any URL via microlink.io API.
 * Throws a descriptive Error on failure so callers can show a fallback UI.
 */
export async function fetchUrlMeta(url: string): Promise<PageMeta> {
  const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}&prerender=false`;
  const r = await fetch(endpoint, { headers: { Accept: 'application/json' } });

  if (!r.ok) {
    throw new Error(`Metadata fetch failed (${r.status}). Enter details manually.`);
  }

  const d = await r.json();
  if (d.status !== 'success') {
    throw new Error('Could not extract metadata from this URL. Enter details manually.');
  }

  const data = d.data ?? {};
  return {
    title: data.title ?? '',
    description: data.description ?? '',
    imageUrl: data.image?.url ?? data.logo?.url,
    url: data.url ?? url,
    publisher: data.publisher ?? data.author,
  };
}
