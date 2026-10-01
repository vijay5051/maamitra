/**
 * Admin · Mothers survey
 *
 * Read-only results for the public /mothers-survey page: headline counts,
 * an answer breakdown per question, then every individual response (with
 * the optional note and contact details). CSV export on web.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AdminPage, EmptyState, StatCard, ToolbarButton } from '../../components/admin/ui';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  MOTHERS_SURVEY_QUESTIONS,
  SurveyQuestion,
  surveyOptionLabel,
} from '../../data/mothersSurvey';
import { getMothersSurveyResponses, MothersSurveyResponse } from '../../services/mothersSurvey';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function answerKeys(row: MothersSurveyResponse, q: SurveyQuestion): string[] {
  const v = row.answers?.[q.id];
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

function formatDate(iso: string): string {
  return iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

export default function AdminMothersSurvey() {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 1100;

  const [rows, setRows] = useState<MothersSurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await getMothersSurveyResponses());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      thisWeek: rows.filter((r) => r.createdAt && now - new Date(r.createdAt).getTime() < WEEK_MS).length,
      withContact: rows.filter((r) => r.contactConsent && (r.phone || r.name)).length,
      withNote: rows.filter((r) => !!r.comment).length,
    };
  }, [rows]);

  const breakdowns = useMemo(
    () =>
      MOTHERS_SURVEY_QUESTIONS.map((q) => {
        const counts = new Map<string, number>();
        let answered = 0;
        rows.forEach((r) => {
          const keys = answerKeys(r, q);
          if (keys.length > 0) answered += 1;
          keys.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
        });
        const bars = Array.from(counts.entries())
          .map(([key, count]) => ({
            key,
            label: surveyOptionLabel(q, key),
            count,
            pct: answered ? Math.round((count / answered) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count);
        return { q, answered, bars };
      }),
    [rows],
  );

  function exportCsv() {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Submitted',
      ...MOTHERS_SURVEY_QUESTIONS.map((q) => q.short),
      'Note', 'Name', 'Phone', 'Source',
    ];
    const lines = rows.map((r) =>
      [
        r.createdAt,
        ...MOTHERS_SURVEY_QUESTIONS.map((q) =>
          answerKeys(r, q).map((k) => surveyOptionLabel(q, k)).join('; '),
        ),
        r.comment, r.name, r.phone, r.source,
      ].map(cell).join(','),
    );
    const csv = [header.map(cell).join(','), ...lines].join('\n');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // BOM so Excel reads the en-dashes and apostrophes as UTF-8.
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mothers-survey-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Mothers survey' }} />
      <AdminPage
        title="Mothers survey"
        description={`${rows.length} response${rows.length === 1 ? '' : 's'} from the public page at /mothers-survey.`}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Mothers survey' }]}
        headerActions={
          <>
            {Platform.OS === 'web' && rows.length > 0 ? (
              <ToolbarButton label="Export CSV" icon="download-outline" onPress={exportCsv} />
            ) : null}
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
          </>
        }
        loading={loading && rows.length === 0}
        error={error}
      >
        {rows.length === 0 ? (
          <EmptyState
            kind="empty"
            title="No responses yet"
            body="Share the /mothers-survey link. Answers will appear here as mothers submit them."
          />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Responses" value={rows.length} icon="people-outline" />
              <StatCard label="Last 7 days" value={stats.thisWeek} icon="calendar-outline" />
              <StatCard label="Shared contact" value={stats.withContact} icon="call-outline" hint="Agreed to be contacted" />
              <StatCard label="Left a note" value={stats.withNote} icon="chatbubble-outline" />
            </View>

            <View style={[styles.cols, wide && styles.colsWide]}>
              {breakdowns.map(({ q, answered, bars }, i) => (
                <View key={q.id} style={[styles.col, wide && styles.colHalf]}>
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>
                      Q{i + 1} · {answered} answered{q.type === 'multi' ? ' · multiple choice' : ''}
                    </Text>
                    <Text style={styles.qText}>{q.text}</Text>
                    {bars.length === 0 ? (
                      <Text style={styles.muted}>No answers yet.</Text>
                    ) : bars.map((b) => (
                      <View key={b.key} style={styles.distRow}>
                        <View style={styles.distHead}>
                          <Text style={styles.distLabel}>{b.label}</Text>
                          <Text style={styles.distCount}>{b.count} · {b.pct}%</Text>
                        </View>
                        <View style={styles.distBarTrack}>
                          <View style={[styles.distBarFill, { width: `${b.pct}%` as const }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>All responses</Text>
              <View style={{ gap: Spacing.md }}>
                {rows.map((r) => <ResponseCard key={r.id} row={r} />)}
              </View>
            </View>
          </>
        )}
      </AdminPage>
    </>
  );
}

function ResponseCard({ row }: { row: MothersSurveyResponse }) {
  const hasContact = row.contactConsent && (row.name || row.phone);
  return (
    <View style={styles.respCard}>
      <View style={styles.respHead}>
        <Text style={styles.respName}>{hasContact && row.name ? row.name : 'Anonymous'}</Text>
        <Text style={styles.respMeta}>
          {formatDate(row.createdAt)}{row.source ? ` · via ${row.source}` : ''}
        </Text>
      </View>
      {hasContact && row.phone ? (
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={13} color={Colors.primary} />
          <Text style={styles.contactText}>{row.phone}</Text>
        </View>
      ) : null}
      {MOTHERS_SURVEY_QUESTIONS.map((q) => {
        const keys = answerKeys(row, q);
        if (keys.length === 0) return null;
        return (
          <View key={q.id} style={styles.answerRow}>
            <Text style={styles.answerQ}>{q.short}</Text>
            <Text style={styles.answerA}>{keys.map((k) => surveyOptionLabel(q, k)).join(' · ')}</Text>
          </View>
        );
      })}
      {row.comment ? (
        <View style={styles.noteBox}>
          <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
          <Text style={styles.noteText}>{row.comment}</Text>
        </View>
      ) : null}
    </View>
  );
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
  qText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  muted: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },

  distRow: { paddingVertical: 5, gap: 4 },
  distHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  distLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.textDark },
  distCount: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  distBarTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.borderSoft, overflow: 'hidden' },
  distBarFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },

  respCard: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 6,
  },
  respHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  respName: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark },
  respMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  answerRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  answerQ: { width: 190, fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },
  answerA: { flex: 1, minWidth: 200, fontSize: FontSize.sm, color: Colors.textDark },

  noteBox: {
    marginTop: 6,
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: 10,
  },
  noteText: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, lineHeight: 19 },
});
