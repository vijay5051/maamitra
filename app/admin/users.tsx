/**
 * Admin — User Management
 *
 * Lists every signed-up user. Tap a row → /admin/users/[uid] for the 360
 * (delete, role change, DSAR export, push). This screen is the index.
 *
 * Wave 3 rebuild: AdminPage shell, paginated DataTable with sortable
 * columns and bulk-select for personal push, KPI cards, two modals
 * (BulkPushModal + CreateUserModal) preserved as-is and ported off
 * the old style sheet.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  DataTable,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { AdminUser, getUsers } from '../../services/firebase';
import { createAdminManagedUser, sendPersonalPushFromAdmin } from '../../services/admin';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { ADMIN_ROLE_LABELS, ADMIN_ROLES, AdminRole, can } from '../../lib/admin';

export default function UsersScreen() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const role = useAdminRole();
  const canPush = can(role, 'send_personal_push');
  const canManageAdminRoles = can(role, 'manage_admin_roles');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushOpen, setPushOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function bulkSend(title: string, body: string) {
    if (!authUser || !canPush) return;
    const uids = Array.from(selected);
    let sent = 0; let failed = 0;
    for (const uid of uids) {
      try { await sendPersonalPushFromAdmin(authUser, uid, { title, body }); sent++; }
      catch { failed++; }
    }
    setPushOpen(false);
    setSelected(new Set());
    setError(failed ? `${sent} sent, ${failed} failed.` : null);
  }

  async function handleCreateUser(payload: { name: string; email: string; password: string; adminRole: AdminRole | null }) {
    if (!authUser) return;
    try {
      const result = await createAdminManagedUser(authUser, payload);
      setCreateOpen(false);
      await load();
      router.push(`/admin/users/${result.uid}` as any);
    } catch (e: any) {
      Alert.alert('Could not create user', e?.message || 'Please try again.');
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.state.toLowerCase().includes(q),
    );
  }, [users, search]);

  const completeCount = filtered.filter((u) => u.onboardingComplete).length;

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'Name',
      width: 240,
      render: (u) => (
        <View style={styles.cellNameRow}>
          <Avatar name={u.name} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cellName} numberOfLines={1}>{u.name || 'Unnamed'}</Text>
            <Text style={styles.cellMeta} numberOfLines={1}>{u.email || '—'}</Text>
          </View>
        </View>
      ),
      sort: (u) => u.name,
    },
    {
      key: 'state',
      header: 'State',
      width: 130,
      render: (u) => <Text style={styles.cellPlain}>{u.state || '—'}</Text>,
      sort: (u) => u.state,
    },
    {
      key: 'kidsCount',
      header: 'Kids',
      width: 80,
      align: 'right',
      render: (u) => <Text style={styles.cellNumber}>{u.kidsCount}</Text>,
      sort: (u) => u.kidsCount,
    },
    {
      key: 'onboarding',
      header: 'Status',
      width: 130,
      render: (u) =>
        u.onboardingComplete
          ? <StatusBadge label="Onboarded" color={Colors.success} />
          : <StatusBadge label="Pending" color={Colors.warning} />,
      sort: (u) => (u.onboardingComplete ? 1 : 0),
    },
    {
      key: 'adminRole',
      header: 'Role',
      width: 130,
      render: (u) => {
        const r = (u as any).adminRole as AdminRole | undefined;
        if (!r) return <Text style={styles.cellMuted}>User</Text>;
        return <StatusBadge label={ADMIN_ROLE_LABELS[r]} color={Colors.primary} variant="outline" />;
      },
      sort: (u) => (u as any).adminRole ?? '',
    },
    {
      key: 'createdAt',
      header: 'Joined',
      width: 130,
      align: 'right',
      render: (u) => (
        <Text style={styles.cellMeta}>
          {u.createdAt
            ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        </Text>
      ),
      sort: (u) => u.createdAt ?? '',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Users' }} />
      <AdminPage
        title="Users"
        description="Every signed-up user. Tap a row for the 360 view, or bulk-select to send a personal push."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            {canPush && selected.size > 0 ? (
              <ToolbarButton
                label={`Push to ${selected.size}`}
                icon="paper-plane-outline"
                variant="primary"
                onPress={() => setPushOpen(true)}
              />
            ) : null}
            <ToolbarButton
              label="New user"
              icon="person-add-outline"
              variant="primary"
              onPress={() => setCreateOpen(true)}
            />
          </>
        }
        toolbar={
          <Toolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search name, email, state…',
            }}
            leading={<Text style={styles.countText}>{filtered.length} of {users.length}</Text>}
          />
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Total"      value={users.length}     icon="people-outline" />
          <StatCard label="Onboarded"  value={completeCount}    icon="checkmark-done-outline" />
          <StatCard label="Pending"    value={filtered.length - completeCount} icon="time-outline" />
          <StatCard
            label="With kids"
            value={filtered.filter((u) => u.kidsCount > 0).length}
            icon="happy-outline"
          />
        </View>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(u) => u.uid}
          loading={loading}
          selectable={canPush}
          selected={selected}
          onSelectChange={setSelected}
          onRowPress={(u) => router.push(`/admin/users/${u.uid}` as any)}
          emptyTitle={search ? 'No users match' : 'No users yet'}
          emptyBody={search ? 'Try a different search.' : 'New signups will appear here.'}
        />
      </AdminPage>

      <BulkPushModal
        visible={pushOpen}
        count={selected.size}
        onCancel={() => setPushOpen(false)}
        onSend={bulkSend}
      />
      <CreateUserModal
        visible={createOpen}
        canManageAdminRoles={canManageAdminRoles}
        onCancel={() => setCreateOpen(false)}
        onCreate={handleCreateUser}
      />
    </>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  const palette = [Colors.primary, '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
  const bg = palette[initial.charCodeAt(0) % palette.length];
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

// ─── Bulk Push Modal (preserved from old screen, restyled) ─────────────────
function BulkPushModal({ visible, count, onCancel, onSend }: {
  visible: boolean;
  count: number;
  onCancel: () => void;
  onSend: (title: string, body: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Send push to {count} user{count === 1 ? '' : 's'}</Text>
          <Text style={styles.modalHint}>
            Personal push — only these users get it. Broadcasts live in Notifications.
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Title (max 120 chars)"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <TextInput
            style={[styles.modalInput, styles.modalTextarea]}
            placeholder="Message (max 300 chars)"
            placeholderTextColor={Colors.textMuted}
            value={body}
            onChangeText={setBody}
            maxLength={300}
            multiline
          />
          <View style={styles.modalActions}>
            <ToolbarButton label="Cancel" variant="ghost" onPress={onCancel} disabled={sending} />
            <ToolbarButton
              label={sending ? 'Sending…' : `Send to ${count}`}
              variant="primary"
              icon="paper-plane-outline"
              onPress={async () => {
                if (!title.trim() || !body.trim() || sending) return;
                setSending(true);
                try {
                  await onSend(title.trim(), body.trim());
                  setTitle(''); setBody('');
                } finally { setSending(false); }
              }}
              disabled={sending || !title.trim() || !body.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Create User Modal (preserved from old screen, restyled) ───────────────
function CreateUserModal({
  visible,
  canManageAdminRoles,
  onCancel,
  onCreate,
}: {
  visible: boolean;
  canManageAdminRoles: boolean;
  onCancel: () => void;
  onCreate: (payload: { name: string; email: string; password: string; adminRole: AdminRole | null }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(''); setEmail(''); setPassword(''); setAdminRole(null); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add user</Text>
          <Text style={styles.modalHint}>
            Create an email-password account, then optionally grant an admin role.
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Full name"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Email address"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Temporary password (min 8 chars)"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          {canManageAdminRoles ? (
            <View style={styles.rolePickerWrap}>
              <Text style={styles.rolePickerLabel}>Admin access</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rolePickerRow}>
                <TouchableOpacity
                  style={[styles.roleChip, adminRole === null && styles.roleChipActive]}
                  onPress={() => setAdminRole(null)}
                >
                  <Text style={[styles.roleChipText, adminRole === null && styles.roleChipTextActive]}>User only</Text>
                </TouchableOpacity>
                {ADMIN_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, adminRole === r && styles.roleChipActive]}
                    onPress={() => setAdminRole(r)}
                  >
                    <Text style={[styles.roleChipText, adminRole === r && styles.roleChipTextActive]}>
                      {ADMIN_ROLE_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <ToolbarButton label="Cancel" variant="ghost" onPress={onCancel} disabled={saving} />
            <ToolbarButton
              label={saving ? 'Creating…' : 'Create user'}
              variant="primary"
              icon="person-add-outline"
              disabled={saving || !name.trim() || !email.trim() || password.length < 8}
              onPress={async () => {
                setSaving(true);
                try {
                  await onCreate({ name: name.trim(), email: email.trim(), password, adminRole });
                  reset();
                } finally { setSaving(false); }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },

  cellNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cellName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  cellPlain: { fontSize: FontSize.sm, color: Colors.textDark },
  cellMuted: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  cellNumber: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, fontVariant: ['tabular-nums'] },

  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.sm },

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
  modalTextarea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  rolePickerWrap: { gap: 6 },
  rolePickerLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4, textTransform: 'uppercase' },
  rolePickerRow: { gap: 6 },
  roleChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  roleChipTextActive: { color: Colors.white },
});
