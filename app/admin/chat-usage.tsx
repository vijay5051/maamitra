/**
 * Admin · Chat usage.
 *
 * Per-user view of who's actually using the AI chat and how heavily. Shows
 * thread count, total messages, user-authored messages, last-7d messages,
 * and an "intensity" metric (messages per active day in the last 7 days).
 *
 * The intensity column is the abuse signal — if a single uid is well above
 * the rest, that's the one to throttle. We highlight rows over 50 msg/day
 * as "heavy", but the threshold is purely visual; rate limits will live in
 * services/claude.ts when we add them.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/theme';
import { ChatUsageReport, ChatUsageRow, getChatUsageReport } from '../../services/admin';

type SortKey = 'messages' | 'threads' | 'last7d' | 'intensity' | 'last';

const HEAVY_INTENSITY = 50;

export default function ChatUsage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [report, setReport] = useState<ChatUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>('messages');
  const [search, setSearch] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setReport(await getChatUsageReport());
    setLoading(false);
  }
  async function refresh() {
    setRefreshing(true);
    setReport(await getChatUsageReport());
    setRefreshing(false);
  }

  const rows = useMemo(() => {
    if (!report) return [] as ChatUsageRow[];
    let r = [...report.rows];
    const q = search.toLowerCase().trim();
    if (q) {
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.email.toLowerCase().includes(q) ||
        x.uid.toLowerCase().includes(q),
      );
    }
    r.sort((a, b) => {
      switch (sort) {
        case 'threads':   return b.threadCount - a.threadCount;
        case 'last7d':    return b.messagesLast7d - a.messagesLast7d;
        case 'intensity': return b.intensity - a.intensity;
        case 'last':      return (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '');
        case 'messages':
        default:          return b.messageCount - a.messageCount;
      }
    });
    return r;
  }, [report, search, sort]);

  const heavy = rows.filter((r) => r.intensity >= HEAVY_INTENSITY).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      <LinearGradient colors={['#FED7AA', '#FDBA74']} style={styles.headerCard}>
        <Text style={styles.headerEyebrow}>Admin · Chat</Text>
        <Text style={styles.headerTitle}>Usage & intensity</Text>
        <Text style={styles.headerSub}>
          {report ? `${report.totals.chatUsers} chat user${report.totals.chatUsers === 1 ? '' : 's'} · ${report.totals.totalThreads} threads · ${report.totals.totalMessages.toLocaleString('en-IN')} messages` : 'Loading…'}
          {heavy > 0 ? `  · ${heavy} heavy user${heavy === 1 ? '' : 's'}` : ''}
        </Text>
      </LinearGradient>

      {/* Top stats */}
      {report ? (
        <View style={styles.statsRow}>
          <Stat value={report.totals.chatUsers} label="Chat users" tint="#8B5CF6" />
          <Stat value={report.totals.activeLast7d} label="Active 7d" tint="#10B981" />
          <Stat value={report.totals.totalThreads} label="Threads" tint="#0EA5E9" />
          <Stat value={report.totals.totalMessages} label="Messages" tint={Colors.primary} />
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, email, uid…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Sort chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {([
          ['messages', 'Total messages'],
          ['threads', 'Threads'],
          ['last7d', 'Last 7 days'],
          ['intensity', 'Intensity'],
          ['last', 'Last active'],
        ] as Array<[SortKey, string]>).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.sortChip, sort === k && styles.sortChipActive]}
            onPress={() => setSort(k)}
          >
            <Text style={[styles.sortChipText, sort === k && { color: '#fff' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
      ) : report?.error ? (
        <View style={styles.empty}>
          <Ionicons name="warning-outline" size={36} color="#EF4444" />
          <Text style={[styles.emptyText, { color: '#EF4444', fontWeight: '700' }]}>
            Could not read chat threads
          </Text>
          <Text style={[styles.emptyText, { fontSize: 11, paddingHorizontal: 20, textAlign: 'center' }]}>
            {report.error}
          </Text>
          <Text style={[styles.emptyText, { fontSize: 11, paddingHorizontal: 20, textAlign: 'center', marginTop: 6 }]}>
            Likely a Firestore rules issue on the `threads` collectionGroup. Re-deploy rules and retry.
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>{search ? 'No matches.' : 'Nobody has used chat yet.'}</Text>
          <Text style={[styles.emptyText, { fontSize: 11, paddingHorizontal: 20, textAlign: 'center', marginTop: 4 }]}>
            (We see {report?.totals.totalThreads ?? 0} thread doc{(report?.totals.totalThreads ?? 0) === 1 ? '' : 's'} in Firestore. If users have chatted but this is 0, the writes are silently failing — check browser console on the chat tab.)
          </Text>
        </View>
      ) : rows.map((r) => {
        const heavy = r.intensity >= HEAVY_INTENSITY;
        return (
          <Pressable
            key={r.uid}
            style={[styles.row, heavy && styles.rowHeavy]}
            onPress={() => router.push(`/admin/users/${r.uid}` as any)}
          >
            <View style={styles.rowHead}>
              <View style={[styles.intensityBadge, { backgroundColor: heavy ? '#EF4444' : r.intensity >= 20 ? '#F59E0B' : '#10B981' }]}>
                <Text style={styles.intensityValue}>{Math.round(r.intensity)}</Text>
                <Text style={styles.intensityUnit}>/d</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{r.email || r.uid.slice(0, 12)}</Text>
              </View>
              {heavy ? (
                <View style={styles.heavyTag}>
                  <Ionicons name="flame" size={11} color="#fff" />
                  <Text style={styles.heavyTagText}>Heavy</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
            </View>
            <View style={styles.rowMetricsGrid}>
              <Metric label="Total messages" value={r.messageCount} />
              <Metric label="From user" value={r.userMessageCount} />
              <Metric label="Threads" value={r.threadCount} />
              <Metric label="Last 7d" value={r.messagesLast7d} />
              <Metric label="Last active" value={r.lastActivity ? new Date(r.lastActivity).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'} />
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.foot}>
        Intensity = messages per active day in the last 7 days. Heavy = 50+/day.
        We don't render message bodies here — open the user 360 if you need
        the conversation context.
      </Text>
    </ScrollView>
  );
}

function Stat({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <View style={[styles.stat, { borderTopColor: tint }]}>
      <Text style={[styles.statValue, { color: tint }]}>{value.toLocaleString('en-IN')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { padding: 16, gap: 12 },

  headerCard: { borderRadius: 16, padding: 16 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: '#92400E', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a2e', marginTop: 2 },
  headerSub: { fontSize: 12, color: '#78350F', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 6 },
  stat: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10,
    alignItems: 'center', borderTopWidth: 3, borderColor: '#F0EDF5', borderWidth: 1,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 9, color: '#6B7280', marginTop: 2, textTransform: 'uppercase', fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipText: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },

  empty: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  row: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F0EDF5', gap: 10,
  },
  rowHeavy: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intensityBadge: {
    width: 50, paddingVertical: 6, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  intensityValue: { color: '#fff', fontSize: 14, fontWeight: '800' },
  intensityUnit: { color: '#fff', fontSize: 9, fontWeight: '700', marginTop: -1 },
  rowName: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  rowMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  heavyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EF4444', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  heavyTagText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  rowMetricsGrid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metric: {
    flex: 1, minWidth: 80, backgroundColor: Colors.bgLight, borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  metricValue: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  metricLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2, textTransform: 'uppercase', fontWeight: '700' },

  foot: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
