/**
 * Admin · Safety queue.
 *
 * Wave 4. Shows crisis_queue items — posts that auto-flagged for crisis
 * language (PPD, self-harm, abuse, eating disorder). Each row carries the
 * Vandrevala helpline + actions: assign to admin, mark resolved, escalate.
 *
 * NOT a content moderation surface. The post itself stays live — flagged
 * posts get *more* visibility, not less, because community support
 * matters. This queue is for wellness outreach.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { logAdminAction } from '../../services/audit';
import { CrisisSeverity, CRISIS_SEVERITY_COLORS } from '../../lib/adminEnums';
import { CRISIS_HOTLINE } from '../../lib/crisisDetect';

interface CrisisItem {
  id: string;
  authorUid: string;
  authorName: string | null;
  source: 'community_post' | 'comment' | 'message';
  docId: string | null;
  severity: CrisisSeverity;
  categories: string[];
  matches: string[];
  snippet: string;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  assignedTo: string | null;
  createdAt: any;
}

const STATUS_LABELS: Record<CrisisItem['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

const STATUS_COLORS: Record<CrisisItem['status'], string> = {
  open: Colors.error,
  in_progress: Colors.warning,
  resolved: Colors.success,
  escalated: '#7f1d1d',
};

export default function SafetyQueue() {
  const router = useRouter();
  const { user: actor } = useAuthStore();

  const [items, setItems] = useState<CrisisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'open' | 'all' | 'resolved'>('open');
  const [confirm, setConfirm] = useState<null | { title: string; body: string; run: () => Promise<void>; destructive?: boolean }>(null);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const q = query(collection(db, 'crisis_queue'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: CrisisItem[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            authorUid: data.authorUid ?? '',
            authorName: data.authorName ?? null,
            source: data.source ?? 'community_post',
            docId: data.docId ?? null,
            severity: data.severity ?? 'medium',
            categories: Array.isArray(data.categories) ? data.categories : [],
            matches: Array.isArray(data.matches) ? data.matches : [],
            snippet: data.snippet ?? '',
            status: data.status ?? 'open',
            assignedTo: data.assignedTo ?? null,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
          };
        });
        setItems(next);
        setLoading(false);
      },
      (e) => {
        setError(e.message ?? String(e));
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === 'open' && !(it.status === 'open' || it.status === 'in_progress')) return false;
      if (filter === 'resolved' && !(it.status === 'resolved' || it.status === 'escalated')) return false;
      if (!q) return true;
      return (
        (it.authorName ?? '').toLowerCase().includes(q) ||
        it.snippet.toLowerCase().includes(q) ||
        it.matches.join(' ').toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    open: items.filter((i) => i.status === 'open' || i.status === 'in_progress').length,
    critical: items.filter((i) => i.severity === 'critical' && (i.status === 'open' || i.status === 'in_progress')).length,
    resolved: items.filter((i) => i.status === 'resolved').length,
    total: items.length,
  }), [items]);

  async function setStatus(it: CrisisItem, next: CrisisItem['status']) {
    if (!db || !actor) return;
    try {
      await updateDoc(doc(db, 'crisis_queue', it.id), {
        status: next,
        assignedTo: next === 'in_progress' ? actor.uid : it.assignedTo,
        updatedAt: serverTimestamp(),
      });
      if (next === 'escalated') {
        await logAdminAction(
          actor,
          'crisis.escalate',
          { uid: it.authorUid, docId: it.id },
          { severity: it.severity, categories: it.categories },
        );
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  function callHotline() {
    Linking.openURL(`tel:${CRISIS_HOTLINE.phone.replace(/-/g, '')}`).catch(() => { /* ignore */ });
  }

  const filterChips = [
    { key: 'open', label: 'Open', count: counts.open },
    { key: 'all', label: 'All', count: counts.total },
    { key: 'resolved', label: 'Resolved', count: counts.resolved },
  ];

  const columns: Column<CrisisItem>[] = [
    {
      key: 'severity',
      header: 'Severity',
      width: 110,
      render: (it) => (
        <StatusBadge
          label={it.severity.toUpperCase()}
          color={CRISIS_SEVERITY_COLORS[it.severity]}
          variant={it.severity === 'critical' ? 'solid' : 'tint'}
        />
      ),
      sort: (it) => it.severity,
    },
    {
      key: 'author',
      header: 'Author',
      width: 180,
      render: (it) => (
        <View>
          <Text style={styles.cellPrimary} numberOfLines={1}>{it.authorName ?? '—'}</Text>
          <Text style={styles.cellMeta} numberOfLines={1}>{it.source.replace('_', ' ')}</Text>
        </View>
      ),
      sort: (it) => it.authorName ?? '',
    },
    {
      key: 'snippet',
      header: 'Snippet',
      render: (it) => (
        <View>
          <Text style={styles.cellBody} numberOfLines={2}>"{it.snippet}"</Text>
          {it.matches.length > 0 ? (
            <Text style={styles.cellMeta} numberOfLines={1}>
              matched: {it.matches.slice(0, 3).join(', ')}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (it) => (
        <StatusBadge label={STATUS_LABELS[it.status]} color={STATUS_COLORS[it.status]} />
      ),
      sort: (it) => it.status,
    },
    {
      key: 'createdAt',
      header: 'Flagged',
      width: 130,
      align: 'right',
      render: (it) => (
        <Text style={styles.cellMeta}>
          {it.createdAt
            ? new Date(it.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '—'}
        </Text>
      ),
      sort: (it) => it.createdAt ?? '',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Safety queue' }} />
      <AdminPage
        title="Safety queue"
        description={`Posts auto-flagged for crisis language (PPD, self-harm, abuse). The post stays live — community support matters. This queue is for wellness outreach.`}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Safety' }]}
        headerActions={
          <ToolbarButton
            label={`Hotline · ${CRISIS_HOTLINE.phone}`}
            icon="call-outline"
            variant="primary"
            onPress={callHotline}
          />
        }
        toolbar={
          <View style={{ gap: 10 }}>
            <Toolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search snippet, author, matched terms…',
              }}
            />
            <FilterBar chips={filterChips} active={filter} onChange={(k) => setFilter(k as any)} />
          </View>
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Open"          value={counts.open}     icon="alert-circle-outline" deltaPositive="down" />
          <StatCard label="Critical open" value={counts.critical} icon="warning-outline"      deltaPositive="down" />
          <StatCard label="Resolved"      value={counts.resolved} icon="checkmark-done-outline" />
          <StatCard label="Total"         value={counts.total}    icon="archive-outline" />
        </View>

        <View style={styles.hotlineCard}>
          <Text style={styles.hotlineLabel}>Crisis support — for the author</Text>
          <Text style={styles.hotlineName}>{CRISIS_HOTLINE.name}</Text>
          <Text style={styles.hotlinePhone}>{CRISIS_HOTLINE.phone}</Text>
          <Text style={styles.hotlineMessage}>{CRISIS_HOTLINE.message}</Text>
        </View>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(it) => it.id}
          loading={loading}
          onRowPress={(it) => {
            if (it.source === 'community_post' && it.docId) {
              router.push(`/admin/community` as any);
            } else if (it.authorUid) {
              router.push(`/admin/users/${it.authorUid}` as any);
            }
          }}
          emptyTitle={filter === 'open' ? 'Queue is clear' : 'No items'}
          emptyBody={filter === 'open' ? 'Nothing waiting on outreach right now.' : 'Adjust the filter to see more.'}
        />

        {filtered.length > 0 ? (
          <View style={styles.actionsBar}>
            <Text style={styles.actionsHint}>Quick actions on the most recent open item:</Text>
            {(() => {
              const top = filtered.find((it) => it.status === 'open' || it.status === 'in_progress');
              if (!top) return null;
              return (
                <View style={styles.actionsRow}>
                  <ToolbarButton label="Take" icon="hand-left-outline" onPress={() => setStatus(top, 'in_progress')} />
                  <ToolbarButton
                    label="Resolve"
                    icon="checkmark-done-outline"
                    variant="primary"
                    onPress={() => setConfirm({
                      title: 'Mark resolved?',
                      body: 'Mark this case as resolved after wellness outreach. The original post is unaffected.',
                      run: async () => setStatus(top, 'resolved'),
                    })}
                  />
                  <ToolbarButton
                    label="Escalate"
                    icon="warning-outline"
                    variant="danger"
                    onPress={() => setConfirm({
                      title: 'Escalate this case?',
                      body: 'Escalation logs to the audit trail. Use when the case needs senior review or external referral.',
                      destructive: true,
                      run: async () => setStatus(top, 'escalated'),
                    })}
                  />
                </View>
              );
            })()}
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            kind="empty"
            title="No flags yet"
            body="When user-generated content matches crisis language (PPD, self-harm, abuse), it will appear here for wellness outreach."
            compact
          />
        ) : null}
      </AdminPage>

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title ?? ''}
        body={confirm?.body}
        destructive={confirm?.destructive}
        confirmLabel="Confirm"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          if (c) await c.run();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  cellBody: { fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19, fontStyle: 'italic' },
  hotlineCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: '#FECACA',
    padding: Spacing.lg,
    gap: 4,
  },
  hotlineLabel: {
    fontSize: 11, fontWeight: '700', color: '#7f1d1d',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  hotlineName: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark, marginTop: 4 },
  hotlinePhone: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.error, fontVariant: ['tabular-nums'] },
  hotlineMessage: { fontSize: FontSize.sm, color: '#7f1d1d', marginTop: 4 },
  actionsBar: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  actionsHint: { fontSize: FontSize.xs, color: Colors.textLight },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
});
