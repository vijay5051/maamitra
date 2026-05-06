import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

interface ArticleDoc {
  title?: unknown;
  preview?: unknown;
  body?: unknown;
  topic?: unknown;
  imageUrl?: unknown;
  url?: unknown;
  status?: unknown;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isPublishedArticle(data: ArticleDoc | null | undefined): data is ArticleDoc {
  return !!data && asString(data.status) === 'published';
}

function becamePublished(before: ArticleDoc | null, after: ArticleDoc): boolean {
  return isPublishedArticle(after) && (!before || asString(before.status) !== 'published');
}

function buildArticleLink(articleId: string, article: ArticleDoc): string {
  const external = asString(article.url);
  if (/^https?:\/\//i.test(external)) return external;
  const sp = new URLSearchParams({ tab: 'read', articleId });
  return `https://maamitra.co.in/library?${sp.toString()}`;
}

function buildSummary(article: ArticleDoc): string {
  const preview = asString(article.preview);
  if (preview) return preview.slice(0, 260);

  const body = asString(article.body)
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  if (!body) return '';
  return body.slice(0, 240).replace(/\s+\S*$/, '').trim() + '…';
}

function extractHashtags(topic: string): string[] {
  const cleaned = topic
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => `#${part.charAt(0).toUpperCase()}${part.slice(1)}`);
  const seed = ['#MaaMitra', '#ParentingTips', '#IndianMoms'];
  return Array.from(new Set([...cleaned, ...seed])).slice(0, 6);
}

async function loadBrandHashtags(): Promise<string[]> {
  try {
    const snap = await admin.firestore().doc('marketing_brand/main').get();
    const raw = snap.exists ? (snap.data() as any)?.hashtags : [];
    return Array.isArray(raw)
      ? raw.filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 6)
      : [];
  } catch (e) {
    console.warn('[library/socialDrafts] brand hashtag load failed', e);
    return [];
  }
}

async function upsertMarketingDraft(articleId: string, article: ArticleDoc): Promise<void> {
  const title = asString(article.title);
  const imageUrl = asString(article.imageUrl);
  if (!title || !imageUrl) {
    console.warn(`[library/socialDrafts] skip ${articleId}: missing title or image`);
    return;
  }

  const topic = asString(article.topic);
  const link = buildArticleLink(articleId, article);
  const summary = buildSummary(article);
  const brandTags = await loadBrandHashtags();
  const hashtags = brandTags.length ? brandTags : extractHashtags(topic || title);
  const captionParts = [
    title,
    summary,
    `Read the full article: ${link}`,
    hashtags.join(' '),
  ].filter(Boolean);
  const caption = captionParts.join('\n\n').slice(0, 2200);
  const draftId = `library-article-${articleId}`;

  await admin.firestore().collection('marketing_drafts').doc(draftId).set({
    status: 'pending_review',
    kind: 'image',
    themeKey: 'studio',
    themeLabel: 'Library Article',
    caption,
    headline: title.slice(0, 80),
    assets: [{
      url: imageUrl,
      index: 0,
      template: 'libraryArticle',
      storagePath: '',
    }],
    platforms: ['instagram', 'facebook'],
    scheduledAt: null,
    postedAt: null,
    postPermalinks: {},
    publishError: null,
    safetyFlags: [],
    personaId: null,
    personaLabel: null,
    pillarId: null,
    pillarLabel: null,
    eventId: null,
    eventLabel: null,
    locale: 'english_only',
    imagePrompt: `Library article promo for: ${title}`,
    imageSource: 'library-article',
    costInr: 0,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    generatedBy: 'library-article-sync',
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectReason: null,
    schemaVersion: 2,
    sourceTool: 'library-article-sync',
    sourceArticleId: articleId,
    sourceArticleTitle: title,
    linkUrl: link,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await admin.firestore().doc(`articles/${articleId}`).set({
    socialDraftId: draftId,
    socialDraftUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export function buildSyncArticleSocialDraft() {
  return functions
    .runWith({ memory: '256MB', timeoutSeconds: 60 })
    .firestore.document('articles/{articleId}')
    .onWrite(async (change, context) => {
      const before = change.before.exists ? (change.before.data() as ArticleDoc) : null;
      const after = change.after.exists ? (change.after.data() as ArticleDoc) : null;
      if (!after || !isPublishedArticle(after)) return;
      if (!becamePublished(before, after)) return;

      try {
        await upsertMarketingDraft(context.params.articleId as string, after);
      } catch (e) {
        console.error('[library/socialDrafts] sync failed', context.params.articleId, e);
      }
    });
}
