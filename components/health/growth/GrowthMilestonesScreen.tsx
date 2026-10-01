import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Card from '../../ui/Card';
import GradientButton from '../../ui/GradientButton';
import { Colors, Fonts } from '../../../constants/theme';
import { WHO_MAX_MONTHS, WHO_SOURCE, WhoIndicator, WhoSex } from '../../../data/whoGrowthStandards';
import { useActiveKid } from '../../../hooks/useActiveKid';
import { isPlausibleDob } from '../../../lib/dob';
import {
  ageMonthsAt,
  dateKey,
  formatAge,
  isoFromDateKey,
  latestOf,
  timelineMarkers,
  Visit,
  visitsByMarker,
  visitsFromGrowth,
  whoPercentile,
} from '../../../lib/growth';
import { useGrowthStore } from '../../../store/useGrowthStore';
import { useProfileStore } from '../../../store/useProfileStore';
import { persistProfile } from '../allergy/saveKidAllergies';
import GrowthChart from './GrowthChart';
import MeasurementSheet from './MeasurementSheet';
import MilestonesPanel from './MilestonesPanel';

const INK = Colors.textDark;
const STONE = Colors.textLight;

export type GrowthSegment = 'timeline' | 'graphs' | 'milestones';

/** The exact closing line required on this screen. */
export const GROWTH_REASSURANCE =
  'Every child is different and grows at their own pace. These charts and milestones are guides; if you have concerns about your child’s growth or development, speak with your paediatrician.';

const DOT_COLORS = ['#B7A4D6', '#F9A8D4', '#FCD34D', '#86EFAC', '#93C5FD', '#FDBA74'];
const DOT_ICONS = ['🌱', '🍼', '🧸', '🌼', '🐥', '🌈'];

function fmtDate(key: string): string {
  const d = new Date(key + 'T12:00:00');
  return isNaN(d.getTime()) ? key : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
const fmtKg = (v: number) => `${Number(v.toFixed(2))} kg`;
const fmtCm = (v: number) => `${Number(v.toFixed(1))} cm`;
const lengthWord = (v: Visit, age: number) => ((v.lengthMode ?? (age < 24 ? 'lying' : 'standing')) === 'lying' ? 'Length' : 'Height');

export default function GrowthMilestonesScreen({ initialSegment = 'timeline' }: { initialSegment?: GrowthSegment }) {
  const router = useRouter();
  const { activeKid, ageLabel } = useActiveKid();
  const byKid = useGrowthStore((s) => s.byKid);
  const updateKid = useProfileStore((s) => s.updateKid);

  const [segment, setSegment] = useState<GrowthSegment>(initialSegment);
  const [indicator, setIndicator] = useState<WhoIndicator>('weight');
  const [form, setForm] = useState<{ initial?: Visit | null; presetDate?: string } | null>(null);
  const [openMarker, setOpenMarker] = useState<number | null>(null);
  const [showSource, setShowSource] = useState(false);

  // Only this child's records — switching child swaps everything below.
  const visits = useMemo(() => visitsFromGrowth(activeKid ? byKid[activeKid.id] : undefined), [byKid, activeKid?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeKid) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Text style={styles.emptyTitle}>Add your child first</Text>
        <Text style={styles.emptyText}>Growth and milestones are kept separately for each child.</Text>
        <GradientButton title="Add a child" onPress={() => router.push('/(tabs)/family')} style={{ marginTop: 14, alignSelf: 'stretch' }} />
      </Card>
    );
  }
  if (activeKid.isExpecting) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Text style={styles.emptyTitle}>This starts after birth</Text>
        <Text style={styles.emptyText}>
          Once {activeKid.name || 'your baby'} arrives, you can record birth weight, length and head size here and follow
          their growth and milestones.
        </Text>
      </Card>
    );
  }
  if (!activeKid.dob || !isPlausibleDob(activeKid.dob)) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Text style={styles.emptyTitle}>Date of birth needed</Text>
        <Text style={styles.emptyText}>
          Growth charts and milestone ages depend on {activeKid.name || 'your child'}’s exact age, so we can’t show them
          without a date of birth.
        </Text>
        <GradientButton title="Add date of birth" onPress={() => router.push({ pathname: '/settings/edit-kid', params: { kidId: activeKid.id } })}
          style={{ marginTop: 14, alignSelf: 'stretch' }} />
      </Card>
    );
  }

  const kid = activeKid;
  const dob = kid.dob;
  const name = kid.name || 'Your child';
  const ageNow = Math.max(0, ageMonthsAt(dob, new Date().toISOString()));
  const today = dateKey(new Date());

  const profileSex: WhoSex | null = kid.gender === 'boy' || kid.gender === 'girl' ? kid.gender : null;
  const sex: WhoSex | null = profileSex ?? kid.growthChartSex ?? null;
  const preterm = kid.bornEarly === 'yes';

  const latest = {
    weight: latestOf(visits, 'weightKg'),
    height: latestOf(visits, 'lengthCm'),
    head: latestOf(visits, 'headCm'),
  };
  const markers = timelineMarkers(ageNow);
  const byMarker = visitsByMarker(markers, visits, dob);

  const setKidField = (data: Parameters<typeof updateKid>[1]) => { updateKid(kid.id, data); persistProfile(); };

  /** Neutral, descriptive wording — never a verdict. Skipped when WHO has no chart or the baby was born early. */
  const percentileNote = (v: Visit): string[] => {
    if (!sex || preterm) return [];
    const age = ageMonthsAt(dob, isoFromDateKey(v.date));
    const out: string[] = [];
    const add = (ind: WhoIndicator, val: number | undefined, label: string) => {
      if (val == null) return;
      const p = whoPercentile(ind, sex, age, val);
      if (p != null) out.push(`${label}: near the ${p}${p % 10 === 1 && p !== 11 ? 'st' : p % 10 === 2 && p !== 12 ? 'nd' : p % 10 === 3 && p !== 13 ? 'rd' : 'th'} percentile line`);
    };
    add('weight', v.weightKg, 'Weight');
    add('height', v.lengthCm, lengthWord(v, age));
    add('head', v.headCm, 'Head');
    return out;
  };

  const stat = (label: string, value: string | null, date: string | null, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, !value && styles.statEmpty]}>{value ?? 'Not recorded'}</Text>
      {!!date && <Text style={styles.statDate}>{fmtDate(date)}</Text>}
    </View>
  );

  const latestHeightVisit = latest.height ? visits.find((v) => v.date === latest.height!.date) : undefined;

  return (
    <View>
      {/* ── Overview ── */}
      <Card style={styles.overview} shadow="sm">
        <Text style={styles.kidName}>{name}</Text>
        <Text style={styles.kidAge}>{ageLabel}</Text>
        <View style={styles.stats}>
          {stat('Weight', latest.weight ? fmtKg(latest.weight.value) : null, latest.weight?.date ?? null, 'scale-outline')}
          {stat(
            latestHeightVisit ? lengthWord(latestHeightVisit, ageMonthsAt(dob, isoFromDateKey(latestHeightVisit.date))) : ageNow < 24 ? 'Length' : 'Height',
            latest.height ? fmtCm(latest.height.value) : null, latest.height?.date ?? null, 'resize-outline',
          )}
          {stat('Head', latest.head ? fmtCm(latest.head.value) : null, latest.head?.date ?? null, 'ellipse-outline')}
        </View>
        <GradientButton title="Add measurement" onPress={() => setForm({})} style={{ marginTop: 14 }} />
      </Card>

      {/* ── Segments ── */}
      <View style={styles.segments} accessibilityRole="tablist">
        {([['timeline', 'Timeline'], ['graphs', 'Graphs'], ['milestones', 'Milestones']] as const).map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setSegment(id)} style={[styles.segment, segment === id && styles.segmentOn]}
            accessibilityRole="tab" accessibilityState={{ selected: segment === id }}>
            <Text style={[styles.segmentText, segment === id && styles.segmentTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Timeline ── */}
      {segment === 'timeline' && (
        <View>
          {visits.length === 0 && (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Nothing recorded yet. Start with {name}’s birth measurements from the discharge card, or today’s reading.
              </Text>
            </View>
          )}
          {markers.map((m, i) => {
            const list = byMarker[i];
            const v = list[list.length - 1];
            const color = DOT_COLORS[i % DOT_COLORS.length];
            const isYear = m.months > 0 && m.months % 12 === 0;
            return (
              <View key={m.months} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: color }]}>
                    <Text style={styles.dotIcon}>{m.months === 0 ? '👶' : isYear ? '🎂' : DOT_ICONS[i % DOT_ICONS.length]}</Text>
                  </View>
                  {i < markers.length - 1 && <View style={[styles.line, { backgroundColor: color }]} />}
                </View>
                <TouchableOpacity
                  style={[styles.entry, !v && styles.entryEmpty]}
                  activeOpacity={0.85}
                  onPress={() => (v ? setOpenMarker(i) : setForm({ presetDate: presetFor(dob, m.months, today) }))}
                  accessibilityRole="button"
                  accessibilityLabel={v ? `${m.label}: view measurements` : `${m.label}: no measurement recorded. Add measurement`}
                >
                  <Text style={styles.entryAge}>{m.label}</Text>
                  {v ? (
                    <>
                      <Text style={styles.entryValues}>
                        {[v.weightKg != null && fmtKg(v.weightKg), v.lengthCm != null && fmtCm(v.lengthCm), v.headCm != null && `head ${fmtCm(v.headCm)}`]
                          .filter(Boolean).join('  ·  ')}
                      </Text>
                      <Text style={styles.entryDate}>
                        {fmtDate(v.date)}{list.length > 1 ? `  ·  +${list.length - 1} more` : ''}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.entryEmptyRow}>
                      <Text style={styles.entryNone}>No measurement recorded</Text>
                      <Text style={styles.entryAdd}>Add measurement</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Graphs ── */}
      {segment === 'graphs' && (
        <View>
          <View style={styles.indRow}>
            {([['weight', 'Weight (kg)'], ['height', 'Length / height (cm)'], ['head', 'Head (cm)']] as const).map(([id, label]) => (
              <TouchableOpacity key={id} onPress={() => setIndicator(id)} style={[styles.ind, indicator === id && styles.indOn]}
                accessibilityRole="button" accessibilityState={{ selected: indicator === id }}>
                <Text style={[styles.indText, indicator === id && styles.indTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Missing profile details are asked, never guessed */}
          {!profileSex && (
            <View style={styles.ask}>
              <Text style={styles.askTitle}>Which WHO chart should we use?</Text>
              <Text style={styles.askText}>
                WHO has separate charts for boys and girls, and {name}’s profile doesn’t say. Until you choose, only {name}’s
                own readings are shown.
              </Text>
              <View style={styles.askBtns}>
                {(['girl', 'boy'] as const).map((g) => (
                  <TouchableOpacity key={g} onPress={() => setKidField({ growthChartSex: g })}
                    style={[styles.askBtn, kid.growthChartSex === g && styles.askBtnOn]} accessibilityRole="radio"
                    accessibilityState={{ selected: kid.growthChartSex === g }}>
                    <Text style={[styles.askBtnText, kid.growthChartSex === g && styles.askBtnTextOn]}>{g === 'girl' ? 'Girls’ chart' : 'Boys’ chart'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {kid.bornEarly === undefined && (
            <View style={styles.ask}>
              <Text style={styles.askTitle}>Was {name} born early (before 37 weeks)?</Text>
              <Text style={styles.askText}>It changes how growth charts should be read, so we ask rather than assume.</Text>
              <View style={styles.askBtns}>
                {(['no', 'yes'] as const).map((a) => (
                  <TouchableOpacity key={a} onPress={() => setKidField({ bornEarly: a })} style={styles.askBtn} accessibilityRole="button">
                    <Text style={styles.askBtnText}>{a === 'no' ? 'No' : 'Yes, born early'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {preterm && (
            <View style={[styles.ask, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
              <Text style={[styles.askTitle, { color: '#92400E' }]}>{name} was born early</Text>
              <Text style={[styles.askText, { color: '#92400E' }]}>
                These charts count age from the birth date. For babies born early, doctors usually use “corrected age”
                and sometimes special preterm charts, so the WHO lines here may not fit {name}. We don’t adjust or
                interpret them automatically — please go by your paediatrician’s chart.
              </Text>
              <TouchableOpacity onPress={() => setKidField({ bornEarly: 'no' })} accessibilityRole="button">
                <Text style={[styles.sourceLinkText, { marginTop: 6 }]}>Change this answer</Text>
              </TouchableOpacity>
            </View>
          )}

          <Card style={styles.chartCard} shadow="sm">
            <GrowthChart indicator={indicator} sex={sex} visits={visits} dob={dob} ageNow={ageNow} />
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: Colors.primary, height: 3 }]} /><Text style={styles.legendText}>{name}’s readings</Text></View>
              {sex && <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: '#B7A4D6' }]} /><Text style={styles.legendText}>WHO lines (3, 15, 50, 85, 97) · {sex === 'girl' ? 'girls' : 'boys'}</Text></View>}
            </View>
          </Card>

          {indicator === 'height' && (
            <Text style={styles.small}>
              Under 2 years children are measured lying down (length); after that, standing (height). Standing height
              reads about 0.7 cm less, so the WHO lines step down slightly at 2 years.
            </Text>
          )}
          {ageNow > WHO_MAX_MONTHS && (
            <Text style={styles.small}>
              The WHO Child Growth Standards used here cover birth to 5 years, so the reference lines stop at 5 years.
              {` ${name}`}’s own readings are still plotted.
            </Text>
          )}

          <View style={styles.explain}>
            <Text style={styles.explainTitle}>How to read the lines</Text>
            <Text style={styles.explainText}>
              The faint lines show how healthy children of the same age and sex grew in the WHO study. On the 50 line,
              half of children were bigger and half were smaller. On the 15 line, 15 in 100 were smaller.
            </Text>
            <Text style={styles.explainText}>
              A higher line is not better and a lower line is not worse — children come in different sizes. What
              matters most is that {name} keeps growing along a similar curve over time. One reading on its own says
              very little.
            </Text>
            <TouchableOpacity onPress={() => setShowSource(true)} accessibilityRole="button">
              <Text style={styles.sourceLinkText}>About these charts and their source</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Milestones ── */}
      {segment === 'milestones' && <MilestonesPanel kid={kid} ageMonths={ageNow} />}

      {/* ── Footer ── */}
      {segment !== 'graphs' && (
        <TouchableOpacity onPress={() => setShowSource(true)} style={{ marginTop: 14 }} accessibilityRole="button">
          <Text style={styles.sourceLinkText}>About the growth charts and their source</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.reassure}>{GROWTH_REASSURANCE}</Text>

      {/* ── Marker detail ── */}
      <Modal visible={openMarker !== null} transparent animationType="slide" onRequestClose={() => setOpenMarker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenMarker(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            {openMarker !== null && (
              <ScrollView style={{ maxHeight: 520 }}>
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle}>{markers[openMarker]?.label}</Text>
                  <TouchableOpacity onPress={() => setOpenMarker(null)} hitSlop={10} accessibilityLabel="Close">
                    <Ionicons name="close" size={22} color={STONE} />
                  </TouchableOpacity>
                </View>
                {(byMarker[openMarker] ?? []).slice().reverse().map((v) => {
                  const age = ageMonthsAt(dob, isoFromDateKey(v.date));
                  const notes = percentileNote(v);
                  return (
                    <View key={v.date} style={styles.visit}>
                      <Text style={styles.visitDate}>{fmtDate(v.date)} · {formatAge(age) === 'At birth' ? 'at birth' : formatAge(age)}</Text>
                      {v.weightKg != null && <Text style={styles.visitLine}>Weight: {fmtKg(v.weightKg)}</Text>}
                      {v.lengthCm != null && <Text style={styles.visitLine}>{lengthWord(v, age)}: {fmtCm(v.lengthCm)} ({(v.lengthMode ?? (age < 24 ? 'lying' : 'standing')) === 'lying' ? 'lying down' : 'standing'})</Text>}
                      {v.headCm != null && <Text style={styles.visitLine}>Head circumference: {fmtCm(v.headCm)}</Text>}
                      {!!v.place && <Text style={styles.visitMeta}>Measured {v.place === 'home' ? 'at home' : 'at a clinic'}</Text>}
                      {!!v.note && <Text style={styles.visitMeta}>Notes: {v.note}</Text>}
                      {notes.length > 0 && (
                        <Text style={styles.visitMeta}>On the WHO chart — {notes.join('; ')}. This describes one reading, not {name}’s health.</Text>
                      )}
                      <TouchableOpacity onPress={() => { setOpenMarker(null); setTimeout(() => setForm({ initial: v }), 350); }}
                        style={styles.editBtn} accessibilityRole="button">
                        <Ionicons name="create-outline" size={15} color={Colors.primary} />
                        <Text style={styles.editText}>Edit or delete</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <TouchableOpacity
                  onPress={() => { const m = markers[openMarker]; setOpenMarker(null); setTimeout(() => setForm({ presetDate: presetFor(dob, m.months, today) }), 350); }}
                  style={styles.addAnother} accessibilityRole="button">
                  <Ionicons name="add-circle-outline" size={17} color={Colors.primary} />
                  <Text style={styles.editText}>Add another measurement</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Source info ── */}
      <Modal visible={showSource} transparent animationType="fade" onRequestClose={() => setShowSource(false)}>
        <Pressable style={[styles.backdrop, { justifyContent: 'center', padding: 22 }]} onPress={() => setShowSource(false)}>
          <Pressable style={styles.sourceCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>About these charts</Text>
            <Text style={styles.explainText}>
              Reference lines: {WHO_SOURCE.name} (weight-for-age, length/height-for-age and head circumference-for-age,
              boys and girls, birth to 5 years).
            </Text>
            <Text style={styles.explainText}>{WHO_SOURCE.note}</Text>
            <Text style={styles.explainText}>
              MaaMitra only plots what you record. It does not diagnose, and it never fills in readings for you.
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(WHO_SOURCE.url)} accessibilityRole="link">
              <Text style={styles.sourceLinkText}>Open the WHO Child Growth Standards ↗</Text>
            </TouchableOpacity>
            <GradientButton title="Close" onPress={() => setShowSource(false)} style={{ marginTop: 14 }} />
          </Pressable>
        </Pressable>
      </Modal>

      <MeasurementSheet
        visible={!!form}
        kidId={kid.id}
        kidName={name}
        dob={dob}
        initial={form?.initial}
        presetDate={form?.presetDate}
        onClose={() => setForm(null)}
      />
    </View>
  );
}

/** Date to pre-fill when adding at an empty marker: that age, never in the future. */
function presetFor(dob: string, months: number, today: string): string {
  const d = new Date(dateKey(dob) + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  const key = dateKey(d);
  return key > today ? today : key;
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 18 },
  emptyTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: INK, marginBottom: 6, textAlign: 'center' },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 13.5, color: STONE, textAlign: 'center', lineHeight: 20 },

  overview: { padding: 16, marginBottom: 14 },
  kidName: { fontFamily: Fonts.serif, fontSize: 24, color: INK },
  kidAge: { fontFamily: Fonts.sansMedium, fontSize: 13, color: STONE, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: Colors.primaryAlpha05, borderRadius: 14, padding: 10, gap: 2, minHeight: 92 },
  statLabel: { fontFamily: Fonts.sansMedium, fontSize: 11.5, color: STONE, marginTop: 4 },
  statValue: { fontFamily: Fonts.sansBold, fontSize: 16, color: INK },
  statEmpty: { fontFamily: Fonts.sansMedium, fontSize: 12.5, color: Colors.textMuted },
  statDate: { fontFamily: Fonts.sansRegular, fontSize: 10.5, color: STONE },

  segments: { flexDirection: 'row', backgroundColor: Colors.primaryAlpha08, borderRadius: 14, padding: 4, marginBottom: 14 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentOn: { backgroundColor: Colors.white },
  segmentText: { fontFamily: Fonts.sansMedium, fontSize: 13.5, color: STONE },
  segmentTextOn: { fontFamily: Fonts.sansBold, color: Colors.primary },

  hintBox: { backgroundColor: Colors.primaryAlpha05, borderRadius: 12, padding: 12, marginBottom: 12 },
  hintText: { fontFamily: Fonts.sansRegular, fontSize: 13, lineHeight: 19, color: STONE },
  row: { flexDirection: 'row', gap: 12 },
  rail: { width: 40, alignItems: 'center' },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dotIcon: { fontSize: 18 },
  line: { width: 4, flex: 1, borderRadius: 2, opacity: 0.55, marginVertical: 2 },
  entry: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 10 },
  entryEmpty: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  entryAge: { fontFamily: Fonts.sansBold, fontSize: 14, color: INK },
  entryValues: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.primary, marginTop: 4 },
  entryDate: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: STONE, marginTop: 2 },
  entryEmptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  entryNone: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: STONE },
  entryAdd: { fontFamily: Fonts.sansBold, fontSize: 12.5, color: Colors.primary },

  indRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  ind: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  indOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  indText: { fontFamily: Fonts.sansMedium, fontSize: 12.5, color: STONE },
  indTextOn: { color: '#fff', fontFamily: Fonts.sansSemiBold },
  ask: { backgroundColor: Colors.primaryAlpha05, borderWidth: 1, borderColor: Colors.primaryAlpha08, borderRadius: 14, padding: 12, marginBottom: 12 },
  askTitle: { fontFamily: Fonts.sansBold, fontSize: 13.5, color: INK },
  askText: { fontFamily: Fonts.sansRegular, fontSize: 12.5, lineHeight: 18, color: STONE, marginTop: 4 },
  askBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  askBtn: { paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.white },
  askBtnOn: { backgroundColor: Colors.primary },
  askBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.primary },
  askBtnTextOn: { color: '#fff' },
  chartCard: { padding: 10, marginBottom: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8, paddingHorizontal: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 18, height: 2, borderRadius: 1 },
  legendText: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: STONE },
  small: { fontFamily: Fonts.sansRegular, fontSize: 12, lineHeight: 17, color: STONE, marginBottom: 10 },
  explain: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  explainTitle: { fontFamily: Fonts.sansBold, fontSize: 13.5, color: INK },
  explainText: { fontFamily: Fonts.sansRegular, fontSize: 13, lineHeight: 19, color: STONE },
  sourceLinkText: { fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: Colors.primary },
  reassure: { fontFamily: Fonts.sansRegular, fontSize: 12.5, lineHeight: 19, color: STONE, marginTop: 14, textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontFamily: Fonts.sansBold, fontSize: 17, color: INK },
  visit: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12, marginBottom: 10, gap: 3 },
  visitDate: { fontFamily: Fonts.sansBold, fontSize: 13, color: INK, marginBottom: 2 },
  visitLine: { fontFamily: Fonts.sansMedium, fontSize: 14, color: INK },
  visitMeta: { fontFamily: Fonts.sansRegular, fontSize: 12.5, lineHeight: 18, color: STONE },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 36 },
  editText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.primary },
  addAnother: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  sourceCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, gap: 8, width: '100%', maxWidth: 440, alignSelf: 'center' },
});
