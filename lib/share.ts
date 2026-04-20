import { Platform, Share } from 'react-native';

/**
 * Build a public, copy-pasteable URL for a single community post. This is
 * the link users share to their WhatsApp / Instagram / X / etc. The target
 * page (app/post/[id].tsx) renders the post and, when the visitor is not
 * signed in, nudges them to install/sign up.
 *
 * The base URL comes from the browser's origin on web; on native we fall
 * back to the hosted URL. Keep this in sync with Firebase Hosting.
 */
const FALLBACK_BASE = 'https://maa-mitra-7kird8.web.app';

function baseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return FALLBACK_BASE;
}

export function buildPostShareUrl(postId: string): string {
  return `${baseUrl()}/post/${encodeURIComponent(postId)}`;
}

export interface SharePostPayload {
  postId: string;
  authorName: string;
  text: string;
}

/** A short teaser string for the social preview + copy-to-clipboard body. */
function teaser(payload: SharePostPayload): string {
  const snippet = (payload.text ?? '').trim().replace(/\s+/g, ' ').slice(0, 140);
  const tail = (payload.text ?? '').length > 140 ? '…' : '';
  return `${payload.authorName} on MaaMitra: "${snippet}${tail}"`;
}

/**
 * Best-effort social share. Tries, in order:
 *   1. Web Share API (`navigator.share`) — works on iOS/Android Safari &
 *      Chrome; opens the system share sheet with WhatsApp/Instagram/X/etc.
 *   2. Clipboard copy — desktop browsers or web views without share API.
 *   3. React Native Share (native) — iOS/Android apps.
 *
 * Returns `{ method, ok }` so the caller can show an appropriate toast
 * ("Shared" / "Link copied" / "Sharing not supported").
 */
export async function sharePost(
  payload: SharePostPayload,
): Promise<{ method: 'web-share' | 'clipboard' | 'native-share' | 'none'; ok: boolean }> {
  const url = buildPostShareUrl(payload.postId);
  const title = 'MaaMitra — a post worth reading';
  const body = teaser(payload);
  const fullText = `${body}\n\n${url}`;

  // 1. Web Share API — modern mobile browsers.
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).share === 'function'
  ) {
    try {
      await (navigator as any).share({ title, text: body, url });
      return { method: 'web-share', ok: true };
    } catch (err: any) {
      // User cancelled = not an error state — just don't fall through to
      // copying, the intent was explicit.
      if (err?.name === 'AbortError') return { method: 'web-share', ok: false };
      // Any other failure (permission, transient) → fall through to clipboard.
    }
  }

  // 2. Clipboard copy — best fallback for desktop web.
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
    try {
      await (navigator as any).clipboard.writeText(fullText);
      return { method: 'clipboard', ok: true };
    } catch (_) {
      // Clipboard denied (permission / insecure context) — fall through.
    }
  }

  // 3. React Native Share — native iOS/Android.
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message: fullText, title, url });
      return { method: 'native-share', ok: true };
    } catch (_) {
      /* ignore */
    }
  }

  return { method: 'none', ok: false };
}
