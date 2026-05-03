/**
 * Admin · DPDP consent ledger.
 *
 * Wave 7. India's DPDP Act, 2023 requires we keep a per-user record of
 * which consent version they accepted, when, and from which platform.
 * Recent events are listed here for compliance audits + admins can
 * process right-to-be-forgotten requests that flip the user's latest
 * privacy-policy acceptance to withdrawn (a NEW row, never a delete).
 */
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  ConfirmDialog,
  DataTable,
  StatCard,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import {
  ConsentEntry,
  CONSENT_LABELS,
  ConsentType,
  listRecentConsents,
  processRtbf,
} from '../../services/consent';
import { useAuthStore } from '../../store/useAuthStore';

export default function ConsentLedger() {
  const { user: actor } = useAuthStore();

  const [entries, setEntries] = useState<ConsentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rtbfUid, setRtbfUid] = useState('');
  const [rtbfNotes, setRtbfNotes] = useState('');
  const [confirmRtbf, setConfirmRtbf] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listRecentConsents(200));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runRtbf() {
    if (!actor) return;
    setConfirmRtbf(false);
    setBusy(true);
    try {
      await processRtbf(actor, rtbfUid.trim(), rtbfNotes.trim() || undefined);
      setRtbfUid(''); setRtbfNotes('');
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.uid.toLowerCase().includes(q) ||
      e.consentType.toLowerCase().includes(q) ||
      e.version.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const counts = useMemo(() => {
    const c = { total: entries.length, accepted: 0, withdrawn: 0, marketing: 0 };
    for (const e of entries) {
      if (e.accepted) c.accepted++;
      if (e.withdrawnAt) c.withdrawn++;
      if (e.consentType === 'marketing' && e.accepted) c.marketing++;
    }
    return c;
  }, [entries]);

  const columns: Column<ConsentEntry>[] = [
    {
      key: 'consentType',
      header: 'Type',
      width: 200,
      render: (e) => (
        <Text style={styles.cellPrimary}>{CONSENT_LABELS[e.consentType] ?? e.consentType}</Text>
      ),
      sort: (e) => e.consentType,
    },
    {
      key: 'version',
      header: 'Version',
      width: 120,
      render: (e) => <Text style={styles.cellMono}>{e.version}</Text>,
      sort: (e) => e.version,
    },
    {
      key: 'state',
      header: 'State',
      width: 130,
      render: (e) => (
        e.withdrawnAt
          ? <StatusBadge label="Withdrawn" color={Colors.error} />
          : e.accepted
            ? <StatusBadge label="Accepted" color={Colors.success} />
            : <StatusBadge label="Refused" color={Colors.warning} />
      ),
      sort: (e) => (e.withdrawnAt ? 'z' : e.accepted ? 'a' : 'r'),
    },
    {
      key: 'uid',
      header: 'User',
      render: (e) => (
        <Text style={styles.cellMono} numberOfLines={1}>{e.uid}</Text>
      ),
      sort: (e) => e.uid,
    },
    {
      key: 'platform',
      header: 'Platform',
      width: 100,
      render: (e) => <Text style={styles.cellMeta}>{e.platform}</Text>,
      sort: (e) => e.platform,
    },
    {
      key: 'acceptedAt',
      header: 'When',
      width: 140,
      align: 'right',
      render: (e) => (
        <Text style={styles.cellMeta}>
          {e.acceptedAt
            ? new Date(e.acceptedAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })
            : '—'}
        </Text>
      ),
      sort: (e) => e.acceptedAt ?? '',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Consent ledger' }} />
      <AdminPage
        title="DPDP consent ledger"
        description="India's Digital Personal Data Protection Act, 2023 requires we keep a per-user record of every consent acceptance + version. Append-only — we never delete an entry, we add a new one when state changes."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Consent ledger' }]}
        headerActions={<ToolbarButton label="Refresh" icon="refresh" onPress={load} />}
        toolbar={
          <Toolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search uid, consent type, version…',
            }}
            leading={<Text style={styles.countText}>{filtered.length} of {entries.length}</Text>}
          />
        }
        error={error}
      >
        <View style={styles.statsRow}>
          <StatCard label="Total events"        value={counts.total}     icon="document-text-outline" />
          <StatCard label="Accepted"            value={counts.accepted}  icon="checkmark-done-outline" />
          <StatCard label="Withdrawn / RTBF"    value={counts.withdrawn} icon="close-circle-outline" deltaPositive="down" />
          <StatCard label="Marketing opt-ins"   value={counts.marketing} icon="megaphone-outline" />
        </View>

        <View style={styles.rtbfCard}>
          <Text style={styles.rtbfLabel}>Right-to-be-forgotten request</Text>
          <Text style={styles.rtbfBody}>
            Users have the legal right to withdraw consent and request deletion under DPDP §11. Processing this writes a new ledger row marking the user's privacy_policy consent as withdrawn — it does NOT delete the user account itself; do that from the user 360.
          </Text>
          <TextInput
            style={styles.rtbfInput}
            value={rtbfUid}
            onChangeText={setRtbfUid}
            placeholder="User uid"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.rtbfInput, { minHeight: 56, textAlignVertical: 'top' }]}
            value={rtbfNotes}
            onChangeText={setRtbfNotes}
            placeholder="Notes (optional, e.g. 'requested via support@…')"
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <View style={styles.rtbfActions}>
            <ToolbarButton
              label={busy ? 'Processing…' : 'Process RTBF'}
              icon="warning-outline"
              variant="danger"
              onPress={() => setConfirmRtbf(true)}
              disabled={!rtbfUid.trim() || busy}
            />
          </View>
        </View>

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(e) => e.id}
          loading={loading}
          emptyTitle={search ? 'No entries match' : 'No consent events yet'}
          emptyBody={search ? 'Try a different search.' : 'Once users accept the privacy policy or marketing toggle, events will appear here.'}
        />
      </AdminPage>

      <ConfirmDialog
        visible={confirmRtbf}
        title="Process right-to-be-forgotten?"
        body={`Marks ${rtbfUid.trim() || 'this user'}'s privacy-policy consent as withdrawn. Audit-logged. This is the legal record that the request was processed; the user's data still needs deleting from /admin/users/${rtbfUid.trim()}.`}
        destructive
        requireType="RTBF"
        confirmLabel="Process"
        onCancel={() => setConfirmRtbf(false)}
        onConfirm={runRtbf}
      />
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },
  cellPrimary: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellMeta: { fontSize: FontSize.xs, color: Colors.textLight },
  cellMono: { fontSize: FontSize.xs, color: Colors.textDark, fontFamily: 'DMMono_400Regular' },

  rtbfCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: '#FECACA',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  rtbfLabel: { fontSize: 11, fontWeight: '700', color: '#7f1d1d', letterSpacing: 1.2, textTransform: 'uppercase' },
  rtbfBody: { fontSize: FontSize.sm, color: '#7f1d1d', lineHeight: 19 },
  rtbfInput: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: '#FECACA',
  },
  rtbfActions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
