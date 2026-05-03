/**
 * Admin · Tester feedback
 *
 * Wave 3 rebuild. Read-only window into FeedbackSurveyModal responses.
 * AdminPage shell, KPI cards, two-column body on wide-web with price
 * distribution + top tags, response cards below.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { AdminPage, EmptyState, StatCard, ToolbarButton } from '../../components/admin/ui';
import { getTesterFeedback, TesterFeedbackEntry } from '../../services/firebase';

const PRICE_LABEL: Record<string, string> = {
  'free-only': 'Only if free',
  '<999': 'Under ₹999',
  '999-1499': '₹999 – ₹1,499',
  '1499-1999': '₹1,499 – ₹1,999',
  '1999-2499': '₹1,999 – ₹2,499',
  '2499+': '₹2,499+',
};

const PAY_LABEL: Record<string, string> = { yes: 'Yes', maybe: 'Maybe', no: 'Not today' };
const PAY_TINT: Record<string, string> = { yes: Colors.success, maybe: Colors.warning, no: Colors.error };

export default function AdminFeedback() {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 1100;

  const [rows, setRows] = useState<TesterFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getTesterFeedback());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const agg = useMemo(() => aggregate(rows), [rows]);

  return (
    <>
      <Stack.Screen options={{ title: 'Tester feedback' }} />
      <AdminPage
        title="Tester feedback"
        description={`${rows.length} response${rows.length === 1 ? '' : 's'}. Aggregate signal up top, individual responses below.`}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Tester feedback' }]}
        headerActions={<ToolbarButton label="Refresh" icon="refresh" onPress={load} />}
        loading={loading && rows.length === 0}
        error={error}
      >
        {rows.length === 0 ? (
          <EmptyState
            kind="empty"
            title="No feedback yet"
            body="Responses from testers will appear here as they come in."
          />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Avg rating"  value={agg.avgRating.toFixed(1)} icon="star" hint={`${rows.length} raters`} />
              <StatCard label="Would pay"   value={`${agg.wouldPayPct}%`}    icon="checkmark-circle-outline" hint={`${agg.payYes} yes`} />
              <StatCard label="Maybe"       value={`${agg.maybePct}%`}       icon="help-circle-outline"      hint={`${agg.payMaybe} on the fence`} />
              <StatCard label="Not today"   value={`${agg.noPct}%`}          icon="close-circle-outline"     hint={`${agg.payNo} declined`} deltaPositive="down" />
            </View>

            <View style={[styles.cols, wide && styles.colsWide]}>
              <View style={[styles.col, wide && styles.colHalf]}>
                <Card label="Fair price (annual)">
                  {agg.priceBands.length === 0 ? (
                    <Text style={styles.muted}>No price data yet.</Text>
                  ) : agg.priceBands.map((b) => (
                    <View key={b.key} style={styles.distRow}>
                      <Text style={styles.distLabel}>{PRICE_LABEL[b.key] ?? b.key}</Text>
                      <View style={styles.distBarTrack}>
                        <View style={[styles.distBarFill, { width: `${b.pct}%` as const }]} />
                      </View>
                      <Text style={styles.distCount}>{b.count}</Text>
                    </View>
                  ))}
                </Card>
              </View>

              <View style={[styles.col, wide && styles.colHalf]}>
                <Card label="Top tags">
                  <Text style={styles.subLabel}>Loved</Text>
                  <View style={styles.tagWrap}>
                    {agg.topLoved.length === 0 ? (
                      <Text style={styles.muted}>—</Text>
                    ) : agg.topLoved.map((t) => (
                      <View key={t.tag} style={[styles.tag, styles.tagLove]}>
                        <Text style={styles.tagLoveText}>{t.tag}</Text>
                        <Text style={styles.tagCount}>{t.count}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.subLabel, { marginTop: Spacing.md }]}>Frustrated</Text>
                  <View style={styles.tagWrap}>
                    {agg.topFrustrated.length === 0 ? (
                      <Text style={styles.muted}>—</Text>
                    ) : agg.topFrustrated.map((t) => (
                      <View key={t.tag} style={[styles.tag, styles.tagFrustrate]}>
                        <Text style={styles.tagFrustrateText}>{t.tag}</Text>
                        <Text style={styles.tagCount}>{t.count}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            </View>

            <Card label="All responses">
              <View style={{ gap: Spacing.md }}>
                {rows.map((r) => <ResponseCard key={r.id} row={r} />)}
              </View>
            </Card>
          </>
        )}
      </AdminPage>
    </>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ResponseCard({ row }: { row: TesterFeedbackEntry }) {
  const when = row.createdAt
    ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <View style={styles.respCard}>
      <View style={styles.respHead}>
        <View style={styles.respAvatar}>
          <Text style={styles.respInitial}>{(row.userName || row.userEmail || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.respName}>{row.userName || 'Anonymous'}</Text>
          <Text style={styles.respEmail} numberOfLines={1}>{row.userEmail || '—'} · {when}</Text>
        </View>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={n <= (row.rating ?? 0) ? 'star' : 'star-outline'}
              size={14}
              color={n <= (row.rating ?? 0) ? Colors.warning : Colors.borderSoft}
            />
          ))}
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaPill, { backgroundColor: `${PAY_TINT[row.wouldPayAnnual] ?? Colors.textMuted}1A` }]}>
          <Text style={[styles.metaPillText, { color: PAY_TINT[row.wouldPayAnnual] ?? Colors.textMuted }]}>
            Pay: {PAY_LABEL[row.wouldPayAnnual] ?? '—'}
          </Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>Price: {PRICE_LABEL[row.priceBand] ?? row.priceBand}</Text>
        </View>
        {row.stage ? (
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{row.stage}</Text>
          </View>
        ) : null}
        {typeof row.kidsCount === 'number' && row.kidsCount > 0 ? (
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{row.kidsCount} kid{row.kidsCount > 1 ? 's' : ''}</Text>
          </View>
        ) : null}
      </View>

      {row.loved && row.loved.length > 0 ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.subLabel}>Loved</Text>
          <View style={styles.tagWrap}>
            {row.loved.map((t) => (
              <View key={t} style={[styles.tag, styles.tagLove]}>
                <Text style={styles.tagLoveText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {row.frustrated && row.frustrated.length > 0 ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.subLabel}>Frustrated</Text>
          <View style={styles.tagWrap}>
            {row.frustrated.map((t) => (
              <View key={t} style={[styles.tag, styles.tagFrustrate]}>
                <Text style={styles.tagFrustrateText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {row.note ? (
        <View style={styles.noteBox}>
          <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
          <Text style={styles.noteText}>{row.note}</Text>
        </View>
      ) : null}
    </View>
  );
}

function aggregate(rows: TesterFeedbackEntry[]) {
  const n = rows.length || 1;
  const sumRating = rows.reduce((acc, r) => acc + (r.rating ?? 0), 0);
  const payYes = rows.filter((r) => r.wouldPayAnnual === 'yes').length;
  const payMaybe = rows.filter((r) => r.wouldPayAnnual === 'maybe').length;
  const payNo = rows.filter((r) => r.wouldPayAnnual === 'no').length;

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
    maybePct: Math.round((payMaybe / n) * 100),
    noPct: Math.round((payNo / n) * 100),
    priceBands,
    topLoved: tally((r) => r.loved),
    topFrustrated: tally((r) => r.frustrated),
  };
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },

  cols: { flexDirection: 'column', gap: Spacing.lg },
  colsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  col: { flexBasis: '100%', minWidth: 0 },
  colHalf: {
    // @ts-ignore web-only calc
    flexBasis: Platform.OS === 'web' ? ('calc(50% - 8px)' as any) : '100%',
    flexGrow: 1, minWidth: 320,
  },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  cardLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  subLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
  },
  muted: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },

  distRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  distLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textDark, width: 150 },
  distBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.borderSoft, overflow: 'hidden' },
  distBarFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },
  distCount: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary, minWidth: 24, textAlign: 'right' },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
  },
  tagLove: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' },
  tagLoveText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },
  tagFrustrate: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
  tagFrustrateText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.error },
  tagCount: { fontSize: 11, fontWeight: '800', color: Colors.textLight },

  respCard: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 6,
  },
  respHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  respAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  respInitial: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  respName: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark },
  respEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  starsRow: { flexDirection: 'row', gap: 1 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  metaPillText: { fontSize: 11, fontWeight: '700', color: Colors.textDark },

  noteBox: {
    marginTop: 6,
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: 10,
  },
  noteText: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19 },
});
