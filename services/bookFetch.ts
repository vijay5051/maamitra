/**
 * Book metadata fetcher — Google Books API (free, no key needed)
 */

export interface FetchedBook {
  title: string;
  author: string;
  description: string;
  rating: number;       // 0 if unavailable
  reviews: number;      // 0 if unavailable
  imageUrl?: string;    // https thumbnail from Google Books
  categories: string[];
  isbn?: string;
  pageCount?: number;
  publishedDate?: string;
  googleBooksId?: string;
}

// ─── URL parsers ──────────────────────────────────────────────────────────────

/** Extract ISBN-10/13 or ASIN from Amazon URL */
function extractAmazonId(url: string): string | null {
  // /dp/XXXXXXXXXX or /gp/product/XXXXXXXXXX
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1] : null;
}

/** Extract Google Books volume ID from URL */
function extractGoogleBooksId(url: string): string | null {
  const m = url.match(/books\.google\.[^/]+\/books.*[?&]id=([^&\s]+)/);
  return m ? m[1] : null;
}

/** Extract raw ISBN from any URL query param or path */
function extractIsbn(url: string): string | null {
  const m = url.match(/isbn[=\/](\d{10,13})/i) || url.match(/\/(\d{13})(?:[/?]|$)/);
  return m ? m[1] : null;
}

// ─── Google Books response parser ─────────────────────────────────────────────

function parseItem(item: any): FetchedBook | null {
  const v = item?.volumeInfo;
  if (!v?.title) return null;

  // Prefer larger images; upgrade to https
  const raw =
    v.imageLinks?.extraLarge ??
    v.imageLinks?.large ??
    v.imageLinks?.medium ??
    v.imageLinks?.thumbnail ??
    v.imageLinks?.smallThumbnail;
  const imageUrl = raw ? raw.replace(/^http:\/\//, 'https://') : undefined;

  const isbn =
    v.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier ??
    v.industryIdentifiers?.find((i: any) => i.type === 'ISBN_10')?.identifier;

  return {
    title: v.title,
    author: Array.isArray(v.authors) ? v.authors.join(', ') : 'Unknown Author',
    description: v.description ?? '',
    rating: v.averageRating ?? 0,
    reviews: v.ratingsCount ?? 0,
    imageUrl,
    categories: v.categories ?? [],
    isbn,
    pageCount: v.pageCount,
    publishedDate: v.publishedDate,
    googleBooksId: item.id,
  };
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchByGoogleId(id: string): Promise<FetchedBook | null> {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    return parseItem(await r.json());
  } catch {
    return null;
  }
}

async function fetchByIsbn(isbn: string): Promise<FetchedBook | null> {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.items?.[0] ? parseItem(d.items[0]) : null;
  } catch {
    return null;
  }
}

/** Fetch a single book from a URL (Amazon / Google Books / bare ISBN) */
export async function fetchBookByUrl(url: string): Promise<FetchedBook | null> {
  const trimmed = url.trim();

  // Google Books URL
  const gbId = extractGoogleBooksId(trimmed);
  if (gbId) return fetchByGoogleId(gbId);

  // Amazon or bare ISBN
  const rawIsbn = extractAmazonId(trimmed) ?? extractIsbn(trimmed);
  if (rawIsbn) {
    const result = await fetchByIsbn(rawIsbn);
    if (result) return result;
  }

  return null;
}

/** Search books by free-text query — returns up to 8 results */
export async function searchBooks(query: string): Promise<FetchedBook[]> {
  if (!query.trim()) return [];
  const r = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&langRestrict=en&orderBy=relevance`
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error ${r.status}`);
  }
  const d = await r.json();
  return (d.items ?? []).map(parseItem).filter(Boolean) as FetchedBook[];
}
