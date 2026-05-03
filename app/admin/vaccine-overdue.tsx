/**
 * Admin · Vaccine overdue ops.
 *
 * For every signed-up user with kids, walks the IAP schedule and surfaces
 * doses past due. Bulk-select to send reminder pushes.
 *
 * Wave 3 rebuild: AdminPage shell, threshold filter chips, DataTable with
 * bulk-select + bulk-push, KPI row (overdue count / kids / parents),
 * severity badge inline.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  ConfirmDialog,
  DataTable,
  FilterBar,
  StatCard,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import {
  getOverdueVaccines,
  OverdueVaccine,
  sendVaccineReminderPush,
} from '../../services/admin';

function rowKey(r: OverdueVaccine): string {
  return `${r.uid}_${r.kidId}_${r.vaccineId}`;
}

export default function VaccineOverdue() {
  const router = useRouter();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();
  const canPush = can(role, 'send_personal_push');

  const [rows, setRows] = useState<OverdueVaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [thresholdDays, setThresholdDays] = useState<number>(7);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | (() => Promise<void>)>(null);

  useEffect(() => { void load(); }, [thresholdDays]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getOverdueVaccines(thresholdDays));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function askBulkRemind() {
    if (!actor || !canPush) return;
    const ids = Array.from(selected);
    const targets = rows.filter((r) => ids.includes(rowKey(r)));
    if (targets.length === 0) return;
    setConfirm(() => async () => {
      setBusy(true);
      try {
        await sendVaccineReminderPush(
          actor,
          targets.map((t) => ({
            uid: t.uid,
            kidName: t.kidName,
            vaccineName: t.vaccineName,
            daysOverdue: t.daysOverdue,
          })),
        );
        setSelected(new Set());
      } finally {
        setBusy(false);
      }
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.userName.toLowerCase().includes(q) ||
      r.kidName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.vaccineName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalKids = useMemo(
    () => new Set(rows.map((r) => `${r.uid}_${r.kidId}`)).size,
    [rows],
  );
  const totalParents = useMemo(() => new Set(rows.map((r) => r.uid)).size, [rows]);

  const filterChips = [
    { key: '7', label: '7 days', count: undefined },
    { key: '14', label: '14 days', count: undefined },
    { key: '30', label: '30 days', count: undefined },
  ];

  const columns: Column<OverdueVaccine>[] = [
    {
      key: 'severity',
      header: 'Days late',
      width: 110,
      render: (r) => {
        const color = r.daysOverdue >= 30 ? Colors.error : r.daysOverdue >= 14 ? Colors.warning : '#FBBF24';
        return (
          <View style={[styles.sevBadge, { backgroundColor: color }]}>
            <Text style={styles.sevText}>{r.daysOverdue}d</Text>
          </View>
        );
      },
      sort: (r) => r.daysOverdue,
    },
    {
      key: 'vaccineName',
      header: 'Vaccine',
      width: 180,
      render: (r) => <Text style={styles.cellPrimary} numberOfLines={1}>{r.vaccineName}</Text>,
      sort: (r) => r.vaccineName,
    },
    {
      key: 'kid',
      header: 'Kid · parent',
      render: (r) => (
        <View>
          <Text style={styles.cellPrimary} numberOfLines={1}>{r.kidName}</Text>
          <Text style={styles.cellMeta} numberOfLines={1}>
            {r.userName}{r.email ? ` · ${r.email}` : ''}
          </Text>
        </View>
      ),
      sort: (r) => r.kidName,
    },
    {
      key: 'dueDate',
      header: 'Due',
      width: 130,
      align: 'right',
      render: (r) => (
        <View>
          <Text style={styles.cellMeta}>{r.dueDate}</Text>
          <Text style={[styles.cellMeta, { color: Colors.textMuted }]}>{r.ageLabel}</Text>
        </View>
      ),
      sort: (r) => r.dueDate,
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Vaccine overdue' }} />
      <AdminPage
        title="Vaccine overdue"
        description="Doses past their schedule date. Bulk-select to send reminder pushes."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Vaccine overdue' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            {canPush && selected.size > 0 ? (
              <ToolbarButton
                label={busy ? 'Sending…' : `Remind ${selected.size}`}
                icon="paper-plane-outline"
                variant="primary"
                onPress={askBulkRemind}
                disabled={busy}
              />
            ) : null}
          </>
        }
        toolbar={
          <View style={{ gap: 10 }}>
            <Toolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search parent, kid, vaccine…',
              }}
            />
            <FilterBar
              chips={filterChips}
              active={String(thresholdDays)}
              onChange={(k) => setThresholdDays(parseInt(k, 10))}
            />
          </View>
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Overdue doses" value={rows.length}      icon="time-outline" />
          <StatCard label="Kids affected"  value={totalKids}        icon="happy-outline" />
          <StatCard label="Parents"        value={totalParents}     icon="people-outline" />
        </View>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={rowKey}
          loading={loading}
          selectable={canPush}
          selected={selected}
          onSelectChange={setSelected}
          onRowPress={(r) => router.push(`/admin/users/${r.uid}` as any)}
          emptyTitle={search ? 'No matches' : 'Nothing overdue'}
          emptyBody={search ? 'Try a different search.' : 'Every dose is on schedule. Nice work.'}
        />
      </AdminPage>

      <ConfirmDialog
        visible={!!confirm}
        title="Send vaccine reminders?"
        body={`A personal reminder push will be sent to ${selected.size} parent${selected.size === 1 ? '' : 's'}. Each send is audit-logged.`}
        confirmLabel="Send"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const fn = confirm;
          setConfirm(null);
          if (fn) await fn();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  sevBadge: {
    minWidth: 44,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sevText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '800' },
});
