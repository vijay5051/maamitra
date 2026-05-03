// Centralised enums + labels + colour mapping for every status / kind that
// shows up in the admin panel. Magic strings used to be inlined across 17
// screens; one typo there silently broke a Firestore query. This is the
// single source of truth — every screen imports from here.

import { Colors } from '../constants/theme';

// ─── Support tickets ───────────────────────────────────────────────────────
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: Colors.warning,
  in_progress: Colors.primary,
  resolved: Colors.success,
  closed: Colors.textMuted,
};

// ─── Community posts ───────────────────────────────────────────────────────
export const POST_STATUSES = ['live', 'pending', 'hidden', 'removed'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  live: 'Live',
  pending: 'Pending review',
  hidden: 'Hidden',
  removed: 'Removed',
};

export const POST_STATUS_COLORS: Record<PostStatus, string> = {
  live: Colors.success,
  pending: Colors.warning,
  hidden: Colors.textMuted,
  removed: Colors.error,
};

// ─── Hide reasons (used when moderating posts/comments) ────────────────────
export const HIDE_REASONS = [
  'spam',
  'harassment',
  'medical_misinfo',
  'inappropriate',
  'off_topic',
  'duplicate',
  'other',
] as const;
export type HideReason = (typeof HIDE_REASONS)[number];

export const HIDE_REASON_LABELS: Record<HideReason, string> = {
  spam: 'Spam / promotion',
  harassment: 'Harassment / abuse',
  medical_misinfo: 'Medical misinformation',
  inappropriate: 'Inappropriate content',
  off_topic: 'Off-topic',
  duplicate: 'Duplicate post',
  other: 'Other',
};

// ─── Audit log actions ─────────────────────────────────────────────────────
// New actions MUST be added here with a label so the audit screen renders
// them properly. Free-form strings are still accepted (for backwards-compat
// with old logs) and fall through to the raw key.
export const AUDIT_ACTIONS = [
  // user lifecycle
  'user.delete',
  'user.role_change',
  'user.export_data',
  'user.impersonate_start',
  'user.impersonate_end',
  // moderation
  'post.hide',
  'post.unhide',
  'post.delete',
  'post.approve',
  'comment.delete',
  // notifications
  'push.broadcast',
  'push.personal',
  'push.schedule',
  'push.cancel',
  // settings
  'settings.update',
  'banner.publish',
  'banner.clear',
  // visibility (Wave 2)
  'flag.toggle',
  'flag.rollout_change',
  'maintenance.enable',
  'maintenance.disable',
  'force_update.set',
  // content (Wave 6)
  'content.publish',
  'content.unpublish',
  'content.delete',
  // ops (Wave 8)
  'function.replay',
  'cron.replay',
  // safety (Wave 4)
  'image.unflag',
  'crisis.escalate',
  // org (Wave 7)
  'role.create',
  'role.update',
  'role.delete',
  'vaccine_schedule.edit',
  'vaccine_schedule.signoff',
  'rtbf.process',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.delete': 'Deleted user',
  'user.role_change': 'Changed user role',
  'user.export_data': 'Exported user data',
  'user.impersonate_start': 'Started impersonation',
  'user.impersonate_end': 'Ended impersonation',
  'post.hide': 'Hid post',
  'post.unhide': 'Unhid post',
  'post.delete': 'Deleted post',
  'post.approve': 'Approved post',
  'comment.delete': 'Deleted comment',
  'push.broadcast': 'Sent broadcast push',
  'push.personal': 'Sent personal push',
  'push.schedule': 'Scheduled push',
  'push.cancel': 'Cancelled scheduled push',
  'settings.update': 'Updated settings',
  'banner.publish': 'Published banner',
  'banner.clear': 'Cleared banner',
  'flag.toggle': 'Toggled feature flag',
  'flag.rollout_change': 'Changed rollout %',
  'maintenance.enable': 'Enabled maintenance mode',
  'maintenance.disable': 'Disabled maintenance mode',
  'force_update.set': 'Set force-update version',
  'content.publish': 'Published content',
  'content.unpublish': 'Unpublished content',
  'content.delete': 'Deleted content',
  'function.replay': 'Replayed function',
  'cron.replay': 'Replayed cron job',
  'image.unflag': 'Unflagged image',
  'crisis.escalate': 'Escalated crisis flag',
  'role.create': 'Created role',
  'role.update': 'Updated role',
  'role.delete': 'Deleted role',
  'vaccine_schedule.edit': 'Edited vaccine schedule',
  'vaccine_schedule.signoff': 'Signed off vaccine schedule',
  'rtbf.process': 'Processed RTBF request',
};

export function labelForAuditAction(a: string): string {
  return AUDIT_ACTION_LABELS[a] ?? a;
}

// ─── Community topics (mirror of public app constants) ─────────────────────
// Server-validated (firestore.rules enforces this exact set).
export const COMMUNITY_TOPICS = [
  'pregnancy',
  'newborn',
  'feeding',
  'sleep',
  'health',
  'milestones',
  'activities',
  'mental_health',
  'family',
  'general',
] as const;
export type CommunityTopic = (typeof COMMUNITY_TOPICS)[number];

export const COMMUNITY_TOPIC_LABELS: Record<CommunityTopic, string> = {
  pregnancy: 'Pregnancy',
  newborn: 'Newborn',
  feeding: 'Feeding',
  sleep: 'Sleep',
  health: 'Health',
  milestones: 'Milestones',
  activities: 'Activities',
  mental_health: 'Mental health',
  family: 'Family',
  general: 'General',
};

// ─── Push audience kinds ───────────────────────────────────────────────────
export const PUSH_AUDIENCES = ['all', 'state', 'role', 'segment', 'user'] as const;
export type PushAudience = (typeof PUSH_AUDIENCES)[number];

export const PUSH_AUDIENCE_LABELS: Record<PushAudience, string> = {
  all: 'All users',
  state: 'By state',
  role: 'By parent role',
  segment: 'Saved segment',
  user: 'Specific user(s)',
};

// ─── Crisis severity (Wave 4) ──────────────────────────────────────────────
export const CRISIS_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type CrisisSeverity = (typeof CRISIS_SEVERITIES)[number];

export const CRISIS_SEVERITY_COLORS: Record<CrisisSeverity, string> = {
  low: Colors.textMuted,
  medium: Colors.warning,
  high: Colors.error,
  critical: '#7f1d1d',
};
