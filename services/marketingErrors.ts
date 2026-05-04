/**
 * marketingErrors — translates raw API / Cloud Function error codes
 * into plain-English copy admins can act on.
 *
 * Studio v2: replaces patterns like `${label} failed: ${e.message}` (which
 * leak Graph error codes / Cloud Function jargon) with friendly messages.
 *
 * Pattern: pass the action label ("Publish", "Generate", "Schedule") + the
 * raw error or response. Returns a 1-2 sentence user message. Never leaks
 * codes; the raw error is logged via console.warn for devs.
 */

export interface CallableErrorShape {
  code?: string;
  message?: string;
}

const CODE_MAP: Record<string, string> = {
  // Publish path
  'no-credentials':       'Instagram or Facebook isn\'t connected. Open Settings to reconnect.',
  'no-fb-credentials':    'Facebook Page isn\'t connected. Open Settings to reconnect.',
  'no-page-token':        'We lost access to your Facebook Page. Reconnect it in Settings.',
  'no-asset':             'This draft has no image yet — try Regenerate.',
  'no-caption':           'This draft has no caption yet — open it and write one.',
  'media-create-failed':  'Instagram didn\'t accept that image. Try a different one or regenerate.',
  'publish-failed':       'Couldn\'t publish to Instagram right now. Try again in a moment.',
  'fb-publish-failed':    'Couldn\'t publish to Facebook right now. Try again in a moment.',
  'container-error':      'Instagram had trouble processing that image. Try a different one.',
  'container-timeout':    'Instagram is slow today. Tap Retry in a minute.',
  'status-poll-failed':   'Lost connection while publishing. Try again — it usually works the second time.',
  'no-post-id':           'Something odd happened on Meta\'s end. Try again.',
  'no-media-id':          'Something odd happened on Meta\'s end. Try again.',
  'no-draft':             'This draft isn\'t there anymore. Refresh the list.',
  'wrong-status':         'This draft can\'t be published right now — its status changed.',

  // Generation path
  'missing-strategy':     'Set up Strategy in Settings (personas + pillars) before generating.',
  'render-failed':        'Image rendering failed. Try Regenerate or pick a different template.',
  'caption-failed':       'Caption AI didn\'t respond. Try Regenerate.',
  'cost-cap-reached':     'Daily cost cap reached. Increase it in Settings → Strategy → Cost caps.',

  // Inbox / replies
  'no-thread':            'This conversation isn\'t there anymore. Refresh.',
  'send-failed':          'Couldn\'t send the reply. Try again.',
  'rate-limited':         'Meta is rate-limiting us — wait a minute, then try again.',

  // Boost
  'missing-creds':        'Set up your ad account in Settings → Connections.',
  'boost-failed':         'Boost couldn\'t start. Check your budget and try again.',

  // Generic
  'permission-denied':    'You\'re not allowed to do that. Ask an admin.',
  'unauthenticated':      'Please sign in again.',
  'unavailable':          'Service is temporarily unavailable. Try again in a moment.',
  'deadline-exceeded':    'That took too long. Try again.',
  'internal':             'Something went wrong on our side. Try again.',
};

/**
 * Convert any error / callable response into a friendly message.
 * Always returns a non-empty string — defaults to "Something went wrong" tone
 * matched to the action label.
 */
export function friendlyError(action: string, err: unknown): string {
  // Dev observability — keep raw codes in console for debugging.
  if (typeof console !== 'undefined') {
    console.warn(`[marketing] ${action} failed:`, err);
  }

  const code = pickCode(err);
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const msg = pickMessage(err);
  // If we have a message that's short + already friendly (no codes / no
  // weird-looking strings), surface it directly.
  if (msg && isUserSafe(msg)) return msg;

  // Fallback by action
  return defaultByAction(action);
}

function pickCode(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'object') {
    const e = err as any;
    if (typeof e.code === 'string') return e.code;
    if (typeof e.error?.code === 'string') return e.error.code;
  }
  return null;
}

function pickMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as any;
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error?.message === 'string') return e.error.message;
  }
  return null;
}

/** Heuristic: only show error.message inline if it doesn't look technical. */
function isUserSafe(msg: string): boolean {
  if (msg.length > 160) return false;
  // Filter Meta error-code shapes like "(#190) error_subcode=2069032"
  if (/\(#\d+\)/.test(msg)) return false;
  if (/error_subcode/i.test(msg)) return false;
  // Filter Graph version-y / endpoint-y strings
  if (/graph\.|firebase|firestore|cloud function|callable|hash-mismatch/i.test(msg)) return false;
  if (/^[A-Z_]+$/.test(msg)) return false; // ALL_CAPS_CODE
  return true;
}

function defaultByAction(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('publish'))    return "Couldn't publish. Try again in a moment.";
  if (a.includes('generate') || a.includes('regenerate')) return "Couldn't generate. Try again or change the prompt.";
  if (a.includes('schedule'))   return "Couldn't schedule. Try a different date.";
  if (a.includes('save'))       return "Couldn't save. Your internet may be off.";
  if (a.includes('delete'))     return "Couldn't delete. Try again.";
  if (a.includes('approve'))    return "Couldn't approve. Try again.";
  if (a.includes('reject'))     return "Couldn't reject. Try again.";
  if (a.includes('boost'))      return "Couldn't start boost. Try again.";
  if (a.includes('reply'))      return "Couldn't send the reply. Try again.";
  return "Something went wrong. Try again.";
}

/**
 * For the persistent `draft.publishError` field shown on failed drafts — same
 * idea, but tailored for "explain why this didn't go out yet" copy.
 */
export function friendlyPublishError(raw: string | null): string | null {
  if (!raw) return null;
  // Try to extract a code-shape from raw strings like "IG no-credentials: …"
  const dashCodeMatch = raw.match(/(no-[a-z-]+|cost-cap-reached|publish-failed|container-error|container-timeout|missing-creds|wrong-status|fb-publish-failed)/);
  if (dashCodeMatch && CODE_MAP[dashCodeMatch[1]]) return CODE_MAP[dashCodeMatch[1]];

  if (isUserSafe(raw)) return raw;
  return "Last attempt didn't succeed. Tap Retry to try again.";
}
