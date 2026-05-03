// Admin-side AI helpers — uses the same Cloudflare Worker that powers the
// user-facing chat, but with task-specific system prompts and no chat
// context. Two endpoints today:
//   - draftTicketReply : suggest a friendly + factual reply to a support
//                        ticket. Admin reviews + edits before sending.
//   - summarizeUser    : 30-day activity summary for a user, for admin
//                        triage / outreach.
//
// Both call the worker directly (not via sendMessage) because we don't
// want to feed the chat-personality system prompt into a triage task.
// They share the worker auth pattern: Firebase ID token in the header.

import { auth } from './firebase';

const WORKER_URL = process.env.EXPO_PUBLIC_CLAUDE_WORKER_URL ?? '';

export const isAdminAiConfigured = (): boolean => !!WORKER_URL;

interface WorkerCallOpts {
  systemPrompt: string;
  userPrompt: string;
  /** Optional max output. The worker enforces its own caps; this is a hint. */
  maxTokensHint?: number;
}

async function callWorker(opts: WorkerCallOpts): Promise<string> {
  if (!WORKER_URL) {
    throw new Error('AI worker not configured. Set EXPO_PUBLIC_CLAUDE_WORKER_URL.');
  }
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in.');
  const idToken = await user.getIdToken();

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      systemPrompt: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited — try again in a moment.');
    if (res.status === 401) throw new Error('Session expired — sign out and back in.');
    throw new Error(`Worker returned ${res.status}`);
  }
  const data = await res.json();
  const content = data?.content?.[0];
  if (content?.type === 'text') return String(content.text).trim();
  throw new Error('Empty response from AI worker.');
}

// ─── 1) Draft a ticket reply ──────────────────────────────────────────────
export interface TicketDraftInput {
  subject: string;
  message: string;
  userName?: string;
  /** Prior replies from the admin side, oldest first. */
  priorReplies?: Array<{ from: 'user' | 'admin'; text: string }>;
}

export async function draftTicketReply(t: TicketDraftInput): Promise<string> {
  const system = `You are a senior support agent for MaaMitra, an AI mitra for Indian mothers.
Draft a single concise reply to the user's support ticket. Be warm and respectful, never patronising.
- Address the user by first name if known.
- Acknowledge the issue, then propose 1–2 concrete next steps.
- If you don't have enough info to resolve, ASK for the specific detail you need.
- Avoid corporate fluff. Match how a thoughtful Indian customer-success person would write.
- Output the reply text only — no greeting label, no "From: support" boilerplate, no markdown.
- Keep it under 120 words.`;

  const ctx = `Ticket subject: ${t.subject}
User name: ${t.userName ?? 'unknown'}

User's message:
"""
${t.message}
"""

Earlier exchanges:
${(t.priorReplies ?? []).map((r) => `[${r.from}] ${r.text}`).join('\n') || '(none)'}`;

  return callWorker({ systemPrompt: system, userPrompt: ctx, maxTokensHint: 400 });
}

// ─── 2) 30-day user summary ───────────────────────────────────────────────
export interface UserSummaryInput {
  name?: string;
  email?: string;
  state?: string;
  stage?: string;
  parentGender?: string;
  kidsCount?: number;
  daysSinceSignup?: number;
  postCount?: number;
  commentCount?: number;
  conversationCount?: number;
  recentPostExcerpts?: string[];
  recentTicketSubjects?: string[];
}

export async function summarizeUser(u: UserSummaryInput): Promise<string> {
  const system = `You are an analyst writing a one-paragraph triage summary of a MaaMitra user for an admin.
Be concise and factual. Don't speculate. If a field is missing, skip it.
Output: a single paragraph, 4–6 sentences. Plain text. No markdown.
Lead with stage / kid count / state. End with a short note on engagement signal (active vs quiet) if there's enough data.`;

  const facts = `Name: ${u.name ?? 'unknown'}
Email: ${u.email ?? '—'}
State: ${u.state ?? '—'}
Stage: ${u.stage ?? '—'}
Parent role: ${u.parentGender ?? '—'}
Kids: ${u.kidsCount ?? 0}
Signed up: ${u.daysSinceSignup != null ? `${u.daysSinceSignup} days ago` : '—'}
Posts: ${u.postCount ?? 0}
Comments: ${u.commentCount ?? 0}
DMs: ${u.conversationCount ?? 0}
Recent post excerpts: ${(u.recentPostExcerpts ?? []).slice(0, 3).join(' | ') || '(none)'}
Recent ticket subjects: ${(u.recentTicketSubjects ?? []).slice(0, 3).join(' | ') || '(none)'}`;

  return callWorker({ systemPrompt: system, userPrompt: facts, maxTokensHint: 350 });
}
