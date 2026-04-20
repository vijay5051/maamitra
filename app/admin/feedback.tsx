/**
 * Admin · Tester feedback
 *
 * Read-only dashboard of everything users have submitted via the
 * FeedbackSurveyModal. Shows aggregate signal at the top (avg rating,
 * would-pay split, most-loved / most-frustrated tags, price
 * distribution) and individual responses below so we can read the
 * qualitative notes. No editing / moderation — just a window.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { getTesterFeedback, TesterFeedbackEntry } from '../../services/firebase';

const PRICE_LABEL: Record<string, string> = {
  'free-only':  'Only if free',
  '<999':       'Under ₹999',
  '999-1499':   '₹999 – ₹1,499',
  '1499-1999':  '₹1,499 – ₹1,999',
  '1999-2499':  '₹1,999 – ₹2,499',
  '2499+':      '₹2,499+',
};

const PAY_LABEL: Record<string, string> = {
  yes:   'Yes',
  maybe: 'Maybe',
  no:    'Not today',
};

const PAY_TINT: Record<string, string> = {
  yes:   '#10B981',
  maybe: '#F59E0B',
  no:    '#EF4444',
};

export default function AdminFeedback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;

  const [rows, setRows] = useState<TesterFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await getTesterFeedback();
    setRows(data);
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    const data = await getTesterFeedback();
    setRows(data);
    setRefreshing(false);
  }

  const agg = useMemo(() => aggregate(rows), [rows]);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <LinearGradient colors={['#F5F0FF', '#EDE4FF']} style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerEyebrow}>MaaMitra · Admin</Text>
            <Text style={s.headerTitle}>Tester feedback</Text>
            <Text style={s.headerSub}>{rows.length} response{rows.length === 1 ? '' : 's'}</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.primary} />
          <Text style={s.emptyTitle}>No feedback yet</Text>
          <Text style={s.emptySub}>Responses from testers will appear here as they come in.</Text>
        </View>
      ) : (
        <View style={[s.body, wide && s.bodyWide]}>
          {/* At a glance */}
          <View style={[s.section, wide && { width: '100%' }]}>
            <Text style={s.sectionLabel}>At a glance</Text>
            <View style={s.statsGrid}>
              <StatCard value={agg.avgRating.toFixed(1)} label="Avg rating" sub={`${rows.length} raters`} icon="star" tint="#F59E0B" />
              <StatCard value={`${agg.wouldPayPct}%`}   label="Would pay"  sub={`${agg.payYes} said yes`} icon="checkmark-circle-outline" tint="#10B981" />
              <StatCard value={`${agg.maybePct}%`}       label="Maybe"      sub={`${agg.payMaybe} on the fence`} icon="help-circle-outline" tint="#F59E0B" />
              <StatCard value={`${agg.noPct}%`}          label="Not today"  sub={`${agg.payNo} declined`} icon="close-circle-outline" tint="#EF4444" />
            </View>
          </View>

          {/* Price band distribution */}
          <View style={[s.section, wide && s.colHalf]}>
            <Text style={s.sectionLabel}>Fair price (annual)</Text>
            <View style={s.card}>
              {agg.priceBands.length === 0 ? (
                <Text style={s.mutedLine}>No price data yet.</Text>
              ) : (
                agg.priceBands.map((b) => (
                  <View key={b.key} style={s.distRow}>
                    <Text style={s.distLabel}>{PRICE_LABEL[b.key] ?? b.key}</Text>
                    <View style={s.distBarTrack}>
                      <View style={[s.distBarFill, { width: `${b.pct}%` }]} />
                    </View>
                    <Text style={s.distPct}>{b.count}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Top loved + frustrated */}
          <View style={[s.section, wide && s.colHalf]}>
            <Text style={s.sectionLabel}>Top tags</Text>
            <View style={s.card}>
              <Text style={s.cardHint}>Loved</Text>
              <View style={s.tagWrap}>
                {agg.topLoved.length === 0 ? (
                  <Text style={s.mutedLine}>—</Text>
                ) : agg.topLoved.map((t) => (
                  <View key={t.tag} style={[s.tag, s.tagLove]}>
                    <Text style={s.tagLoveText}>{t.tag}</Text>
                    <Text style={s.tagCount}>{t.count}</Text>
                  </View>
                ))}
              </View>
              <Text style={[s.cardHint, { marginTop: 14 }]}>Frustrated</Text>
              <View style={s.tagWrap}>
                {agg.topFrustrated.length === 0 ? (
                  <Text style={s.mutedLine}>—</Text>
                ) : agg.topFrustrated.map((t) => (
                  <View key={t.tag} style={[s.tag, s.tagFrustrate]}>
                    <Text style={s.tagFrustrateText}>{t.tag}</Text>
                    <Text style={s.tagCount}>{t.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Responses list */}
          <View style={[s.section, wide && { width: '100%' }]}>
            <Text style={s.sectionLabel}>All responses</Text>
            <View style={{ gap: 10 }}>
              {rows.map((r) => (
                <ResponseCard key={r.id} row={r} />
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

function aggregate(rows: TesterFeedbackEntry[]) {
  const n = rows.length || 1;
  const sumRating = rows.reduce((acc, r) => acc + (r.rating ?? 0), 0);
  const payYes   = rows.filter((r) => r.wouldPayAnnual === 'yes').length;
  const payMaybe = rows.filter((r) => r.wouldPayAnnual === 'maybe').length;
  const payNo    = rows.filter((r) => r.wouldPayAnnual === 'no').length;

  const priceCounts = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.priceBand) return;
    priceCounts.set(r.priceBand, (priceCounts.get(r.priceBand) ?? 0) + 1);
  });
  const maxPrice = Math.max(1, ...Array.from(priceCounts.values()));
  const priceBands = Array.from(priceCounts.entries())
    .map(([key, count]) => ({ key, count, pct: (count / maxPrice) * 100 }))
    .sort((a, b) => b.count - a.count);

  const tally = (pick: (r: TesterFeedbackEntry) => string[] | undefined) => {
    const m = new Map<string, number>();
    rows.forEach((r) => (pick(r) ?? []).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return Array.from(m.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  return {
    avgRating: rows.length ? sumRating / rows.length : 0,
    payYes, payMaybe, payNo,
    wouldPayPct: Math.round((payYes / n) * 100),
    maybePct:    Math.round((payMaybe / n) * 100),
    noPct:       Math.round((payNo / n) * 100),
    priceBands,
    topLoved:      tally((r) => r.loved),
    topFrustrated: tally((r) => r.frustrated),
  };
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function StatCard({
  value, label, sub, icon, tint,
}: { value: string | number; label: string; sub?: string; icon: string; tint: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: tint }]}>
      <View style={[s.statIconWrap, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon as any} size={16} color={tint} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function ResponseCard({ row }: { row: TesterFeedbackEntry }) {
  const when = row.createdAt
    ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <View style={s.card}>
      <View style={s.respHeader}>
        <View style={s.respAvatar}>
          <Text style={s.respInitial}>{(row.userName || row.userEmail || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.respName}>{row.userName || 'Anonymous'}</Text>
          <Text style={s.respEmail} numberOfLines={1}>{row.userEmail || '—'} · {when}</Text>
        </View>
        <View style={s.starsInline}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={n <= (row.rating ?? 0) ? 'star' : 'star-outline'}
              size={13}
              color={n <= (row.rating ?? 0) ? '#F59E0B' : '#D1D5DB'}
            />
          ))}
        </View>
      </View>

      <View style={s.respMetaRow}>
        <View style={[s.metaPill, { backgroundColor: `${PAY_TINT[row.wouldPayAnnual] ?? '#6B7280'}1A` }]}>
          <Text style={[s.metaPillText, { color: PAY_TINT[row.wouldPayAnnual] ?? '#6B7280' }]}>
            Pay: {PAY_LABEL[row.wouldPayAnnual] ?? '—'}
          </Text>
        </View>
        <View style={s.metaPill}>
          <Text style={s.metaPillText}>Price: {PRICE_LABEL[row.priceBand] ?? row.priceBand}</Text>
        </View>
        {row.stage ? (
          <View style={s.metaPill}>
            <Text style={s.metaPillText}>{row.stage}</Text>
          </View>
        ) : null}
        {typeof row.kidsCount === 'number' && row.kidsCount > 0 ? (
          <View style={s.metaPill}>
            <Text style={s.metaPillText}>{row.kidsCount} kid{row.kidsCount > 1 ? 's' : ''}</Text>
          </View>
        ) : null}
      </View>

      {row.loved && row.loved.length > 0 ? (
        <>
          <Text style={s.respHint}>Loved</Text>
          <View style={s.tagWrap}>
            {row.loved.map((t) => (
              <View key={t} style={[s.tag, s.tagLove]}>
                <Text style={s.tagLoveText}>{t}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {row.frustrated && row.frustrated.length > 0 ? (
        <>
          <Text style={s.respHint}>Frustrated</Text>
          <View style={s.tagWrap}>
            {row.frustrated.map((t) => (
              <View key={t} style={[s.tag, s.tagFrustrate]}>
                <Text style={s.tagFrustrateText}>{t}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {row.note ? (
        <View style={s.noteBox}>
          <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
          <Text style={s.noteText}>{row.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  content: { paddingBottom: 40 },

  header: { paddingHorizontal: 20, paddingBottom: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  backBtn: { paddingVertical: 4, paddingRight: 4 },
  headerEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#1C1033', marginTop: 4 },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 3 },

  body: { paddingHorizontal: 16, paddingTop: 16, gap: 18 },
  bodyWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, maxWidth: 1280, alignSelf: 'center', width: '100%' },
  section: { gap: 8 },
  colHalf: {
    // @ts-ignore web-only calc
    width: Platform.OS === 'web' ? ('calc(50% - 8px)' as any) : '100%',
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, marginLeft: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: 140, backgroundColor: '#fff',
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F0EDF5',
    borderTopWidth: 3, gap: 6,
  },
  statIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1C1033' },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  statSub: { fontSize: 11, color: '#9CA3AF' },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F0EDF5' },
  cardHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  distRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  distLabel: { fontSize: 12, fontWeight: '600', color: '#1C1033', width: 150 },
  distBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F0EDF5', overflow: 'hidden' },
  distBarFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },
  distPct: { fontSize: 12, fontWeight: '800', color: Colors.primary, minWidth: 24, textAlign: 'right' },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  tagLove: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' },
  tagLoveText: { fontSize: 12, fontWeight: '700', color: '#10B981' },
  tagFrustrate: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
  tagFrustrateText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  tagCount: { fontSize: 11, fontWeight: '800', color: '#6B7280' },

  respHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  respAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center' },
  respInitial: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  respName: { fontSize: 13, fontWeight: '800', color: '#1C1033' },
  respEmail: { fontSize: 11, color: '#9CA3AF' },
  starsInline: { flexDirection: 'row', gap: 1 },

  respMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FAFAFB', borderWidth: 1, borderColor: '#F0EDF5' },
  metaPillText: { fontSize: 11, fontWeight: '700', color: '#1C1033' },

  respHint: { fontSize: 10, color: '#9CA3AF', marginTop: 8, marginBottom: 4, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },

  noteBox: {
    marginTop: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.primarySoft, borderRadius: 10, padding: 10,
  },
  noteText: { flex: 1, fontSize: 13, color: '#1C1033', lineHeight: 19 },

  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#1C1033', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#6B7280', paddingHorizontal: 30, textAlign: 'center' },

  mutedLine: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
});
