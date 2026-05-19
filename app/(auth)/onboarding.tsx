import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import DatePickerField from '../../components/ui/DatePickerField';
import GradientButton from '../../components/ui/GradientButton';
import MorphingHero from '../../components/onboarding/MorphingHero';
import StageChip, { type Stage } from '../../components/onboarding/StageChip';
import GenderChip, { type GenderChipValue } from '../../components/onboarding/GenderChip';
import LivePreviewPill from '../../components/onboarding/LivePreviewPill';
import { validateNewbornDob, validatePregnantDueDate } from '../../lib/dateValidation';
import { Colors, Fonts } from '../../constants/theme';

export default function OnboardingScreen() {
  // 1. Routing + layout hooks
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 2. Store hooks
  const { user } = useAuthStore();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const phoneVerified = useProfileStore((s) => s.phoneVerified);
  const { setMotherName, setProfile, addKid, setParentGender, onboardingComplete } = useProfileStore();

  // 3. State hooks — MUST be above any early return (React Rules of Hooks).
  //    Even though the re-entry guards below currently only flip at mount, a
  //    future Firestore subscription could toggle them while this screen is
  //    mounted, causing React to see fewer hooks than the previous render and
  //    crash with "Rendered fewer hooks than expected".
  const initialName = user?.name?.trim() ?? '';
  const [name, setName] = useState(initialName);
  const [stage, setStage] = useState<Stage | null>(null);
  const [keyDate, setKeyDate] = useState('');
  const [kidName, setKidName] = useState('');
  const [kidGenderChip, setKidGenderChip] = useState<GenderChipValue | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 4. Memos — also above early returns for the same reason.
  // LivePreview — rendered only once stage + valid date are set.
  const livePreview = useMemo(() => {
    if (!stage || !keyDate || dateError) return null;
    const d = new Date(keyDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    if (stage === 'pregnant') {
      const msPerWeek = 7 * 86400000;
      const weeksUntilDue = Math.round((d.getTime() - Date.now()) / msPerWeek);
      const weeks = Math.max(0, Math.min(40, 40 - weeksUntilDue));
      const tri = weeks <= 13 ? 'first' : weeks <= 27 ? 'second' : 'third';
      return `You're around ${weeks} weeks in — your ${tri} trimester. Your mitra is ready.`;
    }
    const msPerMonth = 30.5 * 86400000;
    const months = Math.max(0, Math.round((Date.now() - d.getTime()) / msPerMonth));
    const who = kidName.trim() || 'Little one';
    return `${who} is ${months} ${months === 1 ? 'month' : 'months'} old. Vaccines and milestones loaded.`;
  }, [stage, keyDate, dateError, kidName]);

  // 5. Re-entry guards (project Rule 5: <Redirect>, not useEffect+router.replace).
  //    All hooks are above — safe to early-return here without violating the
  //    Rules of Hooks.
  if (!isAuthed) return <Redirect href="/(auth)/welcome" />;
  if (!phoneVerified) return <Redirect href="/(auth)/phone" />;
  if (onboardingComplete) return <Redirect href="/(tabs)" />;

  // 6. Derived consts (NOT hooks — pure computations from state/props).
  // Mother's name field only renders if not pre-filled from auth provider.
  const showNameField = !initialName;
  const dateLabel = stage === 'pregnant' ? 'Due date' : 'Date of birth';
  const nameFieldLabel = stage === 'pregnant'
    ? 'Have you picked a name yet? (optional)'
    : "Baby's name (optional)";
  const nameFieldPlaceholder = stage === 'pregnant' ? 'Even a working name helps' : 'e.g. Aarav';

  // 7. Event handlers

  const onDateChange = (v: string) => {
    setKeyDate(v);
    if (!stage) { setDateError(null); return; }
    setDateError(stage === 'pregnant' ? validatePregnantDueDate(v) : validateNewbornDob(v));
  };

  const onStageChange = (s: Stage) => {
    setStage(s);
    setKidGenderChip(null); // reset — chip options differ between stages
    if (keyDate) {
      setDateError(s === 'pregnant' ? validatePregnantDueDate(keyDate) : validateNewbornDob(keyDate));
    }
  };

  const canSubmit = !!(
    (showNameField ? name.trim() : true) &&
    stage &&
    keyDate &&
    !dateError &&
    !submitting
  );

  const handleSubmit = async () => {
    if (!canSubmit || !stage) return;
    setSubmitting(true);
    try {
      setParentGender('mother');
      const motherDisplayName = showNameField ? name.trim() : initialName;
      setMotherName(motherDisplayName);

      const parsed = new Date(keyDate + 'T00:00:00');
      const validKeyDate = !isNaN(parsed.getTime()) ? parsed.toISOString() : '';
      const isExpecting = stage === 'pregnant';

      // state/diet/familyType are intentionally defaulted — collected later
      // via JIT prompts (Community/Foods) and Settings (familyType).
      // These defaults keep the form minimal while still giving downstream
      // features a known starting value.
      setProfile({
        stage,
        keyDate: validKeyDate,
        state: '',
        diet: 'vegetarian',
        familyType: 'nuclear',
      });

      const primaryName = kidName.trim() || 'Little one';

      // Gender resolution:
      //   chip picked → use chip value
      //   pregnant + skipped → 'surprise' (same as the old wizard default)
      //   newborn + skipped → 'not-set' (Plan A marker; soft-reprompt in Family tab later)
      const genderToStore: 'boy' | 'girl' | 'surprise' | 'not-set' =
        kidGenderChip
          ? kidGenderChip
          : isExpecting
            ? 'surprise'
            : 'not-set';

      addKid({
        name: primaryName,
        dob: validKeyDate,
        stage: isExpecting ? 'pregnant' : 'newborn',
        gender: genderToStore,
        isExpecting,
      });

      // Hand off to the existing setup screen — owns the Firestore write +
      // onboardingComplete flip + retry UI. Keeping persistence isolated
      // from the form means the Firestore round-trip has a guaranteed UI
      // window instead of racing against a router.replace().
      // Cast — typed-routes hasn't regenerated for this rewrite yet.
      (router.replace as any)('/(auth)/setup');
    } catch (err: any) {
      Alert.alert('Could not continue', err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MorphingHero stage={stage} />

          <Text style={styles.heading}>
            {initialName ? `Hi, ${initialName.split(' ')[0]} 👋` : "Let's get to know you"}
          </Text>
          <Text style={styles.sub}>
            Just a few quick things so MaaMitra can be your mitra, not a generic chatbot.
          </Text>

          {showNameField && (
            <View style={styles.field}>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="How should we address you?"
                placeholderTextColor={Colors.textLight}
                style={styles.input}
                autoCapitalize="words"
                accessibilityLabel="Your name"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Where are you right now?</Text>
            <StageChip value={stage} onChange={onStageChange} />
          </View>

          {stage && (
            <View style={styles.field}>
              <Text style={styles.label}>{dateLabel}</Text>
              <DatePickerField value={keyDate} onChange={onDateChange} />
              {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}
            </View>
          )}

          {stage && keyDate && !dateError && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{nameFieldLabel}</Text>
                <TextInput
                  value={kidName}
                  onChangeText={setKidName}
                  placeholder={nameFieldPlaceholder}
                  placeholderTextColor={Colors.textLight}
                  style={styles.input}
                  autoCapitalize="words"
                  accessibilityLabel="Baby's name"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Gender</Text>
                <GenderChip stage={stage} value={kidGenderChip} onChange={setKidGenderChip} />
              </View>

              <LivePreviewPill message={livePreview} />
            </>
          )}

          <GradientButton
            title={submitting ? 'Setting up…' : 'Take me in →'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={styles.cta}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { paddingHorizontal: 22, paddingBottom: 40 },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.textDark,
    textAlign: 'center',
    marginTop: 4,
  },
  sub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 19,
  },
  field: { marginBottom: 18 },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.textDark,
    marginBottom: 8,
  },
  input: {
    // #F9F7FD — brand input bg, same as SmartInputCard; not yet a theme token
    backgroundColor: '#F9F7FD',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    fontFamily: Fonts.sansRegular,
    fontSize: 16, // 16+ defeats iOS Safari auto-zoom on web
    color: Colors.textDark,
  },
  errorText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
  },
  cta: { marginTop: 16 },
});
