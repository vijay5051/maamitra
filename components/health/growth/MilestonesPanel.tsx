import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../../ui/GradientButton';
import DatePickerField from '../../ui/DatePickerField';
import { Colors, Fonts } from '../../../constants/theme';
import {
  DevMilestone,
  MILESTONE_DOMAINS,
  MILESTONE_SOURCES,
  MilestoneDomain,
  milestonesForAge,
  milestoneWindowText,
} from '../../../data/developmentMilestones';
import { dateKey } from '../../../lib/growth';
import { Kid, MilestoneState, useProfileStore } from '../../../store/useProfileStore';
import { persistProfile } from '../allergy/saveKidAllergies';

const INK = Colors.textDark;
const STONE = Colors.textLight;
const GREEN = '#166534';
const GREEN_BG = '#DCFCE7';

function formatDay(key: string): string {
  const d = new Date(key + 'T12:00:00');
  return isNaN(d.getTime()) ? key : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Developmental milestones (movement, communication, social, learning &
 * fine motor) — separate from growth measurements. The parent records
 * "Observed" or "Not yet"; nothing is ever ticked from the child's age,
 * and there is no score.
 */
export default function MilestonesPanel({ kid, ageMonths }: { kid: Kid; ageMonths: number }) {
  const setKidMilestone = useProfileStore((s) => s.setKidMilestone);
  const [domain, setDomain] = useState<MilestoneDomain | 'all'>('all');
  const [open, setOpen] = useState<DevMilestone | null>(null);

  const list = useMemo(() => milestonesForAge(ageMonths), [ageMonths]);
  const shown = domain === 'all' ? list : list.filter((m) => m.domain === domain);
  const states = kid.milestoneStates ?? {};

  const save = (m: DevMilestone, state: Omit<MilestoneState, 'updatedAt'> | null) => {
    setKidMilestone(kid.id, m.id, state);
    persistProfile();
    setOpen(null);
  };

  return (
    <View>
      <Text style={styles.intro}>
        Skills children pick up as they grow, with the ages they usually appear. Record what you’ve seen {kid.name} do —
        there’s no score, and children reach these in their own order.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {[{ id: 'all' as const, label: 'All' }, ...MILESTONE_DOMAINS].map((d) => {
          const on = domain === d.id;
          return (
            <TouchableOpacity key={d.id} onPress={() => setDomain(d.id)} style={[styles.filter, on && styles.filterOn]}
              accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[styles.filterText, on && styles.filterTextOn]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {shown.map((m) => {
        const st = states[m.id];
        const d = MILESTONE_DOMAINS.find((x) => x.id === m.domain)!;
        const observed = st?.reached === true;
        const notYet = st?.reached === false;
        return (
          <TouchableOpacity key={m.id} onPress={() => setOpen(m)} activeOpacity={0.85} style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`${m.title}. ${milestoneWindowText(m)}. ${observed ? 'Observed' : notYet ? 'Not yet' : 'Not recorded'}. Tap to record.`}>
            <View style={[styles.icon, { backgroundColor: d.tint }]}>
              <Ionicons name={d.icon as any} size={18} color={INK} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{m.title}</Text>
              <Text style={styles.window}>{d.label} · {milestoneWindowText(m)}</Text>
              {observed && (
                <Text style={[styles.state, { color: GREEN }]}>
                  Observed{st?.observedOn ? ` · ${formatDay(st.observedOn)}` : ''}
                </Text>
              )}
              {notYet && <Text style={[styles.state, { color: STONE }]}>Not yet</Text>}
              {!!st?.note && <Text style={styles.note} numberOfLines={2}>“{st.note}”</Text>}
            </View>
            {observed ? (
              <View style={styles.tick}><Ionicons name="checkmark" size={15} color={GREEN} /></View>
            ) : (
              <Text style={styles.record}>{notYet ? 'Update' : 'Record'}</Text>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.sources}>
        <Text style={styles.sourcesTitle}>Where these ages come from</Text>
        {Object.values(MILESTONE_SOURCES).map((s) => (
          <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url)} accessibilityRole="link">
            <Text style={styles.sourceLink}>{s.name} ↗</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.sourceNote}>
          Ages are when most children show a skill, not deadlines. Babies born early often reach them a little later.
        </Text>
      </View>

      <MilestoneSheet milestone={open} state={open ? states[open.id] : undefined} kid={kid} onClose={() => setOpen(null)} onSave={save} />
    </View>
  );
}

function MilestoneSheet({
  milestone,
  state,
  kid,
  onClose,
  onSave,
}: {
  milestone: DevMilestone | null;
  state: MilestoneState | undefined;
  kid: Kid;
  onClose: () => void;
  onSave: (m: DevMilestone, state: Omit<MilestoneState, 'updatedAt'> | null) => void;
}) {
  const today = dateKey(new Date());
  const [reached, setReached] = useState<boolean | null>(null);
  const [on, setOn] = useState(today);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!milestone) return;
    setReached(typeof state?.reached === 'boolean' ? state.reached : null);
    setOn(state?.observedOn ?? today);
    setNote(state?.note ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone?.id]);

  if (!milestone) return null;
  const dobKey = kid.dob ? dateKey(kid.dob) : undefined;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{milestone.title}</Text>
              <Text style={styles.window}>{milestoneWindowText(milestone)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={STONE} />
            </TouchableOpacity>
          </View>

          <View style={styles.seg}>
            {([[false, 'Not yet'], [true, 'Observed']] as const).map(([val, label]) => {
              const sel = reached === val;
              return (
                <TouchableOpacity key={label} onPress={() => setReached(val)}
                  style={[styles.segBtn, sel && (val ? styles.segOnGreen : styles.segOn)]}
                  accessibilityRole="radio" accessibilityState={{ selected: sel }}>
                  <Text style={[styles.segText, sel && { color: val ? GREEN : Colors.primary, fontFamily: Fonts.sansBold }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {reached === true && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.label}>When did you first see it?</Text>
              <DatePickerField value={on} onChange={(d) => setOn(d > today ? today : d)} minDate={dobKey} maxDate={today} />
            </View>
          )}
          {reached === false && (
            <Text style={styles.hint}>
              That’s fine — children reach this at different times. If you’re wondering about it, mention it at the next
              check-up.
            </Text>
          )}

          <Text style={[styles.label, { marginTop: 14 }]}>Notes (optional)</Text>
          <TextInput value={note} onChangeText={(t) => setNote(t.slice(0, 300))} placeholder="Anything you want to remember"
            placeholderTextColor={Colors.textMuted} style={styles.noteInput} multiline accessibilityLabel="Notes" />

          <GradientButton
            title="Save"
            disabled={reached === null}
            onPress={() => onSave(milestone, { reached: reached === true, ...(reached ? { observedOn: on } : {}), ...(note.trim() ? { note: note.trim() } : {}) })}
            style={{ marginTop: 16 }}
          />
          {state && (
            <TouchableOpacity onPress={() => onSave(milestone, null)} style={styles.clear} accessibilityRole="button">
              <Text style={styles.clearText}>Clear this record</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: Fonts.sansRegular, fontSize: 13, lineHeight: 19, color: STONE, marginBottom: 12 },
  filters: { gap: 8, paddingBottom: 12 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  filterOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: STONE },
  filterTextOn: { color: '#fff', fontFamily: Fonts.sansSemiBold },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: INK, lineHeight: 19 },
  window: { fontFamily: Fonts.sansRegular, fontSize: 12, color: STONE, marginTop: 2 },
  state: { fontFamily: Fonts.sansSemiBold, fontSize: 12, marginTop: 4 },
  note: { fontFamily: Fonts.sansRegular, fontSize: 12, color: STONE, marginTop: 3, fontStyle: 'italic' },
  tick: { width: 28, height: 28, borderRadius: 14, backgroundColor: GREEN_BG, alignItems: 'center', justifyContent: 'center' },
  record: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },
  sources: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.primaryAlpha05, borderWidth: 1, borderColor: Colors.primaryAlpha08, gap: 6 },
  sourcesTitle: { fontFamily: Fonts.sansBold, fontSize: 12, color: INK },
  sourceLink: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: Colors.primary, lineHeight: 17 },
  sourceNote: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: STONE, lineHeight: 17 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: Fonts.sansBold, fontSize: 17, color: INK },
  seg: { flexDirection: 'row', gap: 10, marginTop: 16 },
  segBtn: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#FAFAFB' },
  segOn: { backgroundColor: Colors.primaryAlpha08, borderColor: Colors.primary },
  segOnGreen: { backgroundColor: GREEN_BG, borderColor: '#86EFAC' },
  segText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: STONE },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: INK, marginBottom: 8 },
  hint: { fontFamily: Fonts.sansRegular, fontSize: 12.5, lineHeight: 18, color: STONE, marginTop: 12 },
  noteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: '#F9F7FD',
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 60, fontFamily: Fonts.sansRegular, fontSize: 15, color: INK, textAlignVertical: 'top',
  },
  clear: { alignItems: 'center', paddingVertical: 12 },
  clearText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: STONE },
});
