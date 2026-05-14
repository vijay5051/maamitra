/**
 * Admin · Security events.
 *
 * Read-only feed of chat jailbreak attempts. The Cloudflare Worker
 * (cloudflare-worker/claude-proxy.ts) writes one doc per matched bypass
 * pattern via Firestore REST using the user's own ID token; firestore.rules
 * pins create-only to the owning uid and read-only to admins.
 *
 * Use this to spot users probing the bot for jailbreaks, which patterns
 * are firing most, and whether the OPERATING POLICY block needs another
 * round of hardening.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '../../constants/theme';
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
import { getSecurityEvents, SecurityEvent } from '../../services/admin';

export default function SecurityEvents() {
  const router = useRouter();
  const [rows, setRows] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getSecurityEvents(500));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.uid.toLowerCase().includes(q) ||
      r.msgPreview.toLowerCase().includes(q) ||
      r.patterns.some((p) => p.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  // KPI counters — last 24h vs total
  const stats = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = rows.filter((r) => new Date(r.ts).getTime() >= cutoff);
    const uniqueUidsLast24h = new Set(last24h.map((r) => r.uid)).size;
    const patternCounts: Record<string, number> = {};
    for (const r of rows) {
      for (const p of r.patterns) patternCounts[p] = (patternCounts[p] ?? 0) + 1;
    }
    const topPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      total: rows.length,
      last24h: last24h.length,
      uniqueUidsLast24h,
      topPattern: topPattern ? `${topPattern[0]} (${topPattern[1]})` : '—',
    };
  }, [rows]);

  const columns: Column<SecurityEvent>[] = [
    {
      key: 'ts',
      header: 'When',
      width: 130,
      render: (r) => {
        const d = new Date(r.ts);
        const mins = Math.round((Date.now() - d.getTime()) / 60000);
        const rel = mins < 1 ? 'just now'
          : mins < 60 ? `${mins}m ago`
          : mins < 1440 ? `${Math.round(mins / 60)}h ago`
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return (
          <View>
            <Text style={styles.cellPrimary}>{rel}</Text>
            <Text style={styles.cellMeta}>{d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        );
      },
      sort: (r) => r.ts,
    },
    {
      key: 'uid',
      header: 'User',
      width: 160,
      render: (r) => (
        <Text style={styles.cellMeta} numberOfLines={1}>{r.uid.slice(0, 18)}…</Text>
      ),
      sort: (r) => r.uid,
    },
    {
      key: 'patterns',
      header: 'Patterns matched',
      width: 260,
      render: (r) => (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {r.patterns.slice(0, 4).map((p) => (
            <StatusBadge key={p} label={p} color={Colors.warning} />
          ))}
          {r.patterns.length > 4 ? <Text style={styles.cellMeta}>+{r.patterns.length - 4}</Text> : null}
        </View>
      ),
    },
    {
      key: 'msgPreview',
      header: 'Message preview',
      width: 420,
      render: (r) => (
        <Text style={styles.previewText} numberOfLines={2}>{r.msgPreview || '(empty)'}</Text>
      ),
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Security events' }} />
      <AdminPage
        title="Security events"
        description="Chat jailbreak attempts logged by the Worker every time detectBypassAttempt() matches on a user message. The bot still refuses the request — this feed shows you who's probing, what they tried, and which patterns fire most."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Security events' }]}
        headerActions={<ToolbarButton label="Refresh" icon="refresh" onPress={load} />}
        toolbar={
          <Toolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search uid, message, pattern…',
            }}
            leading={<Text style={styles.countText}>{filtered.length} event{filtered.length === 1 ? '' : 's'}</Text>}
          />
        }
      >
        <View style={styles.statsRow}>
          <StatCard label="Total events" value={stats.total} icon="alert-circle-outline" />
          <StatCard label="Last 24h" value={stats.last24h} icon="time-outline" />
          <StatCard label="Unique users (24h)" value={stats.uniqueUidsLast24h} icon="people-outline" />
          <StatCard label="Top pattern" value={stats.topPattern} icon="flag-outline" />
        </View>

        {error ? (
          <EmptyState
            kind="error"
            title="Couldn't load security events"
            body={`${error}\n\nIf this says 'Missing or insufficient permissions', re-deploy firestore.rules — the securityEvents collection rule may not be live yet.`}
          />
        ) : (
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            loading={loading}
            onRowPress={(r) => router.push(`/admin/users/${r.uid}` as any)}
            emptyTitle={search ? 'No events match' : 'No jailbreak attempts logged yet'}
            emptyBody={search ? 'Try a different search.' : 'When users try to jailbreak the chat, attempts will appear here.'}
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
  previewText: { fontSize: FontSize.xs, color: Colors.textDark, lineHeight: 18 },
});
