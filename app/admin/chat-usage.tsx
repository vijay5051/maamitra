/**
 * Admin · Chat usage.
 *
 * Per-user view of who's using AI chat and how heavily. The intensity
 * column (messages-per-active-day in last 7d) is the abuse signal —
 * if a single uid stands well above the rest, throttle them.
 *
 * Wave 3 rebuild: AdminPage shell, KPI grid, paginated DataTable with
 * sortable columns, intensity badge inline.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  DataTable,
  EmptyState,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { ChatUsageReport, ChatUsageRow, getChatUsageReport } from '../../services/admin';

const HEAVY_INTENSITY = 50;

export default function ChatUsage() {
  const router = useRouter();
  const [report, setReport] = useState<ChatUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getChatUsageReport();
      setReport(r);
      if (r.error) setError(r.error);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!report) return [] as ChatUsageRow[];
    const q = search.trim().toLowerCase();
    if (!q) return report.rows;
    return report.rows.filter((x) =>
      x.name.toLowerCase().includes(q) ||
      x.email.toLowerCase().includes(q) ||
      x.uid.toLowerCase().includes(q),
    );
  }, [report, search]);

  const heavyCount = useMemo(
    () => rows.filter((r) => r.intensity >= HEAVY_INTENSITY).length,
    [rows],
  );

  const columns: Column<ChatUsageRow>[] = [
    {
      key: 'intensity',
      header: 'Intensity',
      width: 130,
      render: (r) => {
        const heavy = r.intensity >= HEAVY_INTENSITY;
        const med = r.intensity >= 20;
        const color = heavy ? Colors.error : med ? Colors.warning : Colors.success;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeValue}>{Math.round(r.intensity)}</Text>
              <Text style={styles.badgeUnit}>/d</Text>
            </View>
            {heavy ? <StatusBadge label="Heavy" color={Colors.error} /> : null}
          </View>
        );
      },
      sort: (r) => r.intensity,
    },
    {
      key: 'name',
      header: 'User',
      width: 220,
      render: (r) => (
        <View>
          <Text style={styles.cellPrimary} numberOfLines={1}>{r.name || '—'}</Text>
          <Text style={styles.cellMeta} numberOfLines={1}>{r.email || r.uid.slice(0, 12)}</Text>
        </View>
      ),
      sort: (r) => r.name,
    },
    {
      key: 'messageCount',
      header: 'Total msgs',
      width: 120,
      align: 'right',
      render: (r) => <Text style={styles.cellNumber}>{r.messageCount.toLocaleString('en-IN')}</Text>,
      sort: (r) => r.messageCount,
    },
    {
      key: 'userMessageCount',
      header: 'From user',
      width: 110,
      align: 'right',
      render: (r) => <Text style={styles.cellNumber}>{r.userMessageCount.toLocaleString('en-IN')}</Text>,
      sort: (r) => r.userMessageCount,
    },
    {
      key: 'threadCount',
      header: 'Threads',
      width: 100,
      align: 'right',
      render: (r) => <Text style={styles.cellNumber}>{r.threadCount}</Text>,
      sort: (r) => r.threadCount,
    },
    {
      key: 'messagesLast7d',
      header: 'Last 7d',
      width: 100,
      align: 'right',
      render: (r) => <Text style={styles.cellNumber}>{r.messagesLast7d}</Text>,
      sort: (r) => r.messagesLast7d,
    },
    {
      key: 'lastActivity',
      header: 'Last active',
      width: 130,
      align: 'right',
      render: (r) => (
        <Text style={styles.cellMeta}>
          {r.lastActivity
            ? new Date(r.lastActivity).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : '—'}
        </Text>
      ),
      sort: (r) => r.lastActivity ?? '',
    },
  ];

  const totals = report?.totals;

  return (
    <>
      <Stack.Screen options={{ title: 'Chat usage' }} />
      <AdminPage
        title="Chat usage & intensity"
        description="Who's using AI chat, how heavily, and which users to throttle. Intensity = messages per active day in the last 7 days. Heavy = 50+/day."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Chat usage' }]}
        headerActions={<ToolbarButton label="Refresh" icon="refresh" onPress={load} />}
        toolbar={
          <Toolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search name, email, uid…',
            }}
            leading={<Text style={styles.countText}>{rows.length} users · {heavyCount} heavy</Text>}
          />
        }
      >
        {totals ? (
          <View style={styles.statsRow}>
            <StatCard label="Chat users"   value={totals.chatUsers}      icon="people-outline" />
            <StatCard label="Active 7d"    value={totals.activeLast7d}   icon="radio-outline" />
            <StatCard label="Threads"      value={totals.totalThreads}   icon="git-branch-outline" />
            <StatCard label="Total msgs"   value={totals.totalMessages}  icon="chatbubbles-outline" />
          </View>
        ) : null}

        {error ? (
          <EmptyState
            kind="error"
            title="Couldn't read chat threads"
            body={`${error}\n\nLikely a Firestore rules issue on the 'threads' collectionGroup. Re-deploy rules and retry.`}
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.uid}
            loading={loading}
            onRowPress={(r) => router.push(`/admin/users/${r.uid}` as any)}
            emptyTitle={search ? 'No users match' : 'No chat activity yet'}
            emptyBody={search ? 'Try a different search.' : 'Once users start chatting, their stats appear here.'}
          />
        )}
      </AdminPage>
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  cellNumber: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, fontVariant: ['tabular-nums'] },
  badge: {
    width: 56,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeValue: { color: Colors.white, fontSize: FontSize.md, fontWeight: '800' },
  badgeUnit: { color: Colors.white, fontSize: 9, fontWeight: '700', marginTop: -1 },
});
