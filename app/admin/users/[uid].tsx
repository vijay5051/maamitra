/**
 * Admin — Per-user 360.
 *
 * One screen with everything you need to support, debug, or moderate a
 * single account: profile + kids, posts, reports against, support tickets,
 * conversations, audience buckets, devices, and the four high-leverage
 * actions (DSAR export, DM via push, role override, hard delete).
 *
 * All write actions go through services/admin.ts so they're audit-logged.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../../constants/theme';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAdminRole } from '../../../lib/useAdminRole';
import { ADMIN_ROLES, ADMIN_ROLE_LABELS, AdminRole, can } from '../../../lib/admin';
import {
  exportUserData,
  getUserSnapshot,
  sendPersonalPushFromAdmin,
  setUserAdminRole,
  UserSnapshot,
} from '../../../services/admin';
import { adminDeleteUserFully, adminSetUserRole } from '../../../services/firebase';
import { confirmAction, infoAlert } from '../../../lib/cross-platform-alerts';

function StatPill({ value, label, tint = Colors.primary }: { value: number | string; label: string; tint?: string }) {
  return (
    <View style={[styles.pill, { borderTopColor: tint }]}>
      <Text style={[styles.pillValue, { color: tint }]}>{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function KeyVal({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal} numberOfLines={2}>{v || '—'}</Text>
    </View>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function PushModal({
  visible,
  onCancel,
  onSend,
}: {
  visible: boolean;
  onCancel: () => void;
  onSend: (title: string, body: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Send personal push</Text>
          <Text style={styles.modalHint}>Goes only to this user. Counts as a DM in their notification log.</Text>
          <TextInput style={styles.modalInput} value={title} onChangeText={setTitle} placeholder="Title" maxLength={120} placeholderTextColor="#9ca3af" />
          <TextInput style={[styles.modalInput, { height: 88, textAlignVertical: 'top' as any }]} value={body} onChangeText={setBody} placeholder="Message" maxLength={300} multiline placeholderTextColor="#9ca3af" />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary]}
              disabled={busy || !title.trim() || !body.trim()}
              onPress={async () => {
                setBusy(true);
                try { await onSend(title.trim(), body.trim()); setTitle(''); setBody(''); }
                finally { setBusy(false); }
              }}
            >
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>{busy ? 'Sending…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RoleModal({
  visible,
  current,
  onCancel,
  onSet,
}: {
  visible: boolean;
  current: AdminRole | null;
  onCancel: () => void;
  onSet: (role: AdminRole | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Admin role</Text>
          <Text style={styles.modalHint}>
            Granting an admin role lets this user into /admin with the listed
            capabilities. Remove with "No admin role". This action is audit-logged.
          </Text>
          {ADMIN_ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleOption, current === r && styles.roleOptionActive]}
              disabled={busy}
              onPress={async () => { setBusy(true); try { await onSet(r); } finally { setBusy(false); } }}
            >
              <Text style={[styles.roleOptionLabel, current === r && { color: '#fff' }]}>{ADMIN_ROLE_LABELS[r]}</Text>
              {current === r ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.roleOption, current === null && styles.roleOptionActive]}
            disabled={busy}
            onPress={async () => { setBusy(true); try { await onSet(null); } finally { setBusy(false); } }}
          >
            <Text style={[styles.roleOptionLabel, current === null && { color: '#fff' }]}>No admin role</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalBtn} onPress={onCancel} disabled={busy}>
            <Text style={styles.modalBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function UserDetail() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [snap, setSnap] = useState<UserSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushOpen, setPushOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!uid) return;
      setLoading(true);
      const s = await getUserSnapshot(uid as string);
      if (alive) {
        setSnap(s);
        setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [uid]);

  if (!uid) {
    return (
      <View style={styles.container}>
        <Text style={{ padding: 20 }}>Missing uid.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!snap) {
    return (
      <View style={[styles.container, { padding: 20 }]}>
        <Text style={styles.notFound}>User not found.</Text>
        <TouchableOpacity style={[styles.modalBtn, { marginTop: 16, alignSelf: 'flex-start' }]} onPress={() => router.back()}>
          <Text style={styles.modalBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const profile = snap.profile ?? {};
  const pub = snap.publicProfile ?? {};
  const name = profile.name ?? profile.motherName ?? pub.name ?? 'Unnamed';
  const email = profile.email ?? pub.email ?? '';
  const phone = profile.phone ?? '';
  const state = profile.profile?.state ?? '';
  const stage = profile.profile?.stage ?? '';
  const kids: any[] = Array.isArray(profile.kids) ? profile.kids : [];
  const audienceBuckets: string[] = Array.isArray(profile.audienceBuckets) ? profile.audienceBuckets : [];
  const fcmTokens: string[] = Array.isArray(profile.fcmTokens) ? profile.fcmTokens : [];
  const allergies: string[] = Array.isArray(profile.allergies) ? profile.allergies : [];
  const conditions: string[] = Array.isArray(profile.healthConditions) ? profile.healthConditions : [];
  const adminRole: AdminRole | null = (profile.adminRole ?? null) as AdminRole | null;

  function fmt(d: any): string {
    if (!d) return '—';
    if (typeof d === 'string') {
      const t = Date.parse(d);
      return isNaN(t) ? d : new Date(t).toLocaleString('en-IN');
    }
    if (typeof d?.toDate === 'function') return d.toDate().toLocaleString('en-IN');
    if (d?.seconds) return new Date(d.seconds * 1000).toLocaleString('en-IN');
    return '—';
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handlePush(title: string, body: string) {
    if (!actor) return;
    try {
      await sendPersonalPushFromAdmin(actor, uid as string, { title, body });
      setPushOpen(false);
      infoAlert('Queued', 'Push has been enqueued. Delivery typically lands within a minute.');
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Could not enqueue push.');
    }
  }

  async function handleParentGender(newRole: 'mother' | 'father' | 'other') {
    const ok = await confirmAction(
      'Change role?',
      `Reset ${name}'s parent role to "${newRole}"? This reshapes their role-adaptive content on next app open.`,
      { confirmLabel: 'Confirm' },
    );
    if (!ok || !actor) return;
    try {
      await adminSetUserRole(uid as string, newRole);
      setSnap((s) => s ? { ...s, profile: { ...(s.profile ?? {}), parentGender: newRole } } : s);
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Could not update role.');
    }
  }

  async function handleAdminRole(next: AdminRole | null) {
    if (!actor) return;
    if (!can(role, 'manage_admin_roles')) {
      infoAlert('Not allowed', 'Only super admins can grant admin roles.');
      return;
    }
    try {
      await setUserAdminRole(actor, uid as string, next);
      setSnap((s) => s ? { ...s, profile: { ...(s.profile ?? {}), adminRole: next } } : s);
      setRoleOpen(false);
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Could not update admin role.');
    }
  }

  async function handleExport() {
    if (!actor) return;
    if (!can(role, 'export_user_data')) {
      infoAlert('Not allowed', 'Your role does not allow data export.');
      return;
    }
    setExporting(true);
    try {
      const data = await exportUserData(actor, uid as string);
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `maamitra-user-${uid}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        infoAlert('Exported', 'JSON downloaded. Treat the file as confidential — it contains the user\'s full data.');
      } else {
        // Native: copy to clipboard fallback (no FS picker without expo-file-system).
        // The audit log still captured the export.
        infoAlert('Export ready', `Captured ${data.posts.length} posts, ${data.comments.length} comments, ${data.supportTickets.length} tickets. Run on web to download a JSON file.`);
      }
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!actor) return;
    if (!can(role, 'hard_delete_user')) {
      infoAlert('Not allowed', 'Only super admins can hard-delete an account.');
      return;
    }
    const ok = await confirmAction(
      'Delete user permanently',
      `Permanently delete ${name} (${email})?\n\nRemoves BOTH their Firebase Auth account and Firestore data. This cannot be undone.`,
      { confirmLabel: 'Delete Permanently' },
    );
    if (!ok) return;
    try {
      await adminDeleteUserFully(uid as string);
      infoAlert('Deleted', `${name || email || uid} has been fully removed.`);
      router.replace('/admin/users');
    } catch (e: any) {
      const code = e?.code ? `${e.code}\n\n` : '';
      infoAlert('Delete failed', `${code}${e?.message ?? String(e)}`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
      <LinearGradient colors={['#F5F0FF', '#EDE4FF']} style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{name}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{email || '—'}</Text>
            {phone ? <Text style={styles.headerSub}>{phone}</Text> : null}
            <View style={styles.tagRow}>
              {profile.parentGender ? <View style={styles.tag}><Text style={styles.tagText}>{profile.parentGender}</Text></View> : null}
              {stage ? <View style={styles.tag}><Text style={styles.tagText}>{stage}</Text></View> : null}
              {state ? <View style={styles.tag}><Ionicons name="location-outline" size={11} color="#1a1a2e" /><Text style={styles.tagText}>{state}</Text></View> : null}
              {audienceBuckets.map((b) => (
                <View key={b} style={[styles.tag, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                  <Text style={styles.tagText}>{b}</Text>
                </View>
              ))}
              {adminRole ? (
                <View style={[styles.tag, { backgroundColor: '#DBEAFE', borderColor: '#60A5FA' }]}>
                  <Ionicons name="shield-checkmark-outline" size={11} color="#1d4ed8" />
                  <Text style={[styles.tagText, { color: '#1d4ed8' }]}>{ADMIN_ROLE_LABELS[adminRole]}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          <StatPill value={kids.length} label="Kids" tint="#8b5cf6" />
          <StatPill value={snap.postCount} label="Posts" tint="#EC4899" />
          <StatPill value={snap.commentCount} label="Comments" tint="#06B6D4" />
          <StatPill value={snap.conversationCount} label="DMs" tint="#10B981" />
          <StatPill value={snap.reportsAgainst} label="Reports" tint="#EF4444" />
          <StatPill value={snap.blockedBy} label="Blocked by" tint="#F59E0B" />
        </View>
      </LinearGradient>

      {/* Actions */}
      <View style={styles.actionsRow}>
        {can(role, 'send_personal_push') && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setPushOpen(true)}>
            <Ionicons name="paper-plane-outline" size={14} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Send push</Text>
          </TouchableOpacity>
        )}
        {can(role, 'export_user_data') && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleExport} disabled={exporting}>
            <Ionicons name="download-outline" size={14} color={Colors.primary} />
            <Text style={styles.actionBtnText}>{exporting ? 'Exporting…' : 'Export data (DSAR)'}</Text>
          </TouchableOpacity>
        )}
        {can(role, 'manage_admin_roles') && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setRoleOpen(true)}>
            <Ionicons name="shield-outline" size={14} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Admin role</Text>
          </TouchableOpacity>
        )}
        {can(role, 'hard_delete_user') && (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
            <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Hard delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Profile */}
      <Section title="Profile">
        <KeyVal k="UID" v={snap.uid} />
        <KeyVal k="Onboarding" v={profile.onboardingComplete ? 'Complete' : 'Incomplete'} />
        <KeyVal k="Created" v={fmt(profile.createdAt)} />
        <KeyVal k="Updated" v={fmt(profile.updatedAt)} />
        <KeyVal k="Provider" v={profile.provider ?? '—'} />
        <KeyVal k="Phone verified" v={profile.phoneVerified ? 'Yes' : 'No'} />
        {profile.bio ? <KeyVal k="Bio" v={profile.bio} /> : null}
        {profile.expertise?.length ? <KeyVal k="Expertise" v={(profile.expertise as string[]).join(', ')} /> : null}
        {allergies.length ? <KeyVal k="Allergies" v={allergies.join(', ')} /> : null}
        {conditions.length ? <KeyVal k="Health conditions" v={conditions.join(', ')} /> : null}

        {/* Parent role override (mother/father/other) */}
        <View style={styles.roleRow}>
          <Text style={styles.kvKey}>Parent role</Text>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
            {(['mother', 'father', 'other'] as const).map((r) => {
              const active = (profile.parentGender ?? '') === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                  onPress={() => !active && handleParentGender(r)}
                  disabled={active || !can(role, 'change_user_role')}
                >
                  <Text style={[styles.roleChipText, active && { color: '#fff' }]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Section>

      {/* Kids */}
      <Section title={`Children (${kids.length})`}>
        {kids.length === 0 ? (
          <Text style={styles.muted}>No children added.</Text>
        ) : kids.map((k, i) => (
          <View key={k.id ?? i} style={styles.kidRow}>
            <Ionicons name="happy-outline" size={14} color={Colors.primary} />
            <Text style={styles.kidName}>{k.name ?? 'Baby'}</Text>
            <Text style={styles.kidMeta}>
              {k.dob ? `DOB ${k.dob}` : k.isExpecting ? 'Expecting' : '—'}
              {k.gender ? ` · ${k.gender}` : ''}
            </Text>
          </View>
        ))}
      </Section>

      {/* Posts */}
      <Section title={`Recent posts (${snap.postCount})`} action={
        snap.recentPosts.length > 0 ? (
          <TouchableOpacity onPress={() => router.push('/admin/community')}><Text style={styles.sectionLink}>Moderate →</Text></TouchableOpacity>
        ) : null
      }>
        {snap.recentPosts.length === 0 ? (
          <Text style={styles.muted}>No posts yet.</Text>
        ) : snap.recentPosts.map((p) => (
          <View key={p.id} style={styles.postRow}>
            <View style={[styles.postFlag, p.hidden ? { backgroundColor: '#FEE2E2' } : !p.approved ? { backgroundColor: '#FEF3C7' } : { backgroundColor: '#DCFCE7' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.postText} numberOfLines={2}>{p.text || '(empty)'}</Text>
              <Text style={styles.postMeta}>{fmt(p.createdAt)} · {p.hidden ? 'hidden' : p.approved ? 'live' : 'pending'}</Text>
            </View>
          </View>
        ))}
      </Section>

      {/* Tickets */}
      <Section title={`Support tickets (${snap.recentTickets.length})`} action={
        snap.recentTickets.length > 0 ? (
          <TouchableOpacity onPress={() => router.push('/admin/support')}><Text style={styles.sectionLink}>Open inbox →</Text></TouchableOpacity>
        ) : null
      }>
        {snap.recentTickets.length === 0 ? (
          <Text style={styles.muted}>No tickets from this user.</Text>
        ) : snap.recentTickets.map((t) => (
          <View key={t.id} style={styles.ticketRow}>
            <View style={[styles.statusDot, { backgroundColor: t.status === 'open' ? '#F59E0B' : t.status === 'in_progress' ? '#3B82F6' : '#10B981' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
              <Text style={styles.ticketMeta}>{fmt(t.createdAt)} · {t.status}</Text>
            </View>
          </View>
        ))}
      </Section>

      {/* Devices */}
      <Section title={`Devices (${fcmTokens.length} push token${fcmTokens.length === 1 ? '' : 's'})`}>
        {fcmTokens.length === 0 ? (
          <Text style={styles.muted}>No registered push tokens. The user will not receive push notifications.</Text>
        ) : fcmTokens.map((tok) => (
          <View key={tok} style={styles.tokenRow}>
            <Ionicons name="phone-portrait-outline" size={13} color="#9ca3af" />
            <Text style={styles.tokenText} numberOfLines={1}>{tok.slice(0, 24)}…{tok.slice(-8)}</Text>
          </View>
        ))}
      </Section>

      <PushModal visible={pushOpen} onCancel={() => setPushOpen(false)} onSend={handlePush} />
      <RoleModal visible={roleOpen} current={adminRole} onCancel={() => setRoleOpen(false)} onSet={handleAdminRole} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  content: { padding: 16, gap: 12 },

  notFound: { fontSize: 14, color: '#6B7280' },

  // Header card
  headerCard: { borderRadius: 16, padding: 16, gap: 14 },
  headerTopRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bigAvatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  bigAvatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerName: { fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  headerSub: { fontSize: 12, color: '#4B5563', marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#E9D5FF',
  },
  tagText: { fontSize: 10, fontWeight: '700', color: '#1a1a2e' },

  // Stat pills
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexBasis: '15%', flexGrow: 1, minWidth: 84,
    backgroundColor: '#fff', borderRadius: 10, padding: 8,
    alignItems: 'center', borderTopWidth: 3, borderColor: '#F0EDF5', borderWidth: 1,
  },
  pillValue: { fontSize: 18, fontWeight: '800' },
  pillLabel: { fontSize: 9, color: '#6B7280', marginTop: 2, textTransform: 'uppercase', fontWeight: '700' },

  // Actions
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E9D5FF',
  },
  actionBtnDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Sections
  section: { gap: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: {
    flex: 1, fontSize: 11, fontWeight: '800', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 4,
  },
  sectionLink: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  sectionBody: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F0EDF5', gap: 8,
  },

  kvRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  kvKey: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', minWidth: 110 },
  kvVal: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  roleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4,
  },
  roleChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  kidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  kidName: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  kidMeta: { fontSize: 12, color: '#6B7280' },

  postRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, alignItems: 'flex-start' },
  postFlag: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  postText: { fontSize: 13, color: '#1a1a2e' },
  postMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  ticketRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ticketSubject: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  ticketMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  tokenText: { fontSize: 11, color: '#6B7280', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },

  muted: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  modalHint: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  modalInput: {
    backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#1a1a2e', borderWidth: 1, borderColor: '#E5E7EB',
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modalBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  modalBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },

  roleOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
  },
  roleOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleOptionLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
});
