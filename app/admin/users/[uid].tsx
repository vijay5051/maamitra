/**
 * Admin · User 360.
 *
 * Wave 3 rebuild. Profile + kids + posts + tickets + devices + DSAR
 * export + push + role override + hard delete. AdminPage shell, KPI
 * row, sectioned cards, ConfirmDialog for destructive actions, two
 * Modals (push compose + admin-role picker) restyled to design tokens.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import {
  AdminPage,
  ConfirmDialog,
  EmptyState,
  StatCard,
  StatusBadge,
  ToolbarButton,
} from '../../../components/admin/ui';
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

export default function UserDetail() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [snap, setSnap] = useState<UserSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushOpen, setPushOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmRoleChange, setConfirmRoleChange] = useState<null | { next: 'mother'|'father'|'other'; run: () => Promise<void> }>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!uid) return;
      setLoading(true);
      setError(null);
      try {
        const s = await getUserSnapshot(uid as string);
        if (alive) setSnap(s);
      } catch (e: any) {
        if (alive) setError(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [uid]);

  if (!uid) {
    return (
      <AdminPage title="User" crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users', href: '/admin/users' }]}>
        <EmptyState kind="error" title="Missing uid" body="The route requires a user id parameter." />
      </AdminPage>
    );
  }

  const profile = snap?.profile ?? {};
  const pub = snap?.publicProfile ?? {};
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
  const adminRoleNow: AdminRole | null = (profile.adminRole ?? null) as AdminRole | null;

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

  async function handlePush(title: string, body: string) {
    if (!actor) return;
    try {
      await sendPersonalPushFromAdmin(actor, uid as string, { title, body });
      setPushOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Could not enqueue push.');
    }
  }

  async function handleParentGender(newRole: 'mother' | 'father' | 'other') {
    if (!actor || !can(role, 'change_user_role')) return;
    setConfirmRoleChange({
      next: newRole,
      run: async () => {
        try {
          await adminSetUserRole(uid as string, newRole);
          setSnap((s) => s ? { ...s, profile: { ...(s.profile ?? {}), parentGender: newRole } } : s);
        } catch (e: any) {
          setError(e?.message ?? 'Could not update role.');
        }
      },
    });
  }

  async function handleAdminRole(next: AdminRole | null) {
    if (!actor || !can(role, 'manage_admin_roles')) return;
    try {
      await setUserAdminRole(actor, uid as string, next);
      setSnap((s) => s ? { ...s, profile: { ...(s.profile ?? {}), adminRole: next } } : s);
      setRoleOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Could not update admin role.');
    }
  }

  async function handleExport() {
    if (!actor || !can(role, 'export_user_data')) return;
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
      }
    } catch (e: any) {
      setError(e?.message ?? 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await adminDeleteUserFully(uid as string);
      router.replace('/admin/users');
    } catch (e: any) {
      setError(`${e?.code ? `${e.code}: ` : ''}${e?.message ?? String(e)}`);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'User 360' }} />
      <AdminPage
        title={loading ? 'Loading…' : name}
        description={loading ? undefined : `${email || '—'}${phone ? ` · ${phone}` : ''}`}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users', href: '/admin/users' }, { label: name }]}
        headerActions={
          snap ? (
            <>
              {can(role, 'send_personal_push') ? (
                <ToolbarButton label="Send push" icon="paper-plane-outline" onPress={() => setPushOpen(true)} />
              ) : null}
              {can(role, 'export_user_data') ? (
                <ToolbarButton
                  label={exporting ? 'Exporting…' : 'Export (DSAR)'}
                  icon="download-outline"
                  onPress={handleExport}
                  disabled={exporting}
                />
              ) : null}
              {can(role, 'manage_admin_roles') ? (
                <ToolbarButton label="Admin role" icon="shield-outline" onPress={() => setRoleOpen(true)} />
              ) : null}
              {can(role, 'hard_delete_user') ? (
                <ToolbarButton label="Hard delete" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
              ) : null}
            </>
          ) : null
        }
        loading={loading && !snap}
        error={error}
      >
        {!snap ? null : (
          <>
            {/* Identity tags */}
            <View style={styles.tagRow}>
              {profile.parentGender ? <StatusBadge label={profile.parentGender} color={Colors.primary} variant="outline" /> : null}
              {stage ? <StatusBadge label={stage} color={Colors.primary} variant="outline" /> : null}
              {state ? <StatusBadge label={state} color={Colors.primary} variant="outline" /> : null}
              {audienceBuckets.map((b) => <StatusBadge key={b} label={b} color={Colors.warning} />)}
              {adminRoleNow ? <StatusBadge label={ADMIN_ROLE_LABELS[adminRoleNow]} color="#3b82f6" variant="solid" /> : null}
            </View>

            {/* KPI grid */}
            <View style={styles.statsRow}>
              <StatCard label="Kids"        value={kids.length}             icon="happy-outline" />
              <StatCard label="Posts"       value={snap.postCount}          icon="chatbubble-outline" />
              <StatCard label="Comments"    value={snap.commentCount}       icon="chatbubble-ellipses-outline" />
              <StatCard label="DMs"         value={snap.conversationCount}  icon="mail-outline" />
              <StatCard label="Reports"     value={snap.reportsAgainst}     icon="flag-outline"        deltaPositive="down" />
              <StatCard label="Blocked by"  value={snap.blockedBy}          icon="ban-outline"         deltaPositive="down" />
            </View>

            {/* Profile */}
            <Section title="Profile">
              <KeyVal k="UID" v={snap.uid} mono />
              <KeyVal k="Onboarding" v={profile.onboardingComplete ? 'Complete' : 'Incomplete'} />
              <KeyVal k="Created" v={fmt(profile.createdAt)} />
              <KeyVal k="Updated" v={fmt(profile.updatedAt)} />
              <KeyVal k="Provider" v={profile.provider ?? '—'} />
              <KeyVal k="Phone verified" v={profile.phoneVerified ? 'Yes' : 'No'} />
              {profile.bio ? <KeyVal k="Bio" v={profile.bio} /> : null}
              {profile.expertise?.length ? <KeyVal k="Expertise" v={(profile.expertise as string[]).join(', ')} /> : null}
              {allergies.length ? <KeyVal k="Allergies" v={allergies.join(', ')} /> : null}
              {conditions.length ? <KeyVal k="Health conditions" v={conditions.join(', ')} /> : null}

              {/* Parent role override */}
              <View style={styles.parentRoleRow}>
                <Text style={styles.kvKey}>Parent role</Text>
                <View style={styles.roleChipsRow}>
                  {(['mother', 'father', 'other'] as const).map((r) => {
                    const active = (profile.parentGender ?? '') === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => !active && handleParentGender(r)}
                        disabled={active || !can(role, 'change_user_role')}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                      >
                        <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{r}</Text>
                      </Pressable>
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
            <Section
              title={`Recent posts (${snap.postCount})`}
              action={
                snap.recentPosts.length > 0 ? (
                  <Pressable onPress={() => router.push('/admin/community')}>
                    <Text style={styles.sectionLink}>Moderate →</Text>
                  </Pressable>
                ) : undefined
              }
            >
              {snap.recentPosts.length === 0 ? (
                <Text style={styles.muted}>No posts yet.</Text>
              ) : snap.recentPosts.map((p) => {
                const tone = p.hidden ? Colors.error : !p.approved ? Colors.warning : Colors.success;
                const label = p.hidden ? 'hidden' : p.approved ? 'live' : 'pending';
                return (
                  <View key={p.id} style={styles.postRow}>
                    <View style={[styles.postFlag, { backgroundColor: tone }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postText} numberOfLines={2}>{p.text || '(empty)'}</Text>
                      <Text style={styles.postMeta}>{fmt(p.createdAt)} · {label}</Text>
                    </View>
                  </View>
                );
              })}
            </Section>

            {/* Tickets */}
            <Section
              title={`Support tickets (${snap.recentTickets.length})`}
              action={
                snap.recentTickets.length > 0 ? (
                  <Pressable onPress={() => router.push('/admin/support')}>
                    <Text style={styles.sectionLink}>Open inbox →</Text>
                  </Pressable>
                ) : undefined
              }
            >
              {snap.recentTickets.length === 0 ? (
                <Text style={styles.muted}>No tickets from this user.</Text>
              ) : snap.recentTickets.map((t) => (
                <View key={t.id} style={styles.ticketRow}>
                  <View style={[styles.statusDot, {
                    backgroundColor: t.status === 'open' ? Colors.warning : t.status === 'in_progress' ? '#3B82F6' : Colors.success,
                  }]} />
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
                  <Ionicons name="phone-portrait-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.tokenText} numberOfLines={1}>{tok.slice(0, 24)}…{tok.slice(-8)}</Text>
                </View>
              ))}
            </Section>
          </>
        )}
      </AdminPage>

      <PushModal
        visible={pushOpen}
        recipient={name}
        onCancel={() => setPushOpen(false)}
        onSend={handlePush}
      />

      <RoleModal
        visible={roleOpen}
        current={adminRoleNow}
        onCancel={() => setRoleOpen(false)}
        onSet={handleAdminRole}
      />

      <ConfirmDialog
        visible={!!confirmRoleChange}
        title={`Change parent role to "${confirmRoleChange?.next ?? ''}"?`}
        body={`Resets ${name}'s parent role. This reshapes their role-adaptive content on next app open.`}
        confirmLabel="Confirm"
        onCancel={() => setConfirmRoleChange(null)}
        onConfirm={async () => {
          const r = confirmRoleChange;
          setConfirmRoleChange(null);
          if (r) await r.run();
        }}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Hard-delete this user?"
        body={`Permanently delete ${name}${email ? ` (${email})` : ''}. Removes BOTH the Firebase Auth account and Firestore data. Cannot be undone.`}
        destructive
        requireType="DELETE"
        confirmLabel="Delete permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────
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

function KeyVal({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, mono && styles.kvMono]} numberOfLines={2}>{v || '—'}</Text>
    </View>
  );
}

function PushModal({ visible, recipient, onCancel, onSend }: {
  visible: boolean;
  recipient: string;
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
          <Text style={styles.modalHint}>Goes only to {recipient}. Counts as a DM in their notification log.</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            maxLength={120}
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={[styles.modalInput, { minHeight: 88, textAlignVertical: 'top' }]}
            value={body}
            onChangeText={setBody}
            placeholder="Message"
            maxLength={300}
            multiline
            placeholderTextColor={Colors.textMuted}
          />
          <View style={styles.modalActions}>
            <ToolbarButton label="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
            <ToolbarButton
              label={busy ? 'Sending…' : 'Send'}
              variant="primary"
              icon="paper-plane-outline"
              disabled={busy || !title.trim() || !body.trim()}
              onPress={async () => {
                setBusy(true);
                try { await onSend(title.trim(), body.trim()); setTitle(''); setBody(''); }
                finally { setBusy(false); }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RoleModal({ visible, current, onCancel, onSet }: {
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
            Granting an admin role lets this user into /admin with the listed capabilities. Audit-logged.
          </Text>
          {ADMIN_ROLES.map((r) => (
            <Pressable
              key={r}
              style={[styles.roleOption, current === r && styles.roleOptionActive]}
              disabled={busy}
              onPress={async () => { setBusy(true); try { await onSet(r); } finally { setBusy(false); } }}
            >
              <Text style={[styles.roleOptionLabel, current === r && styles.roleOptionLabelActive]}>{ADMIN_ROLE_LABELS[r]}</Text>
              {current === r ? <Ionicons name="checkmark" size={16} color={Colors.white} /> : null}
            </Pressable>
          ))}
          <Pressable
            style={[styles.roleOption, current === null && styles.roleOptionActive]}
            disabled={busy}
            onPress={async () => { setBusy(true); try { await onSet(null); } finally { setBusy(false); } }}
          >
            <Text style={[styles.roleOptionLabel, current === null && styles.roleOptionLabelActive]}>No admin role</Text>
            {current === null ? <Ionicons name="checkmark" size={16} color={Colors.white} /> : null}
          </Pressable>
          <View style={styles.modalActions}>
            <ToolbarButton label="Done" variant="primary" onPress={onCancel} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  muted: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },

  section: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgLight,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  sectionLink: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  sectionBody: { padding: Spacing.md, gap: 4 },

  kvRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  kvKey: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, width: 140, letterSpacing: 0.4, textTransform: 'uppercase' },
  kvVal: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19 },
  kvMono: { fontFamily: 'DMMono_400Regular' },

  parentRoleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 8 },
  roleChipsRow: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  roleChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  roleChipTextActive: { color: Colors.white },

  kidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  kidName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  kidMeta: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'right' },

  postRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  postFlag: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginTop: 2 },
  postText: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19 },
  postMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ticketSubject: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  ticketMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },

  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  tokenText: { flex: 1, fontSize: FontSize.xs, color: Colors.textLight, fontFamily: 'DMMono_400Regular' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(28,16,51,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 480,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  modalHint: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 19 },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    backgroundColor: Colors.bgLight,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },

  roleOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  roleOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleOptionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  roleOptionLabelActive: { color: Colors.white },
});
