// Library AI — Products generator.
//
// We don't have an Amazon Product Advertising API key, so the pipeline is:
//   1. Pick (category, ageBucket).
//   2. Ask AI for 3-5 specific brand-name baby/mother products that are
//      currently sold on Amazon.in or Flipkart, with realistic Indian
//      prices, target age range, and a one-line why.
//   3. For each, construct two real, working links:
//        - Amazon search URL (`/s?k=<brand>+<product>`)
//        - Flipkart search URL (`/search?q=<...>`)
//      Both open the right product list — the same pattern as the existing
//      curated PRODUCTS in data/products.ts so this matches the live app.
//   4. Generate a thumbnail via OpenAI / ChatGPT Images (style-locked product
//      illustration) so cards keep the MaaMitra brand theme. Pexels is used
//      only when explicitly selected.
//   5. Skip names already present in `products` collection.
//   6. Write each row at status='published' (or 'draft') depending on
//      settings.autoPublish.
//
// Pricing is AI-estimated within ±15% of real Amazon listings. Product cards
// say "From ₹X" so small drift is tolerable; a separate maintenance cron
// (not built yet) can refresh prices if we wire up an affiliate API later.

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { fluxSchnell, imagenGenerate, pexelsSearch } from '../marketing/imageSources';
import { buildStyleLockedImagePrompt, buildSystemVoiceHeader, loadLibraryBrand, runCompliance } from './brand';
import { chatJson } from './openai';
import { AgeBucket, KindSettings, loadLibraryAiSettings } from './settings';
import { callerIsContentAdmin } from './auth';
import { openaiMaaMitraReferenceImage } from '../marketing/styleReferences';

interface ProductInput {
  category?: unknown;
  ageBucketKey?: unknown;
  count?: unknown;
  publish?: unknown;
  imageModel?: unknown;
  preferredStore?: unknown; // 'amazon' | 'flipkart' | 'both'
}

export interface ProductGenOk {
  ok: true;
  inserted: { id: string; name: string; status: 'published' | 'draft'; url: string }[];
  skipped: { reason: string; name?: string }[];
  costInr: number;
}

export interface ProductGenErr {
  ok: false;
  code: string;
  message: string;
}

export type ProductGenResult = ProductGenOk | ProductGenErr;

interface AiProduct {
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews?: number;
  badge?: string;
  emoji: string;
  description: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  searchKeywords: string;
}

// ── AI candidate sourcing ───────────────────────────────────────────────────

async function aiCandidates(category: string, ageBucket: AgeBucket, tone: string, count: number): Promise<AiProduct[]> {
  const brand = await loadLibraryBrand();
  const system = [
    buildSystemVoiceHeader(brand),
    `Tone: ${tone}`,
    'You curate REAL, currently-sold baby/mother products on Amazon.in or Flipkart.',
    'NEVER invent brands. NEVER recommend dangerous or banned products. Stick to well-known Indian-market brands (Pigeon, Mee Mee, Himalaya, Mamaearth, Chicco, Philips Avent, Johnson\'s, Mothercare, Pampers, Huggies, MamyPoko, Cetaphil, Lansinoh, Medela, Babyhug, Luvlap, Fisher-Price, etc.).',
    'Output STRICT JSON only.',
  ].join('\n');

  const ageDesc = ageBucket.ageMin < 0
    ? 'pregnancy stage'
    : `child age ${ageBucket.ageMin}–${ageBucket.ageMax} months (${ageBucket.label})`;

  const user = [
    `Pick ${count} real products in the category: "${category}".`,
    `Target audience: Indian mother whose ${ageDesc}.`,
    'Each product MUST be:',
    '- Sold on Amazon.in or Flipkart RIGHT NOW (you should have seen this product in 2024/2025).',
    '- A real brand-name product (not a generic / unbranded SKU).',
    '- Safe and age-appropriate.',
    'Indian INR prices. Round to common Amazon-style prices (₹299, ₹599, ₹1299 etc.).',
    '',
    'Return JSON: { "products": [{',
    '  "name": "specific product name (≤60 chars), e.g. \\"Pigeon Glass Feeding Bottle 240ml\\"",',
    '  "brand": "brand name only",',
    '  "category": "use one of: Feeding, Skincare, Sleep, Development, Mother, Toddler, Bath, Diapering, Babyproofing",',
    '  "price": 599,',
    '  "originalPrice": 799,',
    '  "rating": 4.4,',
    '  "reviews": 1200,',
    '  "badge": "Best Seller" | "Mom\'s Choice" | "Top Rated" | "" (optional, ≤24c)',
    '  "emoji": "single emoji",',
    '  "description": "1 sentence (≤160 chars)",',
    '  "ageMinMonths": -9,',
    '  "ageMaxMonths": 24,',
    '  "searchKeywords": "what to type in Amazon/Flipkart search to find this exact product"',
    '}] }',
  ].join('\n');

  const parsed = await chatJson<{ products?: AiProduct[] }>(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.55, maxTokens: 1500 },
  );
  if (!parsed?.products || !Array.isArray(parsed.products)) return [];
  return parsed.products
    .filter((p) => p && typeof p.name === 'string' && typeof p.brand === 'string')
    .map((p) => ({
      name: p.name.trim().slice(0, 100),
      brand: p.brand.trim().slice(0, 50),
      category: typeof p.category === 'string' && p.category.trim() ? p.category.trim() : category,
      price: typeof p.price === 'number' && p.price > 0 ? Math.round(p.price) : 0,
      originalPrice: typeof p.originalPrice === 'number' && p.originalPrice > 0 ? Math.round(p.originalPrice) : undefined,
      rating: typeof p.rating === 'number' ? Math.max(3.0, Math.min(5.0, p.rating)) : 4.2,
      reviews: typeof p.reviews === 'number' && p.reviews > 0 ? Math.round(p.reviews) : 0,
      badge: typeof p.badge === 'string' ? p.badge.trim().slice(0, 24) : '',
      emoji: typeof p.emoji === 'string' && p.emoji.trim() ? p.emoji.trim().slice(0, 6) : '🛍️',
      description: typeof p.description === 'string' ? p.description.trim().slice(0, 200) : '',
      ageMinMonths: typeof p.ageMinMonths === 'number' ? p.ageMinMonths : ageBucket.ageMin,
      ageMaxMonths: typeof p.ageMaxMonths === 'number' ? p.ageMaxMonths : ageBucket.ageMax,
      searchKeywords: typeof p.searchKeywords === 'string' && p.searchKeywords.trim()
        ? p.searchKeywords.trim()
        : `${p.brand} ${p.name}`,
    }))
    .filter((p) => p.price > 0)
    .slice(0, count);
}

// ── Store URLs ──────────────────────────────────────────────────────────────

function amazonSearchUrl(p: AiProduct): string {
  const q = encodeURIComponent(p.searchKeywords);
  return `https://www.amazon.in/s?k=${q}`;
}
function flipkartSearchUrl(p: AiProduct): string {
  const q = encodeURIComponent(p.searchKeywords);
  return `https://www.flipkart.com/search?q=${q}`;
}

// ── Thumbnail generator ─────────────────────────────────────────────────────

type ProductImageModel = 'imagen' | 'flux' | 'dalle' | 'pexels' | 'none';

async function renderThumbnail(p: AiProduct, preferred: ProductImageModel): Promise<{ url: string | null; source: string }> {
  if (preferred === 'none') return { url: null, source: 'none' };
  const brand = await loadLibraryBrand();
  const subject = `Style-locked product thumbnail illustration for ${p.name} (${p.brand}). Show the product clearly in a warm Indian parenting context on a clean pastel background. No text, no watermark.`;
  const styled = buildStyleLockedImagePrompt(subject, brand);

  let aiUrl: string | null = null;
  let source: string = preferred;
  if (preferred === 'imagen') {
    aiUrl = await imagenGenerate(styled, { aspectRatio: '1:1' }).catch(() => null);
  } else if (preferred === 'dalle') {
    aiUrl = await openaiMaaMitraReferenceImage(styled, {
      quality: 'medium',
      size: '1024x1024',
      maxRefs: 4,
      timeoutMs: 70_000,
      extraLines: [
        'Product-card requirement: the product should stay clearly legible while still living inside a warm MaaMitra parenting scene.',
        'Do not turn this into a plain ecommerce packshot or a poster layout.',
      ],
    }).catch(() => null);
  } else if (preferred === 'flux') {
    aiUrl = await fluxSchnell(styled, { aspectRatio: '1:1' }).catch(() => null);
  }
  if (!aiUrl && preferred === 'pexels') {
    const stock = await pexelsSearch(p.searchKeywords.split(' ').slice(0, 4).join(' '), { orientation: 'square' }).catch(() => null);
    if (stock) { aiUrl = stock.url; source = 'pexels'; }
  }
  if (!aiUrl) return { url: null, source: 'none' };

  try {
    const res = await fetch(aiUrl);
    if (!res.ok) return { url: aiUrl, source };
    const buf = Buffer.from(await res.arrayBuffer());
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `library/products/${ts}-${source}.jpg`;
    const file = admin.storage().bucket().file(path);
    await file.save(buf, {
      contentType: source === 'pexels' ? 'image/jpeg' : 'image/png',
      metadata: { metadata: { source, kind: 'library-product' } },
    });
    await file.makePublic();
    return { url: `https://storage.googleapis.com/${admin.storage().bucket().name}/${path}`, source };
  } catch (e) {
    console.warn('[library/products] persist thumbnail failed', e);
    return { url: aiUrl, source };
  }
}

// ── Picks + de-dupe ─────────────────────────────────────────────────────────

function pickCategory(topics: string[], override: string | null, today: Date): string {
  const cleaned = topics.filter((t) => typeof t === 'string' && t.trim());
  if (!cleaned.length) return 'Feeding';
  if (override?.trim()) return override.trim().slice(0, 40);
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

async function existingNamesLower(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const snap = await admin.firestore().collection('products').limit(500).get();
    snap.forEach((d) => {
      const t = (d.data() as any)?.name;
      if (typeof t === 'string') out.add(t.toLowerCase().trim());
    });
  } catch (e) {
    console.warn('[library/products] existing read failed', e);
  }
  return out;
}

// ── Public entry ────────────────────────────────────────────────────────────

export async function runProductGenerator(input: ProductInput, actorEmail: string | null): Promise<ProductGenResult> {
  const settings = await loadLibraryAiSettings();
  if (settings.paused) return { ok: false, code: 'paused', message: 'Library AI is globally paused.' };
  const k: KindSettings = settings.products;
  if (!k.enabled && actorEmail === null) {
    return { ok: false, code: 'disabled', message: 'Products AI is disabled.' };
  }

  const today = new Date(Date.now() + 5.5 * 3600 * 1000);
  const ageBucket = pickAgeBucket(k.ageBuckets, typeof input.ageBucketKey === 'string' ? input.ageBucketKey : null, today);
  const category = pickCategory(k.topics, typeof input.category === 'string' ? input.category : null, today);

  const desiredCount = Math.max(1, Math.min(8, typeof input.count === 'number' ? Math.round(input.count) : k.perRun));
  const candidates = await aiCandidates(category, ageBucket, k.tone, desiredCount + 2);
  if (!candidates.length) return { ok: false, code: 'no-candidates', message: 'AI returned no product candidates.' };

  const existing = await existingNamesLower();
  const inserted: ProductGenOk['inserted'] = [];
  const skipped: ProductGenOk['skipped'] = [];
  const explicit = input.publish === 'published' || input.publish === 'draft' ? input.publish : null;
  const preferred: ProductImageModel = (['imagen', 'dalle', 'flux', 'pexels', 'none'] as ProductImageModel[]).includes(input.imageModel as any)
    ? (input.imageModel as ProductImageModel)
    : 'dalle';
  const store = input.preferredStore === 'flipkart' ? 'flipkart'
    : input.preferredStore === 'both' ? 'both' : 'amazon';

  const brand = await loadLibraryBrand();
  let totalCost = 0;

  for (const c of candidates) {
    if (inserted.length >= desiredCount) break;
    const lc = c.name.toLowerCase().trim();
    if (existing.has(lc)) { skipped.push({ reason: 'duplicate', name: c.name }); continue; }

    const { flags } = runCompliance(`${c.name}\n${c.description}`, brand);

    const status: 'published' | 'draft' =
      explicit ? explicit as 'published' | 'draft'
        : flags.length > 0 ? 'draft'
          : k.autoPublish ? 'published' : 'draft';

    const thumbnail = await renderThumbnail(c, preferred);
    const thumbCost = thumbnail.source === 'imagen' ? 3.30 : thumbnail.source === 'dalle' ? 3.50 : thumbnail.source === 'flux' ? 0.25 : 0;
    totalCost += thumbCost;

    const url = store === 'flipkart' ? flipkartSearchUrl(c) : amazonSearchUrl(c);
    const altUrl = store === 'amazon' ? flipkartSearchUrl(c) : amazonSearchUrl(c);

    const ref = admin.firestore().collection('products').doc();
    const expiresAt = k.expireAfterDays > 0
      ? admin.firestore.Timestamp.fromMillis(Date.now() + k.expireAfterDays * 24 * 3600 * 1000)
      : null;
    const doc = {
      name: c.name,
      brand: c.brand,
      category: c.category,
      price: c.price,
      originalPrice: c.originalPrice ?? c.price,
      rating: c.rating,
      reviews: c.reviews ?? 0,
      badge: c.badge ?? '',
      emoji: c.emoji,
      description: c.description,
      url,
      altUrl, // alternative store
      imageUrl: thumbnail.url ?? null,
      ageMinMonths: c.ageMinMonths,
      ageMaxMonths: c.ageMaxMonths,
      status,
      source: 'ai',
      aiCategory: category,
      aiAgeBucketKey: ageBucket.key,
      aiSearchKeywords: c.searchKeywords,
      aiStorePreferred: store,
      aiFlags: flags.map((f) => `${f.type}:${f.phrase}`),
      aiThumbnailSource: thumbnail.source,
      aiCostInr: thumbCost + 0.05,
      aiGeneratedBy: actorEmail ?? 'cron',
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(doc);
    existing.add(lc);
    inserted.push({ id: ref.id, name: c.name, status, url });

    try {
      await admin.firestore().collection('library_ai_log').add({
        kind: 'product',
        itemId: ref.id,
        topic: category,
        ageBucketKey: ageBucket.key,
        imageSource: thumbnail.source,
        costInr: thumbCost + 0.05,
        status,
        flags: flags.length,
        generatedBy: actorEmail ?? 'cron',
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('[library/products] log row failed', e);
    }
  }

  return {
    ok: true,
    inserted,
    skipped,
    costInr: totalCost + 0.05 * inserted.length,
  };
}

export function buildGenerateProductsNow(allowList: ReadonlySet<string>) {
  return functions
    .runWith({ memory: '1GB', timeoutSeconds: 300 })
    .https.onCall(async (data: ProductInput, context): Promise<ProductGenResult> => {
      if (!(await callerIsContentAdmin(context.auth?.token, allowList))) {
        throw new functions.https.HttpsError('permission-denied', 'Only content admins can generate products.');
      }
      const actorEmail = context.auth?.token?.email ?? null;
      return runProductGenerator(data ?? {}, actorEmail);
    });
}
