/**
 * Admin · Audit log.
 *
 * Read-only stream of every admin write action. When more than one admin
 * is on the team, this answers "who deleted that user / changed that flag
 * / hid that post".
 *
 * Wave 3 rebuild: AdminPage shell, paginated DataTable, search via Toolbar,
 * StatusBadge for action chips, action filter chips, CSV export.
 */
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  DataTable,
  FilterBar,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { labelForAuditAction } from '../../lib/adminEnums';
import { AuditEntry, getRecentAuditEntries } from '../../services/audit';

const ACTION_TINT: Record<string, string> = {
  'user.delete': Colors.error,
  'user.role.change': Colors.primary,
  'user.adminRole.change': '#3B82F6',
  'user.export': '#06B6D4',
  'post.approve': Colors.success,
  'post.hide': Colors.warning,
  'post.unhide': Colors.success,
  'post.delete': Colors.error,
  'comment.delete': Colors.error,
  'support.reply': '#3B82F6',
  'support.close': Colors.success,
  'support.reopen': Colors.warning,
  'push.personal': '#3B82F6',
  'push.broadcast': '#EC4899',
  'push.schedule': Colors.primary,
  'push.cancel': Colors.textMuted,
  'banner.publish': '#EC4899',
  'banner.clear': Colors.textMuted,
  'factory.reset': '#B91C1C',
  'content.create': '#06B6D4',
  'content.update': '#06B6D4',
  'content.delete': Colors.error,
  'content.publish': Colors.success,
  'vaccine.update': Colors.success,
  'settings.update': Colors.primary,
  'flag.update': Colors.warning,
  'flag.toggle': Colors.warning,
  'flag.rollout_change': Colors.warning,
  'maintenance.enable': Colors.error,
  'maintenance.disable': Colors.success,
  'force_update.set': '#B91C1C',
  'image.unflag': Colors.success,
  'crisis.escalate': '#B91C1C',
  'role.create': Colors.primary,
  'role.update': Colors.primary,
  'role.delete': Colors.error,
  'vaccine_schedule.signoff': Colors.success,
  'rtbf.process': '#06B6D4',
  'user.impersonate.start': Colors.warning,
  'user.impersonate.end': Colors.success,
  'function.replay': Colors.primary,
  'cron.replay': Colors.primary,
};

type ActionGroup = 'all' | 'user' | 'post' | 'support' | 'push' | 'config';

function actionGroup(action: string): ActionGroup {
  if (action.startsWith('user.')) return 'user';
  if (action.startsWith('post.') || action.startsWith('comment.')) return 'post';
  if (action.startsWith('support.')) return 'support';
  if (action.startsWith('push.')) return 'push';
  return 'config';
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<ActionGroup>('all');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const next = await getRecentAuditEntries(250);
      setEntries(next);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (group !== 'all' && actionGroup(e.action) !== group) return false;
      if (!q) return true;
      return (
        e.action.toLowerCase().includes(q) ||
        e.actorEmail.toLowerCase().includes(q) ||
        (e.target.uid ?? '').toLowerCase().includes(q) ||
        (e.target.docId ?? '').toLowerCase().includes(q) ||
        (e.target.label ?? '').toLowerCase().includes(q)
      );
    });
  }, [entries, search, group]);

  const counts = useMemo(() => {
    const c = { all: entries.length, user: 0, post: 0, support: 0, push: 0, config: 0 } as Record<ActionGroup, number>;
    for (const e of entries) c[actionGroup(e.action)]++;
    return c;
  }, [entries]);

  const filterChips = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'user', label: 'Users', count: counts.user },
    { key: 'post', label: 'Posts & comments', count: counts.post },
    { key: 'support', label: 'Support', count: counts.support },
    { key: 'push', label: 'Push', count: counts.push },
    { key: 'config', label: 'Config', count: counts.config },
  ];

  function exportCsv() {
    const header = ['createdAt', 'actorEmail', 'action', 'targetUid', 'targetDocId', 'meta'];
    const rows = filtered.map((e) => [
      e.createdAt,
      e.actorEmail,
      e.action,
      e.target.uid ?? '',
      e.target.docId ?? '',
      e.meta ? JSON.stringify(e.meta).replace(/"/g, '""') : '',
    ].map((v) => `"${String(v)}"`).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const columns: Column<AuditEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      width: 220,
      render: (e) => (
        <StatusBadge
          label={labelForAuditAction(e.action)}
          color={ACTION_TINT[e.action] ?? Colors.textMuted}
        />
      ),
    },
    {
      key: 'actor',
      header: 'Admin',
      width: 220,
      render: (e) => (
        <Text style={styles.cellPrimary} numberOfLines={1}>
          {e.actorEmail || '—'}
        </Text>
      ),
      sort: (e) => e.actorEmail,
    },
    {
      key: 'target',
      header: 'Target',
      render: (e) => {
        const parts: string[] = [];
        if (e.target.label) parts.push(`"${e.target.label}"`);
        if (e.target.uid) parts.push(`uid: ${e.target.uid.slice(0, 10)}…`);
        if (e.target.docId) parts.push(`doc: ${e.target.docId.slice(0, 10)}…`);
        return (
          <View>
            <Text style={styles.cellPrimary} numberOfLines={1}>{parts.join(' · ') || '—'}</Text>
            {e.meta && Object.keys(e.meta).length > 0 ? (
              <Text style={styles.cellMeta} numberOfLines={2}>{JSON.stringify(e.meta)}</Text>
            ) : null}
          </View>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'When',
      width: 150,
      align: 'right',
      render: (e) => (
        <Text style={styles.cellMeta}>
          {e.createdAt
            ? new Date(e.createdAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })
            : '—'}
        </Text>
      ),
      sort: (e) => e.createdAt,
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Audit log' }} />
      <AdminPage
        title="Audit log"
        description={`${entries.length} most recent admin actions. Append-only — every write to user data, content, push, settings, and feature flags lands here.`}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Audit log' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            {Platform.OS === 'web' ? (
              <ToolbarButton label="Export CSV" icon="download-outline" variant="primary" onPress={exportCsv} />
            ) : null}
          </>
        }
        toolbar={
          <View style={{ gap: 10 }}>
            <Toolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search by action, admin email, target uid / doc id…',
              }}
            />
            <FilterBar chips={filterChips} active={group} onChange={(k) => setGroup(k as ActionGroup)} />
          </View>
        }
      >
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(e) => e.id}
          loading={loading}
          error={error}
          emptyTitle={search || group !== 'all' ? 'No entries match' : 'No audit entries yet'}
          emptyBody={search || group !== 'all'
            ? 'Try a different search or clear the filter.'
            : 'Admin actions will stream into this log as they happen.'}
        />
      </AdminPage>
    </>
  );
}

const styles = StyleSheet.create({
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
});
