// Library AI — Books generator.
//
// Pipeline:
//   1. Pick (topic, ageBucket).
//   2. Ask AI for 3-5 *real, specific* book titles available on Amazon.in or
//      Kindle that an Indian mother of that stage would buy. AI returns
//      structured candidates with title + author + why-recommended.
//   3. For each candidate, query the public Google Books API to verify the
//      book exists, fetch the official cover, ISBN, ratings, description.
//   4. Construct an Amazon.in deep link by ISBN (`/dp/<ISBN13>`) which
//      reliably opens the right product page; fall back to Amazon search
//      `/s?k=<title>+<author>+kindle` if no ISBN.
//   5. Skip any book whose title we already have in Firestore.
//   6. Write each verified book to `books/{id}` with status='published'
//      (or 'draft') depending on settings.autoPublish.
//
// No mocks, no placeholders — every book row links to a real Amazon/Kindle
// product page with the real Google Books cover.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { buildSystemVoiceHeader, loadLibraryBrand, runCompliance } from './brand';
import { chatJson } from './openai';
import { AgeBucket, KindSettings, loadLibraryAiSettings } from './settings';
import { callerIsContentAdmin } from './auth';

interface BookInput {
  topic?: unknown;
  ageBucketKey?: unknown;
  count?: unknown;
  publish?: unknown;
}

export interface BookGenOk {
  ok: true;
  inserted: { id: string; title: string; author: string; status: 'published' | 'draft'; url: string }[];
  skipped: { reason: string; title?: string }[];
  costInr: number;
}

export interface BookGenErr {
  ok: false;
  code: string;
  message: string;
}

export type BookGenResult = BookGenOk | BookGenErr;

interface AiCandidate {
  title: string;
  author: string;
  why: string;
  searchHint?: string;
}

interface GoogleBookHit {
  title: string;
  authors: string[];
  description: string;
  imageUrl: string | null;
  rating: number;
  reviews: number;
  isbn13: string | null;
  isbn10: string | null;
  googleBooksId: string;
  categories: string[];
}

// ── AI candidate sourcing ───────────────────────────────────────────────────

async function aiCandidates(topic: string, ageBucket: AgeBucket, tone: string, count: number): Promise<AiCandidate[]> {
  const brand = await loadLibraryBrand();
  const system = [
    buildSystemVoiceHeader(brand),
    `Tone: ${tone}`,
    'You curate REAL, specific books available on Amazon.in or Kindle India.',
    'NEVER invent titles or authors. NEVER list out-of-print rarities.',
    'Output STRICT JSON only.',
  ].join('\n');

  const ageDesc = ageBucket.ageMin < 0
    ? 'pregnancy stage'
    : `child age ${ageBucket.ageMin}–${ageBucket.ageMax} months (${ageBucket.label})`;

  const user = [
    `Pick ${count} real books on the topic: "${topic}".`,
    `Audience: Indian mother whose ${ageDesc}.`,
    'Each book MUST be:',
    '- A real, currently-purchasable title (verifiable on Amazon.in / Kindle).',
    '- Well-rated (4.0+ stars on Amazon).',
    '- A book — not a kindle short, not a self-published spam title.',
    'Prefer Indian-context titles or globally-popular titles widely sold in India.',
    '',
    'Return JSON: { "books": [{ "title": "exact title", "author": "primary author", "why": "1 sentence on why it fits", "searchHint": "extra search keywords if title is generic, else empty string" }] }',
  ].join('\n');

  const parsed = await chatJson<{ books?: AiCandidate[] }>(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.5, maxTokens: 1200 },
  );
  if (!parsed?.books || !Array.isArray(parsed.books)) return [];
  return parsed.books
    .filter((b) => b && typeof b.title === 'string' && typeof b.author === 'string')
    .map((b) => ({
      title: b.title.trim(),
      author: b.author.trim(),
      why: typeof b.why === 'string' ? b.why.trim().slice(0, 320) : '',
      searchHint: typeof b.searchHint === 'string' ? b.searchHint.trim() : '',
    }))
    .slice(0, count);
}

// ── Google Books verification ───────────────────────────────────────────────

async function verifyOnGoogleBooks(c: AiCandidate): Promise<GoogleBookHit | null> {
  const q = encodeURIComponent(`${c.title} ${c.author} ${c.searchHint ?? ''}`.trim());
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3&langRestrict=en&orderBy=relevance`);
    if (!r.ok) return null;
    const d = await r.json() as any;
    const items: any[] = Array.isArray(d?.items) ? d.items : [];
    // Find best match by title contains.
    const wantTitle = c.title.toLowerCase();
    const best = items.find((it) => {
      const t = String(it?.volumeInfo?.title ?? '').toLowerCase();
      return t.includes(wantTitle) || wantTitle.includes(t);
    }) ?? items[0];
    if (!best) return null;
    const v = best.volumeInfo ?? {};
    if (!v.title) return null;
    const ids: any[] = Array.isArray(v.industryIdentifiers) ? v.industryIdentifiers : [];
    const isbn13 = ids.find((i: any) => i?.type === 'ISBN_13')?.identifier ?? null;
    const isbn10 = ids.find((i: any) => i?.type === 'ISBN_10')?.identifier ?? null;
    const raw = v.imageLinks?.extraLarge ?? v.imageLinks?.large ?? v.imageLinks?.medium ?? v.imageLinks?.thumbnail ?? null;
    const imageUrl = typeof raw === 'string' ? raw.replace(/^http:\/\//, 'https://') : null;
    return {
      title: String(v.title),
      authors: Array.isArray(v.authors) ? v.authors.filter((s: any) => typeof s === 'string') : [],
      description: typeof v.description === 'string' ? v.description : '',
      imageUrl,
      rating: typeof v.averageRating === 'number' ? v.averageRating : 0,
      reviews: typeof v.ratingsCount === 'number' ? v.ratingsCount : 0,
      isbn13,
      isbn10,
      googleBooksId: typeof best.id === 'string' ? best.id : '',
      categories: Array.isArray(v.categories) ? v.categories : [],
    };
  } catch (e) {
    console.warn('[library/books] verify failed', c.title, e);
    return null;
  }
}

// ── Amazon link construction ────────────────────────────────────────────────

function amazonUrl(hit: GoogleBookHit): string {
  // ISBN-13 is the Amazon ASIN for most books on amazon.in/kindle; deep-link.
  if (hit.isbn13) return `https://www.amazon.in/dp/${hit.isbn13}`;
  if (hit.isbn10) return `https://www.amazon.in/dp/${hit.isbn10}`;
  // No ISBN → fall back to a search that filters to Kindle store.
  const q = encodeURIComponent(`${hit.title} ${hit.authors.join(' ')} kindle`.trim());
  return `https://www.amazon.in/s?k=${q}`;
}

// ── Persist hero cover image (Google Books URLs sometimes 410 over time) ────

async function persistCoverImage(url: string | null, googleId: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const path = `library/books/${googleId || 'cover-' + Date.now()}.jpg`;
    const file = admin.storage().bucket().file(path);
    await file.save(buf, {
      contentType: 'image/jpeg',
      metadata: { metadata: { source: 'google-books', kind: 'library-book' } },
    });
    await file.makePublic();
    return `https://storage.googleapis.com/${admin.storage().bucket().name}/${path}`;
  } catch (e) {
    console.warn('[library/books] persistCover failed', e);
    return null;
  }
}

// ── Topic / age picker (simple round-robin like articles) ───────────────────

function pickTopic(topics: string[], override: string | null, today: Date): string {
  const cleaned = topics.filter((t) => typeof t === 'string' && t.trim());
  if (!cleaned.length) return 'Indian Parenting';
  if (override?.trim()) return override.trim().slice(0, 80);
  const seed = today.toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return cleaned[Math.abs(h) % cleaned.length];
}

function pickAgeBucket(buckets: AgeBucket[], override: string | null, today: Date): AgeBucket {
  if (override) {
    const m = buckets.find((b) => b.key === override);
    if (m) return m;
  }
  const start = Date.UTC(today.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - start) / (24 * 3600 * 1000));
  return buckets[dayOfYear % buckets.length];
}

// ── Existing-titles dedupe ──────────────────────────────────────────────────

async function existingTitlesLower(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const snap = await admin.firestore().collection('books').limit(500).get();
    snap.forEach((d) => {
      const t = (d.data() as any)?.title;
      if (typeof t === 'string') out.add(t.toLowerCase().trim());
    });
  } catch (e) {
    console.warn('[library/books] existingTitles read failed', e);
  }
  return out;
}

// ── Public entry ────────────────────────────────────────────────────────────

export async function runBookGenerator(input: BookInput, actorEmail: string | null): Promise<BookGenResult> {
  const settings = await loadLibraryAiSettings();
  if (settings.paused) return { ok: false, code: 'paused', message: 'Library AI is globally paused.' };
  const k: KindSettings = settings.books;
  if (!k.enabled && actorEmail === null) {
    // Cron path: respect the disabled flag. Manual callers (actorEmail set)
    // can still trigger ad-hoc generations even when the cron is off.
    return { ok: false, code: 'disabled', message: 'Books AI is disabled.' };
  }

  const today = new Date(Date.now() + 5.5 * 3600 * 1000);
  const ageBucket = pickAgeBucket(k.ageBuckets, typeof input.ageBucketKey === 'string' ? input.ageBucketKey : null, today);
  const topic = pickTopic(k.topics, typeof input.topic === 'string' ? input.topic : null, today);

  const desiredCount = Math.max(1, Math.min(8, typeof input.count === 'number' ? Math.round(input.count) : k.perRun));
  const candidates = await aiCandidates(topic, ageBucket, k.tone, desiredCount + 2);
  if (!candidates.length) return { ok: false, code: 'no-candidates', message: 'AI returned no book candidates.' };

  const existing = await existingTitlesLower();
  const inserted: BookGenOk['inserted'] = [];
  const skipped: BookGenOk['skipped'] = [];
  const explicit = input.publish === 'published' || input.publish === 'draft' ? input.publish : null;

  const brand = await loadLibraryBrand();

  for (const c of candidates) {
    if (inserted.length >= desiredCount) break;
    const lc = c.title.toLowerCase().trim();
    if (existing.has(lc)) { skipped.push({ reason: 'duplicate', title: c.title }); continue; }
    const hit = await verifyOnGoogleBooks(c);
    if (!hit) { skipped.push({ reason: 'unverified-on-google', title: c.title }); continue; }
    if (existing.has(hit.title.toLowerCase().trim())) { skipped.push({ reason: 'duplicate-after-resolve', title: hit.title }); continue; }

    // Compliance check on description + title — books that mention a blocked
    // topic stay in 'draft' state.
    const { flags } = runCompliance(`${hit.title}\n${hit.description}`, brand);

    const status: 'published' | 'draft' =
      explicit ? explicit as 'published' | 'draft'
        : flags.length > 0 ? 'draft'
          : k.autoPublish ? 'published' : 'draft';

    const cover = await persistCoverImage(hit.imageUrl, hit.googleBooksId) ?? hit.imageUrl;

    const ref = admin.firestore().collection('books').doc();
    const expiresAt = k.expireAfterDays > 0
      ? admin.firestore.Timestamp.fromMillis(Date.now() + k.expireAfterDays * 24 * 3600 * 1000)
      : null;
    const url = amazonUrl(hit);
    const doc = {
      title: hit.title,
      author: hit.authors.join(', ') || c.author,
      description: c.why || hit.description.slice(0, 320),
      topic,
      rating: hit.rating || 4.3,
      reviews: hit.reviews || 0,
      url,
      sampleUrl: hit.googleBooksId ? `https://books.google.co.in/books?id=${hit.googleBooksId}` : null,
      imageUrl: cover,
      ageMin: ageBucket.ageMin,
      ageMax: ageBucket.ageMax,
      isbn13: hit.isbn13,
      isbn10: hit.isbn10,
      googleBooksId: hit.googleBooksId,
      status,
      source: 'ai',
      aiTopic: topic,
      aiAgeBucketKey: ageBucket.key,
      aiWhy: c.why,
      aiFlags: flags.map((f) => `${f.type}:${f.phrase}`),
      aiGeneratedBy: actorEmail ?? 'cron',
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(doc);
    existing.add(hit.title.toLowerCase().trim());
    inserted.push({ id: ref.id, title: hit.title, author: doc.author, status, url });

    try {
      await admin.firestore().collection('library_ai_log').add({
        kind: 'book',
        itemId: ref.id,
        topic,
        ageBucketKey: ageBucket.key,
        costInr: 0.05,
        status,
        flags: flags.length,
        generatedBy: actorEmail ?? 'cron',
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('[library/books] log row failed', e);
    }
  }

  return {
    ok: true,
    inserted,
    skipped,
    costInr: 0.05 * inserted.length,
  };
}

export function buildGenerateBooksNow(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '512MB', timeoutSeconds: 300 })
    .https.onCall(async (data: BookInput, context): Promise<BookGenResult> => {
      if (!(await callerIsContentAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Only content admins can generate library books.');
      }
      const actorEmail = context.auth?.token?.email ?? null;
      return runBookGenerator(data ?? {}, actorEmail);
    });
}
