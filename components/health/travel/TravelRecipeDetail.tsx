import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { TravelRecipe, CATEGORY_BY_KEY, GEAR_LABELS } from '../../../data/travelRecipes';

const INK = Colors.textDark;
const STONE = Colors.textMuted;
const PURPLE = Colors.primary;
const AMBER_BG = '#FEF3C7';
const AMBER_FG = '#92400E';
const GREEN_BG = '#DCFCE7';
const GREEN_FG = '#166534';

interface Props {
  visible: boolean;
  recipe: TravelRecipe | null;
  isBookmarked: boolean;
  hotWeather: boolean;
  testedAtHome: boolean;
  onClose: () => void;
  onToggleBookmark: () => void;
  onToggleHotWeather: (v: boolean) => void;
  onSetTestedAtHome: (v: boolean) => void;
}

function effectiveHours(base: number, hot: boolean) {
  if (base <= 0) return 0;
  const h = hot ? Math.ceil(base / 2) : base;
  return h;
}

function hoursLabel(h: number): string {
  if (h <= 0) return '—';
  if (h >= 24) return `${Math.floor(h / 24)} day${h >= 48 ? 's' : ''}`;
  return `${h} hr${h !== 1 ? 's' : ''}`;
}

function StorageBar({ hours, max, color }: { hours: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(hours / max, 1) : 0;
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: { height: 6, backgroundColor: Colors.borderSoft, borderRadius: 3, flex: 1 },
  fill: { height: 6, borderRadius: 3 },
});

export default function TravelRecipeDetail({
  visible,
  recipe,
  isBookmarked,
  hotWeather,
  testedAtHome,
  onClose,
  onToggleBookmark,
  onToggleHotWeather,
  onSetTestedAtHome,
}: Props) {
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [portionScale, setPortionScale] = useState<0.5 | 1 | 2>(1);
  const [activeAllergenTooltip, setActiveAllergenTooltip] = useState<string | null>(null);

  if (!recipe) return null;

  const cat = CATEGORY_BY_KEY[recipe.category];
  const roomH = effectiveHours(recipe.roomTempHours, hotWeather);
  const bagH = effectiveHours(recipe.insulatedBagHours, hotWeather);
  const thermosH = effectiveHours(recipe.thermosHours, hotWeather);
  const maxH = Math.max(roomH, bagH, thermosH);

  function scaleQty(qty: string): string {
    const n = parseFloat(qty);
    if (isNaN(n)) return qty;
    const result = n * portionScale;
    return Number.isInteger(result) ? String(result) : result.toFixed(1);
  }

  function toggleIngredient(i: number) {
    setCheckedIngredients((s) => ({ ...s, [i]: !s[i] }));
  }

  function toggleGear(key: string) {
    setCheckedGear((s) => ({ ...s, [key]: !s[key] }));
  }

  function handleClose() {
    setCheckedIngredients({});
    setCheckedGear({});
    setCheckedSteps({});
    setPortionScale(1);
    setActiveAllergenTooltip(null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
          <TouchableOpacity onPress={onToggleBookmark} hitSlop={10}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isBookmarked ? PURPLE : INK}
            />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Hero block */}
          <View style={styles.heroBlock}>
            <View style={[styles.heroIcon, { backgroundColor: Colors.primaryAlpha08 }]}>
              <Text style={{ fontSize: 40 }}>{cat.icon}</Text>
            </View>
            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.subtitle}>{recipe.subtitle}</Text>

            {/* Badge strip */}
            <View style={styles.badgeStrip}>
              <View style={styles.badge}><Text style={styles.badgeText}>{recipe.stageBadge}</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>⏱ {recipe.prepTimeMinutes} min prep</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>{cat.icon} {cat.label}</Text></View>
            </View>
          </View>

          {/* ── Hot weather toggle ── */}
          <View style={styles.section}>
            <View style={styles.hotWeatherRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hotWeatherLabel}>☀️ Hot weather mode</Text>
                <Text style={styles.hotWeatherSub}>Halves all safe eat-within times</Text>
              </View>
              <Switch
                value={hotWeather}
                onValueChange={onToggleHotWeather}
                trackColor={{ true: '#F59E0B', false: Colors.borderSoft }}
                thumbColor={Colors.white}
              />
            </View>
            {hotWeather && (
              <View style={[styles.infoBox, { backgroundColor: AMBER_BG }]}>
                <Ionicons name="warning-outline" size={14} color={AMBER_FG} />
                <Text style={[styles.infoBoxText, { color: AMBER_FG }]}>
                  Times below are halved — hot weather accelerates spoilage.
                </Text>
              </View>
            )}
          </View>

          {/* ── Storage guide ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>🕐 Storage Guide</Text>
            <View style={styles.storageCard}>
              {recipe.roomTempHours > 0 && (
                <View style={styles.storageRow}>
                  <Text style={styles.storageIcon}>📦</Text>
                  <Text style={styles.storageLabel}>Room temp</Text>
                  <StorageBar hours={roomH} max={maxH} color={hotWeather ? '#F59E0B' : Colors.primary} />
                  <Text style={[styles.storageTime, hotWeather && { color: AMBER_FG }]}>
                    {hoursLabel(roomH)}
                  </Text>
                </View>
              )}
              {recipe.insulatedBagHours > 0 && (
                <View style={styles.storageRow}>
                  <Text style={styles.storageIcon}>🧊</Text>
                  <Text style={styles.storageLabel}>Insulated bag</Text>
                  <StorageBar hours={bagH} max={maxH} color={hotWeather ? '#F59E0B' : Colors.primary} />
                  <Text style={[styles.storageTime, hotWeather && { color: AMBER_FG }]}>
                    {hoursLabel(bagH)}
                  </Text>
                </View>
              )}
              {recipe.thermosHours > 0 && (
                <View style={styles.storageRow}>
                  <Text style={styles.storageIcon}>🌡️</Text>
                  <Text style={styles.storageLabel}>Thermos</Text>
                  <StorageBar hours={thermosH} max={maxH} color="#22c55e" />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.storageTime, { color: '#166534' }]}>{hoursLabel(thermosH)}</Text>
                    <Text style={styles.bestBadge}>Best</Text>
                  </View>
                </View>
              )}
              {recipe.gearRequired.filter((g) => g !== 'none').length > 0 && (
                <Text style={styles.gearNote}>
                  Gear needed: {recipe.gearRequired.filter((g) => g !== 'none').map((g) => GEAR_LABELS[g]).join(', ')}
                </Text>
              )}
              {recipe.storageNotes && (
                <Text style={styles.gearNote}>{recipe.storageNotes}</Text>
              )}
            </View>
          </View>

          {/* ── Allergen strips ── */}
          {recipe.allergenContains.length > 0 && (
            <View style={styles.section}>
              <View style={[styles.allergenStrip, { backgroundColor: AMBER_BG, borderColor: '#FCD34D' }]}>
                <Ionicons name="warning-outline" size={14} color={AMBER_FG} />
                <Text style={[styles.allergenLabel, { color: AMBER_FG }]}>Contains: </Text>
                {recipe.allergenContains.map((a) => (
                  <TouchableOpacity
                    key={a}
                    onPress={() => setActiveAllergenTooltip(activeAllergenTooltip === a ? null : a)}
                  >
                    <Text style={[styles.allergenChip, { color: AMBER_FG, borderColor: '#FCD34D' }]}>
                      {a.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {activeAllergenTooltip && recipe.allergenNote && (
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipText}>{recipe.allergenNote}</Text>
                  {/* Substitute hint */}
                  {recipe.ingredients
                    .filter((ing) => ing.allergenFlag === activeAllergenTooltip && ing.substitute)
                    .map((ing, i) => (
                      <Text key={i} style={styles.tooltipSub}>
                        Substitute for {ing.name}: {ing.substitute}
                      </Text>
                    ))}
                </View>
              )}
              <View style={[styles.allergenStrip, { backgroundColor: GREEN_BG, borderColor: '#86EFAC', marginTop: 6 }]}>
                <Ionicons name="checkmark-circle-outline" size={14} color={GREEN_FG} />
                <Text style={[styles.allergenLabel, { color: GREEN_FG }]}>Free of: </Text>
                <Text style={[styles.allergenText, { color: GREEN_FG }]}>
                  {(['milk', 'gluten', 'tree_nuts', 'egg', 'soy', 'sesame'] as const)
                    .filter((a) => !recipe.allergenContains.includes(a))
                    .map((a) => a.replace('_', ' '))
                    .join(', ')}
                </Text>
              </View>
            </View>
          )}

          {/* ── Tested at home toggle ── */}
          {recipe.goldenRuleFlag && (
            <View style={styles.section}>
              <View style={styles.testedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.testedLabel}>✅ Already tested at home?</Text>
                  <Text style={styles.testedSub}>Travel is not the time to introduce new foods.</Text>
                </View>
                <Switch
                  value={testedAtHome}
                  onValueChange={onSetTestedAtHome}
                  trackColor={{ true: '#22c55e', false: Colors.borderSoft }}
                  thumbColor={Colors.white}
                />
              </View>
              {!testedAtHome && (
                <View style={[styles.infoBox, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="information-circle-outline" size={14} color={AMBER_FG} />
                  <Text style={[styles.infoBoxText, { color: AMBER_FG }]}>
                    Introduce this at home first before packing for travel.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Portion scaler ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ingredients</Text>
            <View style={styles.scalerRow}>
              <Text style={styles.scalerLabel}>Portions:</Text>
              {([0.5, 1, 2] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setPortionScale(s)}
                  style={[styles.scalerBtn, portionScale === s && styles.scalerBtnActive]}
                >
                  <Text style={[styles.scalerBtnText, portionScale === s && styles.scalerBtnTextActive]}>
                    {s === 0.5 ? '½x' : `${s}x`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Ingredient checklist */}
            {recipe.ingredients.map((ing, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => toggleIngredient(i)}
                style={styles.ingredientRow}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, checkedIngredients[i] && styles.checkboxChecked]}>
                  {checkedIngredients[i] && <Ionicons name="checkmark" size={11} color={Colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ingredientName, checkedIngredients[i] && styles.strikethrough]}>
                    {ing.name}
                    {ing.allergenFlag && (
                      <Text style={styles.allergenInline}> ⚠️</Text>
                    )}
                  </Text>
                  {ing.substitute && (
                    <Text style={styles.substituteText}>→ {ing.substitute}</Text>
                  )}
                </View>
                <Text style={[styles.ingredientQty, checkedIngredients[i] && styles.strikethrough]}>
                  {scaleQty(ing.quantity)} {ing.unit}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Gear checklist */}
            {recipe.gearRequired.filter((g) => g !== 'none').length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 14, marginBottom: 8 }]}>
                  🎒 Travel Gear Needed
                </Text>
                {recipe.gearRequired.filter((g) => g !== 'none').map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => toggleGear(g)}
                    style={styles.ingredientRow}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, checkedGear[g] && styles.checkboxChecked]}>
                      {checkedGear[g] && <Ionicons name="checkmark" size={11} color={Colors.white} />}
                    </View>
                    <Text style={[styles.ingredientName, checkedGear[g] && styles.strikethrough]}>
                      {GEAR_LABELS[g]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {/* ── Steps ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Preparation Steps</Text>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.stepCard}>
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepText}>{step}</Text>
                  {recipe.stepTips[i] && (
                    <View style={styles.tipBox}>
                      <Ionicons name="bulb-outline" size={12} color={PURPLE} />
                      <Text style={styles.tipText}>{recipe.stepTips[i]}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* ── Packing tips ── */}
          {recipe.packingTips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🧳 Packing Tips</Text>
              {recipe.packingTips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.packingTip}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Sticky footer — save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={onToggleBookmark}
            style={[styles.saveBtn, isBookmarked && styles.saveBtnSaved]}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isBookmarked ? Colors.white : PURPLE}
            />
            <Text style={[styles.saveBtnText, isBookmarked && { color: Colors.white }]}>
              {isBookmarked ? 'Saved to Travel Pack' : 'Save to My Travel Pack'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: Colors.textDark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  scroll: { padding: 16, paddingBottom: 100 },
  heroBlock: { alignItems: 'center', marginBottom: 16 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 20, color: INK, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontFamily: Fonts.sansRegular, fontSize: 13, color: STONE, textAlign: 'center', marginBottom: 10 },
  badgeStrip: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  badge: {
    backgroundColor: Colors.bgTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: Fonts.sansBold, fontSize: 11, color: Colors.textDark },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: INK,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  hotWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  hotWeatherLabel: { fontFamily: Fonts.sansBold, fontSize: 13.5, color: INK },
  hotWeatherSub: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: STONE, marginTop: 2 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 10,
    padding: 10,
  },
  infoBoxText: { fontFamily: Fonts.sansRegular, fontSize: 12, flex: 1, lineHeight: 17 },

  storageCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  storageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storageIcon: { fontSize: 16, width: 22 },
  storageLabel: { fontFamily: Fonts.sansRegular, fontSize: 12, color: STONE, width: 90 },
  storageTime: { fontFamily: Fonts.sansBold, fontSize: 12, color: INK, width: 44, textAlign: 'right' },
  bestBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    color: '#166534',
  },
  gearNote: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11.5,
    color: STONE,
    marginTop: 4,
    lineHeight: 16,
  },

  allergenStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  allergenLabel: { fontFamily: Fonts.sansBold, fontSize: 12 },
  allergenText: { fontFamily: Fonts.sansRegular, fontSize: 12 },
  allergenChip: {
    fontFamily: Fonts.sansBold,
    fontSize: 11.5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  allergenInline: { color: '#F59E0B' },
  tooltipBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  tooltipText: { fontFamily: Fonts.sansRegular, fontSize: 12, color: AMBER_FG, lineHeight: 17 },
  tooltipSub: {
    fontFamily: Fonts.sansBold,
    fontSize: 11.5,
    color: AMBER_FG,
    marginTop: 5,
  },

  testedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  testedLabel: { fontFamily: Fonts.sansBold, fontSize: 13.5, color: INK },
  testedSub: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: STONE, marginTop: 2 },

  scalerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  scalerLabel: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: STONE, marginRight: 4 },
  scalerBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  scalerBtnActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  scalerBtnText: { fontFamily: Fonts.sansBold, fontSize: 12, color: STONE },
  scalerBtnTextActive: { color: Colors.white },

  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: PURPLE, borderColor: PURPLE },
  ingredientName: { fontFamily: Fonts.sansRegular, fontSize: 13, color: INK, flex: 1 },
  substituteText: { fontFamily: Fonts.sansRegular, fontSize: 11, color: STONE, marginTop: 2 },
  ingredientQty: {
    fontFamily: Fonts.sansBold,
    fontSize: 12.5,
    color: STONE,
    minWidth: 54,
    textAlign: 'right',
  },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.45 },

  stepCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  stepNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primaryAlpha12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: { fontFamily: Fonts.sansBold, fontSize: 12, color: PURPLE },
  stepText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: INK, lineHeight: 19, flex: 1 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 8,
    padding: 7,
    marginTop: 7,
  },
  tipText: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: PURPLE, flex: 1, lineHeight: 16 },

  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  tipBullet: { fontFamily: Fonts.sansBold, fontSize: 14, color: PURPLE, marginTop: 1 },
  packingTip: { fontFamily: Fonts.sansRegular, fontSize: 13, color: INK, flex: 1, lineHeight: 18 },

  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    backgroundColor: Colors.white,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: PURPLE,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: Colors.white,
  },
  saveBtnSaved: { backgroundColor: PURPLE },
  saveBtnText: { fontFamily: Fonts.sansBold, fontSize: 15, color: PURPLE },
});
