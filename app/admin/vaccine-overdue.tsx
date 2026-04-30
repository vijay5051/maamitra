/**
 * Admin · Vaccine overdue ops.
 *
 * For every signed-up user with kids, walks the IAP schedule and surfaces
 * doses that are overdue (default ≥ 7 days past the schedule date and not
 * already in completedVaccines).
 *
 * The admin can long-press to multi-select and fire a bulk reminder push
 * (one personal push per row). Useful for the weekly "who needs a nudge"
 * sweep.
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
import { useAuthStore } from '../../store/useAuthStore';
import { useAdminRole } from '../../lib/useAdminRole';
import { can } from '../../lib/admin';
import { getOverdueVaccines, OverdueVaccine, sendVaccineReminderPush } from '../../services/admin';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';

export default function VaccineOverdue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: actor } = useAuthStore();
  const role = useAdminRole();

  const [rows, setRows] = useState<OverdueVaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [thresholdDays, setThresholdDays] = useState(7);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, [thresholdDays]);

  async function load() {
    setLoading(true);
    setRows(await getOverdueVaccines(thresholdDays));
    setLoading(false);
  }
  async function refresh() {
    setRefreshing(true);
    setRows(await getOverdueVaccines(thresholdDays));
    setRefreshing(false);
  }

  function key(r: OverdueVaccine) { return `${r.uid}_${r.kidId}_${r.vaccineId}`; }

  function toggleSelect(r: OverdueVaccine) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(r);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleBulkRemind() {
    if (!actor) return;
    if (!can(role, 'send_personal_push')) {
      infoAlert('Not allowed', 'Your role does not allow sending pushes.');
      return;
    }
    const targets = rows.filter((r) => selected.has(key(r)));
    if (targets.length === 0) return;
    const ok = await confirmAction(
      'Send vaccine reminders',
      `Send a personal reminder push to ${targets.length} parent${targets.length === 1 ? '' : 's'}?`,
      { confirmLabel: 'Send' },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { sent, failed } = await sendVaccineReminderPush(actor, targets.map((t) => ({
        uid: t.uid, kidName: t.kidName, vaccineName: t.vaccineName, daysOverdue: t.daysOverdue,
      })));
      setSelected(new Set());
      infoAlert('Reminders queued', `${sent} sent${failed ? `, ${failed} failed` : ''}.`);
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.userName.toLowerCase().includes(q) ||
      r.kidName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.vaccineName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalKids = useMemo(() => new Set(rows.map((r) => `${r.uid}_${r.kidId}`)).size, [rows]);
  const totalParents = useMemo(() => new Set(rows.map((r) => r.uid)).size, [rows]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.headerCard}>
        <Text style={styles.headerEyebrow}>Admin · Vaccines</Text>
        <Text style={styles.headerTitle}>Overdue ops</Text>
        <Text style={styles.headerSub}>
          {rows.length} overdue dose{rows.length === 1 ? '' : 's'} across {totalKids} kid{totalKids === 1 ? '' : 's'} ({totalParents} parent{totalParents === 1 ? '' : 's'}).
        </Text>
      </LinearGradient>

      <View style={styles.thresholdRow}>
        <Text style={styles.thresholdLabel}>Overdue if past schedule by</Text>
        {[7, 14, 30].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.thresholdChip, thresholdDays === d && styles.thresholdChipActive]}
            onPress={() => setThresholdDays(d)}
          >
            <Text style={[styles.thresholdChipText, thresholdDays === d && { color: '#fff' }]}>{d}d</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search parent, kid, vaccine…"
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

      {selected.size > 0 ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkText}>{selected.size} selected</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.bulkBtn} onPress={() => setSelected(new Set())} disabled={busy}>
            <Text style={styles.bulkBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnPrimary]} onPress={handleBulkRemind} disabled={busy}>
            <Ionicons name="paper-plane" size={13} color="#fff" />
            <Text style={[styles.bulkBtnText, { color: '#fff' }]}>{busy ? 'Sending…' : 'Send reminder'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.tipLine}>Long-press a row to select. Send a reminder push to all selected.</Text>
      )}

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shield-checkmark-outline" size={40} color="#10B981" />
          <Text style={styles.emptyText}>{search ? 'No matches.' : 'Nothing overdue. Nice work.'}</Text>
        </View>
      ) : filtered.map((r) => {
        const k = key(r);
        const isSel = selected.has(k);
        return (
          <Pressable
            key={k}
            style={[styles.row, isSel && styles.rowSelected]}
            onPress={() => selected.size > 0 ? toggleSelect(r) : router.push(`/admin/users/${r.uid}` as any)}
            onLongPress={() => toggleSelect(r)}
          >
            <View style={[styles.severity, { backgroundColor: r.daysOverdue >= 30 ? '#EF4444' : r.daysOverdue >= 14 ? '#F59E0B' : '#FBBF24' }]}>
              <Text style={styles.severityText}>{r.daysOverdue}d</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{r.vaccineName}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {r.kidName} · {r.userName}{r.email ? ` · ${r.email}` : ''}
              </Text>
              <Text style={styles.rowMeta}>Due {r.dueDate} · {r.ageLabel}</Text>
            </View>
            {isSel ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { padding: 16, gap: 10 },

  headerCard: { borderRadius: 16, padding: 16 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: '#92400E', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a2e', marginTop: 2 },
  headerSub: { fontSize: 12, color: '#78350F', marginTop: 4 },

  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thresholdLabel: { fontSize: 11, color: '#6B7280', marginRight: 4 },
  thresholdChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  thresholdChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  thresholdChipText: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1a1a2e' },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EDE4FF', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: Colors.primary,
  },
  bulkText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  bulkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  bulkBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bulkBtnText: { fontSize: 12, fontWeight: '700', color: '#1a1a2e' },

  tipLine: { fontSize: 11, color: '#9CA3AF', marginLeft: 4 },

  empty: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 14, color: '#10B981', fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F0EDF5',
  },
  rowSelected: { borderColor: Colors.primary, backgroundColor: '#FAF5FF' },
  severity: {
    minWidth: 38, paddingHorizontal: 6, height: 38, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  severityText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  rowTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  rowSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  rowMeta: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
});
