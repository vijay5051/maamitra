import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientButton from '../../ui/GradientButton';
import { Colors, Fonts } from '../../../constants/theme';
import { BABY_FOODS, FOOD_CATEGORIES, FoodCategory } from '../../../data/babyFoods';
import {
  ALLERGEN_GROUPS,
  AllergyStatus,
  customEntry,
  foodEntry,
  FoodAllergyEntry,
  groupEntry,
  KidFoodAllergies,
  normalizeFoodText,
  shortFoodName,
} from '../../../lib/foodAllergies';

const INK = Colors.textDark;
const STONE = Colors.textLight;
const RED = '#B91C1C';
const RED_BG = '#FEF2F2';
const AMBER = '#92400E';
const AMBER_BG = '#FEF3C7';

interface Props {
  visible: boolean;
  kidName: string;
  value: KidFoodAllergies;
  onClose: () => void;
  onSave: (next: KidFoodAllergies) => void;
}

/**
 * "Food allergies & reactions" editor for one child. Search or browse the
 * food catalogue, add custom foods, mark each as a known allergy or a
 * suspected reaction, and keep notes. Entirely optional — "Not sure yet"
 * saves an empty list.
 */
export default function FoodAllergySheet({ visible, kidName, value, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<FoodAllergyEntry[]>(value.entries);
  const [notSure, setNotSure] = useState(!!value.notSure);
  const [search, setSearch] = useState('');
  const [openCat, setOpenCat] = useState<FoodCategory | null>(null);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);

  // Reset the draft each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setEntries(value.entries);
    setNotSure(!!value.notSure);
    setSearch('');
    setOpenCat(null);
    setNoteOpen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const has = (key: string) => entries.some((e) => e.key === key);
  const add = (e: FoodAllergyEntry | null) => {
    if (!e || has(e.key)) return;
    setEntries((p) => [...p, e]);
    setNotSure(false);
  };
  const remove = (key: string) => setEntries((p) => p.filter((e) => e.key !== key));
  const toggle = (e: FoodAllergyEntry) => (has(e.key) ? remove(e.key) : add(e));
  const patch = (key: string, data: Partial<FoodAllergyEntry>) =>
    setEntries((p) => p.map((e) => (e.key === key ? { ...e, ...data } : e)));

  const q = normalizeFoodText(search);
  const results = useMemo(() => {
    if (!q) return null;
    const groups = ALLERGEN_GROUPS.filter(
      (g) => g.label.toLowerCase().includes(q) || g.words.some((w) => w.startsWith(q)),
    );
    const foods = BABY_FOODS.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 30);
    const exact =
      foods.some((f) => shortFoodName(f).toLowerCase() === q) || groups.some((g) => g.words[0] === q);
    return { groups, foods, exact };
  }, [q]);

  const chip = (key: string, label: string, onPress: () => void) => {
    const on = has(key);
    return (
      <TouchableOpacity
        key={key}
        onPress={onPress}
        style={[styles.chip, on && styles.chipOn]}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={label}
      >
        {on && <Ionicons name="checkmark" size={13} color="#fff" />}
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { paddingTop: Platform.OS === 'web' ? 0 : 6 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close without saving">
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Food allergies &amp; reactions</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Optional. Add foods {kidName} is allergic to, or foods you think caused a reaction. MaaMitra will alert
            you when a recipe or meal contains them.
          </Text>

          {/* ── On the list ── */}
          <Text style={styles.label}>On {kidName}’s list</Text>
          {entries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {notSure ? 'Marked “Not sure yet”. You can add foods any time.' : 'Nothing added yet.'}
              </Text>
              <TouchableOpacity
                onPress={() => setNotSure((v) => !v)}
                style={[styles.chip, notSure && styles.chipOnSoft]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: notSure }}
              >
                {notSure && <Ionicons name="checkmark" size={13} color={Colors.primary} />}
                <Text style={[styles.chipText, notSure && { color: Colors.primary, fontFamily: Fonts.sansSemiBold }]}>
                  Not sure yet
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            entries.map((e) => (
              <View key={e.key} style={styles.entry}>
                <View style={styles.entryTop}>
                  <Text style={styles.entryName} numberOfLines={1}>{e.label}</Text>
                  <TouchableOpacity onPress={() => remove(e.key)} hitSlop={10} accessibilityLabel={`Remove ${e.label}`}>
                    <Ionicons name="trash-outline" size={17} color={STONE} />
                  </TouchableOpacity>
                </View>
                <View style={styles.statusRow}>
                  {(['known', 'suspected'] as AllergyStatus[]).map((st) => {
                    const on = e.status === st;
                    const fg = st === 'known' ? RED : AMBER;
                    const bg = st === 'known' ? RED_BG : AMBER_BG;
                    return (
                      <TouchableOpacity
                        key={st}
                        onPress={() => patch(e.key, { status: st })}
                        style={[styles.statusBtn, on && { backgroundColor: bg, borderColor: fg }]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.statusText, on && { color: fg, fontFamily: Fonts.sansBold }]}>
                          {st === 'known' ? 'Known allergy' : 'Suspected reaction'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {noteOpen === e.key || e.note ? (
                  <TextInput
                    value={e.note ?? ''}
                    onChangeText={(t) => patch(e.key, { note: t.slice(0, 300) })}
                    placeholder="What happened, or what the doctor advised"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.noteInput}
                    multiline
                    accessibilityLabel={`Note for ${e.label}`}
                  />
                ) : (
                  <TouchableOpacity onPress={() => setNoteOpen(e.key)} style={{ marginTop: 8 }}>
                    <Text style={styles.addNote}>+ Add a note</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {/* ── Search ── */}
          <Text style={[styles.label, { marginTop: 18 }]}>Add a food</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={STONE} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search milk, banana, peanut…"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              accessibilityLabel="Search foods"
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={STONE} />
              </TouchableOpacity>
            )}
          </View>

          {results ? (
            <View style={{ marginTop: 10 }}>
              <View style={styles.chips}>
                {results.groups.map((g) => chip(`group:${g.key}`, g.label, () => toggle(groupEntry(g.key))))}
                {results.foods.map((f) => chip(`food:${f.id}`, shortFoodName(f), () => toggle(foodEntry(f))))}
              </View>
              {!results.exact && (
                <TouchableOpacity
                  onPress={() => { add(customEntry(search)); setSearch(''); }}
                  style={styles.customBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="add-circle-outline" size={17} color={Colors.primary} />
                  <Text style={styles.customText}>Add “{search.trim()}” as a custom food</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.subLabel}>Common allergen groups</Text>
              <View style={styles.chips}>
                {ALLERGEN_GROUPS.map((g) => chip(`group:${g.key}`, g.label, () => toggle(groupEntry(g.key))))}
              </View>

              <Text style={styles.subLabel}>Browse foods</Text>
              {FOOD_CATEGORIES.map((cat) => {
                const foods = BABY_FOODS.filter((f) => f.category === cat.id);
                const open = openCat === cat.id;
                const picked = foods.filter((f) => has(`food:${f.id}`)).length;
                return (
                  <View key={cat.id} style={styles.cat}>
                    <TouchableOpacity
                      onPress={() => setOpenCat(open ? null : cat.id)}
                      style={[styles.catHeader, { backgroundColor: cat.tint }]}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <Ionicons name={cat.icon as any} size={16} color={INK} />
                      <Text style={styles.catTitle}>{cat.label}</Text>
                      {picked > 0 && <Text style={styles.catCount}>{picked} added</Text>}
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={INK} />
                    </TouchableOpacity>
                    {open && (
                      <View style={[styles.chips, { padding: 10 }]}>
                        {foods.map((f) => chip(`food:${f.id}`, shortFoodName(f), () => toggle(foodEntry(f))))}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.primary} />
            <Text style={styles.disclaimerText}>
              A suspected reaction is not a diagnosis. For any reaction — and before giving a listed food again —
              talk to {kidName}’s doctor.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <GradientButton
            title={entries.length ? `Save list (${entries.length})` : notSure ? 'Save — not sure yet' : 'Save — nothing to add'}
            onPress={() => onSave({ entries: entries.map((e) => ({ ...e, note: e.note?.trim() || undefined })), notSure: entries.length === 0 && notSure })}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft, backgroundColor: Colors.white,
  },
  headerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scroll: { padding: 18, paddingBottom: 30 },
  intro: { fontFamily: Fonts.sansRegular, fontSize: 13.5, color: STONE, lineHeight: 20, marginBottom: 16 },
  label: { fontFamily: Fonts.sansBold, fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  subLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: INK, marginTop: 16, marginBottom: 8 },
  emptyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: STONE, flex: 1, minWidth: 140 },
  entry: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  entryName: { fontFamily: Fonts.sansBold, fontSize: 15, color: INK, flex: 1 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statusBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#FAFAFB',
  },
  statusText: { fontFamily: Fonts.sansMedium, fontSize: 12.5, color: STONE },
  addNote: { fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: Colors.primary },
  noteInput: {
    marginTop: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 9, minHeight: 44,
    fontFamily: Fonts.sansRegular, fontSize: 14, color: INK, backgroundColor: '#F9F7FD',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, minHeight: 46,
  },
  searchInput: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 16, color: INK, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipOnSoft: { backgroundColor: Colors.primaryAlpha08, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: INK },
  chipTextOn: { color: '#fff', fontFamily: Fonts.sansSemiBold },
  customBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 6 },
  customText: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: Colors.primary, flex: 1 },
  cat: { borderRadius: 12, overflow: 'hidden', marginBottom: 8, borderWidth: 1, borderColor: Colors.borderSoft, backgroundColor: Colors.white },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  catTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: INK, flex: 1 },
  catCount: { fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: Colors.primary },
  disclaimer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 18, padding: 12,
    backgroundColor: Colors.primaryAlpha05, borderRadius: 10, borderWidth: 1, borderColor: Colors.primaryAlpha08,
  },
  disclaimerText: { fontFamily: Fonts.sansRegular, flex: 1, fontSize: 12, color: STONE, lineHeight: 17 },
  footer: { paddingHorizontal: 18, paddingTop: 10, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
});
