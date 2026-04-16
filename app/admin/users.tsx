/**
 * Admin — User Management
 * Lists all registered users from Firestore with profile stats.
 * Supports search, view profile details, and delete user data.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AdminUser, getUsers, deleteUserData } from '../../services/firebase';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  const colors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({ user, onDelete }: { user: AdminUser; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Unknown';

  return (
    <View style={styles.userCard}>
      <TouchableOpacity style={styles.userRow} onPress={() => setExpanded((v) => !v)} activeOpacity={0.75}>
        <Avatar name={user.name} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name || 'Unnamed'}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
        </View>
        <View style={styles.userMeta}>
          <View style={[styles.statusDot, { backgroundColor: user.onboardingComplete ? '#22c55e' : '#f59e0b' }]} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
            <Text style={styles.detailText}>Joined: {joinDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={13} color="#9ca3af" />
            <Text style={styles.detailText}>{user.kidsCount} child profile{user.kidsCount !== 1 ? 's' : ''}</Text>
          </View>
          {user.state ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={13} color="#9ca3af" />
              <Text style={styles.detailText}>{user.state}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#9ca3af" />
            <Text style={styles.detailText}>
              Onboarding: {user.onboardingComplete ? '✅ Complete' : '⏳ Incomplete'}
            </Text>
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
            <Text style={styles.deleteBtnText}>Delete User Data</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

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

  function handleDelete(user: AdminUser) {
    Alert.alert(
      'Delete User Data',
      `Remove all Firestore data for ${user.name} (${user.email})?\n\nThis does NOT delete their Firebase Auth account — they can still sign in but will start fresh.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Data',
          style: 'destructive',
          onPress: async () => {
            await deleteUserData(user.uid);
            setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
          },
        },
      ]
    );
  }

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.state.toLowerCase().includes(search.toLowerCase())
  );

  const complete = filtered.filter((u) => u.onboardingComplete).length;
  const incomplete = filtered.length - complete;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ec4899" />}
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

      {/* List */}
      {loading ? (
        <ActivityIndicator color="#ec4899" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>{search ? 'No users match your search' : 'No users yet'}</Text>
        </View>
      ) : (
        filtered.map((u) => (
          <UserRow key={u.uid} user={u} onDelete={() => handleDelete(u)} />
        ))
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, paddingBottom: 40 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
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
    paddingVertical: 10, marginBottom: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },

  userCard: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  userEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  expandedContent: {
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    padding: 14, gap: 8, backgroundColor: '#fafafa',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: '#4b5563' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  deleteBtnText: { fontSize: 13, color: '#ef4444', fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
