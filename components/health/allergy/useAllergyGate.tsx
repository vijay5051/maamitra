import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../../constants/theme';
import { useKidAllergies } from '../../../hooks/useKidAllergies';
import {
  allergyAlertSentences,
  allergyAlertTitle,
  AllergyMatch,
  MealLike,
  NOT_A_GUARANTEE,
} from '../../../lib/foodAllergies';
import FoodAllergySheet from './FoodAllergySheet';
import { saveKidAllergies } from './saveKidAllergies';

const INK = Colors.textDark;
const RED = '#B91C1C';
const AMBER = '#92400E';

type Mode = 'open' | 'select';

interface Pending {
  mode: Mode;
  matches: AllergyMatch[];
  /** "This recipe" / "This meal" — typed planner notes aren't recipes. */
  subject: string;
  /** Continue with what the parent tapped (open the recipe / add it). */
  onProceed: () => void;
  /** select mode only: look at the recipe instead of adding it. */
  onViewDetails?: () => void;
  /** What "proceed" does in select mode, e.g. "Add to Monday anyway". */
  proceedLabel?: string;
  /** Typed text is not a full ingredient list. */
  partialCheck?: boolean;
}

/**
 * Allergy popup for the active child.
 *
 *   const gate = useAllergyGate();
 *   gate.open(meal, () => setOpenRecipe(r));              // opening a recipe
 *   gate.select(meal, () => addToPlan(r), { ... });        // planner / travel pack
 *   ...
 *   {gate.element}   // render INSIDE the same Modal as the trigger, if any
 *
 * No match → the callback runs straight away, no popup. A match never
 * proceeds silently: the parent must pick an action. The popup is driven by
 * the tap (not by render), so re-renders can't re-open it.
 */
export function useAllergyGate() {
  const { activeKid, kidName, allergies, match } = useKidAllergies();
  const [pending, setPending] = useState<Pending | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const busy = useRef(false);

  const run = useCallback(
    (mode: Mode, meal: MealLike, onProceed: () => void, opts?: Partial<Pending>) => {
      const matches = match(meal);
      if (matches.length === 0) {
        onProceed();
        return;
      }
      if (busy.current) return; // one popup at a time
      busy.current = true;
      setPending({ mode, matches, subject: 'This recipe', onProceed, ...opts });
    },
    [match],
  );

  const close = () => {
    busy.current = false;
    setPending(null);
  };

  const p = pending;
  const known = !!p?.matches.some((m) => m.entry.status === 'known');
  const tint = known ? RED : AMBER;

  const element = (
    <>
      <Modal visible={!!p} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Dismiss allergy alert">
          <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert">
            {p && (
              <ScrollView contentContainerStyle={{ padding: 20 }} bounces={false}>
                <View style={[styles.iconWrap, { backgroundColor: known ? '#FEF2F2' : '#FEF3C7' }]}>
                  <Ionicons name={known ? 'alert-circle' : 'help-circle'} size={26} color={tint} />
                </View>
                <Text style={styles.title}>{allergyAlertTitle(kidName, p.matches)}</Text>
                {allergyAlertSentences(kidName, p.matches, p.subject).map((s, i) => (
                  <Text key={i} style={styles.body}>{s}</Text>
                ))}
                {!known && (
                  <Text style={styles.small}>A suspected reaction is not a diagnosis — check with {kidName}’s doctor.</Text>
                )}
                {p.partialCheck && (
                  <Text style={styles.small}>
                    We only checked the words you typed, not a full ingredient list. {NOT_A_GUARANTEE}
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={close}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>{p.mode === 'open' ? 'Go back' : 'Choose another meal'}</Text>
                </TouchableOpacity>

                {p.mode === 'open' ? (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => { const go = p.onProceed; close(); go(); }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryText}>View recipe details</Text>
                  </TouchableOpacity>
                ) : p.onViewDetails ? (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => { const go = p.onViewDetails!; close(); go(); }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryText}>View recipe details</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => { close(); setTimeout(() => setListOpen(true), 350); }}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkText}>View {kidName}’s allergy list</Text>
                </TouchableOpacity>

                {p.mode === 'select' && (
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => { const go = p.onProceed; close(); go(); }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.quietText}>{p.proceedLabel ?? 'Add anyway'}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {activeKid && (
        <FoodAllergySheet
          visible={listOpen}
          kidName={kidName}
          value={allergies}
          onClose={() => setListOpen(false)}
          onSave={(next) => {
            saveKidAllergies(activeKid.id, next);
            setListOpen(false);
          }}
        />
      )}
    </>
  );

  return {
    /** Opening a recipe: popup first when it matches. */
    open: (meal: MealLike, onProceed: () => void) => run('open', meal, onProceed),
    /** Adding to the planner / travel pack: never added without an explicit choice. */
    select: (
      meal: MealLike,
      onProceed: () => void,
      opts?: { onViewDetails?: () => void; proceedLabel?: string; subject?: string; partialCheck?: boolean },
    ) => run('select', meal, onProceed, opts),
    element,
  };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.5)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 420, maxHeight: '86%', backgroundColor: Colors.white, borderRadius: 22, overflow: 'hidden' },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 },
  title: { fontFamily: Fonts.sansBold, fontSize: 18, color: INK, textAlign: 'center', marginBottom: 10 },
  body: { fontFamily: Fonts.sansRegular, fontSize: 15, lineHeight: 22, color: INK, marginBottom: 8 },
  small: { fontFamily: Fonts.sansRegular, fontSize: 12.5, lineHeight: 18, color: Colors.textLight, marginBottom: 6 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryText: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#fff' },
  secondaryBtn: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderWidth: 1.5, borderColor: Colors.primary },
  secondaryText: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.primary },
  linkBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  linkText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.primary },
  quietText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textLight, textDecorationLine: 'underline' },
});
