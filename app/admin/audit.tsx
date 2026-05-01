/**
 * Admin · Audit log.
 *
 * Read-only stream of every admin write action. Useful when more than one
 * admin is on the team — answers "who deleted that user / changed that
 * flag / hid that post".
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/theme';
import { AuditEntry, getRecentAuditEntries } from '../../services/audit';

const ACTION_TINT: Record<string, string> = {
  'user.delete': '#EF4444',
  'user.role.change': '#8B5CF6',
  'user.adminRole.change': '#3B82F6',
  'user.export': '#06B6D4',
  'post.approve': '#10B981',
  'post.hide': '#F59E0B',
  'post.unhide': '#10B981',
  'post.delete': '#EF4444',
  'comment.delete': '#EF4444',
  'support.reply': '#3B82F6',
  'support.close': '#10B981',
  'support.reopen': '#F59E0B',
  'push.personal': '#3B82F6',
  'push.broadcast': '#EC4899',
  'push.schedule': '#8B5CF6',
  'push.cancel': '#6B7280',
  'banner.publish': '#EC4899',
  'banner.clear': '#6B7280',
  'factory.reset': '#B91C1C',
  'content.create': '#06B6D4',
  'content.update': '#06B6D4',
  'content.delete': '#EF4444',
  'content.publish': '#10B981',
  'vaccine.update': '#10B981',
  'settings.update': '#8B5CF6',
  'flag.update': '#F59E0B',
};

export default function AuditLog() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setEntries(await getRecentAuditEntries(150));
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    setEntries(await getRecentAuditEntries(150));
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.action.toLowerCase().includes(q) ||
      e.actorEmail.toLowerCase().includes(q) ||
      (e.target.uid ?? '').toLowerCase().includes(q) ||
      (e.target.docId ?? '').toLowerCase().includes(q) ||
      (e.target.label ?? '').toLowerCase().includes(q),
    );
  }, [entries, search]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      <LinearGradient colors={['#F5F0FF', '#EDE4FF']} style={styles.headerCard}>
        <Text style={styles.headerEyebrow}>Admin · Compliance</Text>
        <Text style={styles.headerTitle}>Audit log</Text>
        <Text style={styles.headerSub}>{entries.length} most recent admin actions. Append-only.</Text>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by action, admin email, or target id…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>{search ? 'No entries match.' : 'No audit entries yet.'}</Text>
        </View>
      ) : filtered.map((e) => {
        const tint = ACTION_TINT[e.action] ?? '#6B7280';
        return (
          <View key={e.id} style={styles.row}>
            <View style={[styles.actionChip, { backgroundColor: `${tint}1A`, borderColor: `${tint}40` }]}>
              <Text style={[styles.actionChipText, { color: tint }]}>{e.action}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowActor}>{e.actorEmail || 'unknown'}</Text>
              <Text style={styles.rowTarget} numberOfLines={1}>
                {e.target.label ? `"${e.target.label}" · ` : ''}
                {e.target.uid ? `uid: ${e.target.uid.slice(0, 10)}…` : ''}
                {e.target.docId ? ` doc: ${e.target.docId.slice(0, 10)}…` : ''}
              </Text>
              {e.meta && Object.keys(e.meta).length > 0 ? (
                <Text style={styles.rowMeta} numberOfLines={2}>{JSON.stringify(e.meta)}</Text>
              ) : null}
            </View>
            <Text style={styles.rowTime}>{e.createdAt ? new Date(e.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { padding: 16, gap: 8 },

  headerCard: { borderRadius: 16, padding: 16 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a2e', marginTop: 2 },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  empty: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  actionChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  actionChipText: { fontSize: 10, fontWeight: '800' },
  rowActor: { fontSize: 12, fontWeight: '700', color: '#1a1a2e' },
  rowTarget: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  rowMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
  rowTime: { fontSize: 10, color: '#9CA3AF' },
});
