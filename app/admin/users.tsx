/**
 * Admin — User Management
 *
 * Lists every signed-up user with quick stats. Tap a row to drop into the
 * per-user 360 (/admin/users/[uid]) — that's where every action (delete,
 * role change, DSAR export, push) lives. This screen is just the index.
 *
 * Bulk-select lets the admin pick multiple users for a one-shot personal
 * push (welcome ping, beta survey nudge, etc.). Destructive bulk actions
 * are intentionally not available — those need the 360 view's per-user
 * confirmation.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AdminUser, getUsers } from '../../services/firebase';
import { createAdminManagedUser, sendPersonalPushFromAdmin } from '../../services/admin';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { ADMIN_ROLE_LABELS, ADMIN_ROLES, AdminRole, can } from '../../lib/admin';
import { Colors } from '../../constants/theme';
import { infoAlert } from '../../lib/cross-platform-alerts';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  const colors = [Colors.primary, '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
}: {
  user: AdminUser;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Unknown';

  return (
    <Pressable
      style={[styles.userCard, selected && styles.userCardSelected]}
      onPress={selectMode ? onToggleSelect : onOpen}
      onLongPress={onToggleSelect}
      android_ripple={{ color: '#f3f4f6' }}
    >
      <View style={styles.userRow}>
        {selectMode ? (
          <View style={[styles.checkbox, selected && styles.checkboxOn]}>
            {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
        ) : (
          <Avatar name={user.name} />
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{user.name || 'Unnamed'}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{user.email || '—'}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={11} color="#9ca3af" />
            <Text style={styles.metaText}>{joinDate}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="people-outline" size={11} color="#9ca3af" />
            <Text style={styles.metaText}>{user.kidsCount} {user.kidsCount === 1 ? 'kid' : 'kids'}</Text>
            {user.state ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons name="location-outline" size={11} color="#9ca3af" />
                <Text style={styles.metaText}>{user.state}</Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.userMeta}>
          <View style={[styles.statusDot, { backgroundColor: user.onboardingComplete ? '#22c55e' : '#f59e0b' }]} />
          {!selectMode && <Ionicons name="chevron-forward" size={16} color="#d1d5db" />}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Bulk push modal ─────────────────────────────────────────────────────────

function BulkPushModal({
  visible,
  count,
  onCancel,
  onSend,
}: {
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
            Personal push — only these users get it. Used for direct outreach;
            broadcasts live in the Notifications tab.
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Title (max 120 chars)"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <TextInput
            style={[styles.modalInput, styles.modalTextarea]}
            placeholder="Message (max 300 chars)"
            placeholderTextColor="#9ca3af"
            value={body}
            onChangeText={setBody}
            maxLength={300}
            multiline
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtn} onPress={onCancel} disabled={sending}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary]}
              disabled={sending || !title.trim() || !body.trim()}
              onPress={async () => {
                setSending(true);
                try {
                  await onSend(title.trim(), body.trim());
                  setTitle(''); setBody('');
                } finally { setSending(false); }
              }}
            >
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>{sending ? 'Sending…' : `Send to ${count}`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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

  const reset = () => {
    setName('');
    setEmail('');
    setPassword('');
    setAdminRole(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add user</Text>
          <Text style={styles.modalHint}>
            Create an email-password account for a user, then optionally grant an admin role.
          </Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Full name"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Email address"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Temporary password (min 8 chars)"
            placeholderTextColor="#9ca3af"
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
                  activeOpacity={0.75}
                >
                  <Text style={[styles.roleChipText, adminRole === null && styles.roleChipTextActive]}>User only</Text>
                </TouchableOpacity>
                {ADMIN_ROLES.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, adminRole === role && styles.roleChipActive]}
                    onPress={() => setAdminRole(role)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.roleChipText, adminRole === role && styles.roleChipTextActive]}>
                      {ADMIN_ROLE_LABELS[role]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary]}
              disabled={saving || !name.trim() || !email.trim() || password.length < 8}
              onPress={async () => {
                setSaving(true);
                try {
                  await onCreate({
                    name: name.trim(),
                    email: email.trim(),
                    password,
                    adminRole,
                  });
                  reset();
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>{saving ? 'Creating…' : 'Create user'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const role = useAdminRole();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushOpen, setPushOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const data = await getUsers();
    setUsers(data.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    const data = await getUsers();
    setUsers(data.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
    setRefreshing(false);
  }

  function toggleSelect(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function clearSelection() { setSelected(new Set()); }

  async function bulkSend(title: string, body: string) {
    if (!authUser) return;
    if (!can(role, 'send_personal_push')) {
      infoAlert('Not allowed', 'Your role does not allow sending personal push.');
      return;
    }
    const uids = Array.from(selected);
    let sent = 0;
    let failed = 0;
    for (const uid of uids) {
      try {
        await sendPersonalPushFromAdmin(authUser, uid, { title, body });
        sent++;
      } catch {
        failed++;
      }
    }
    setPushOpen(false);
    clearSelection();
    infoAlert('Push queued', `${sent} sent${failed ? `, ${failed} failed` : ''}.`);
  }

  async function handleCreateUser(payload: { name: string; email: string; password: string; adminRole: AdminRole | null }) {
    if (!authUser) return;
    if (!can(role, 'view_users')) {
      infoAlert('Not allowed', 'Your role does not allow creating users.');
      return;
    }
    try {
      const result = await createAdminManagedUser(authUser, payload);
      setCreateOpen(false);
      await refresh();
      infoAlert(
        'User created',
        payload.adminRole
          ? `${payload.name} was created and promoted as ${ADMIN_ROLE_LABELS[payload.adminRole]}.`
          : `${payload.name} was created successfully.`,
      );
      router.push(`/admin/users/${result.uid}` as any);
    } catch (error: any) {
      console.error('create user failed:', error);
      Alert.alert('Could not create user', error?.message || 'Please try again.');
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.state.toLowerCase().includes(q),
    );
  }, [users, search]);

  const complete = filtered.filter((u) => u.onboardingComplete).length;
  const incomplete = filtered.length - complete;
  const selectMode = selected.size > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{users.length}</Text>
          <Text style={styles.statLbl}>Total</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: '#22c55e' }]}>{complete}</Text>
          <Text style={styles.statLbl}>Active</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: '#f59e0b' }]}>{incomplete}</Text>
          <Text style={styles.statLbl}>Incomplete</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statNum, { color: '#8b5cf6' }]}>
            {users.reduce((sum, u) => sum + u.kidsCount, 0)}
          </Text>
          <Text style={styles.statLbl}>Kids logged</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.addUserBtn}
          onPress={() => setCreateOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add-outline" size={16} color="#fff" />
          <Text style={styles.addUserBtnText}>Add user</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email or state…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Selection bar */}
      {selectMode ? (
        <View style={styles.selectBar}>
          <Text style={styles.selectBarText}>{selected.size} selected</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.selectBarBtn} onPress={clearSelection}>
            <Text style={styles.selectBarBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectBarBtn, styles.selectBarBtnPrimary]}
            onPress={() => setPushOpen(true)}
          >
            <Ionicons name="paper-plane-outline" size={13} color="#fff" />
            <Text style={[styles.selectBarBtnText, { color: '#fff' }]}>Send push</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.tipLine}>Long-press to multi-select. Tap to open profile 360.</Text>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>{search ? 'No users match your search' : 'No users yet'}</Text>
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.emptyAction}>Clear search</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        filtered.map((u) => (
          <UserRow
            key={u.uid}
            user={u}
            selectMode={selectMode}
            selected={selected.has(u.uid)}
            onToggleSelect={() => toggleSelect(u.uid)}
            onOpen={() => router.push(`/admin/users/${u.uid}` as any)}
          />
        ))
      )}

      <BulkPushModal
        visible={pushOpen}
        count={selected.size}
        onCancel={() => setPushOpen(false)}
        onSend={bulkSend}
      />
      <CreateUserModal
        visible={createOpen}
        canManageAdminRoles={can(role, 'manage_admin_roles')}
        onCancel={() => setCreateOpen(false)}
        onCreate={handleCreateUser}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 40 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addUserBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  statChip: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  statNum: { fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  statLbl: { fontSize: 10, color: '#9ca3af', marginTop: 1, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },

  selectBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EDE4FF', borderRadius: 12, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.primary,
  },
  selectBarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  selectBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
  },
  selectBarBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selectBarBtnText: { fontSize: 12, fontWeight: '700', color: '#1a1a2e' },

  tipLine: { fontSize: 11, color: '#9ca3af', marginBottom: 8, marginLeft: 4 },

  userCard: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden',
  },
  userCardSelected: { borderColor: Colors.primary, backgroundColor: '#FAF5FF' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  userEmail: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 10, color: '#9ca3af' },
  metaDot: { fontSize: 10, color: '#d1d5db' },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  emptyAction: { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  // Bulk push modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  modalHint: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
  modalInput: {
    backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#1a1a2e', borderWidth: 1, borderColor: '#e5e7eb',
  },
  rolePickerWrap: { gap: 8 },
  rolePickerLabel: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  rolePickerRow: { gap: 8, paddingRight: 4 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  roleChipActive: {
    backgroundColor: '#F3E8FF',
    borderColor: Colors.primary,
  },
  roleChipText: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  roleChipTextActive: { color: Colors.primary },
  modalTextarea: { height: 88, textAlignVertical: 'top' as any },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modalBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  modalBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modalBtnText: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
});
