import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import DatePickerField from '../../components/ui/DatePickerField';
import StateSelectorComponent from '../../components/onboarding/StateSelector';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

// ─── Domain types ─────────────────────────────────────────────────────────────

type Stage = 'pregnant' | 'newborn';
type Relation = 'mother' | 'father';
type Gender = 'boy' | 'girl' | 'surprise';
type Diet = 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan';
type FamilyType = 'nuclear' | 'joint' | 'in-laws' | 'single-parent';

interface ExtraKidDraft {
  stage: 'pregnant' | 'newborn';
  name: string;
  dob: string; // YYYY-MM-DD
  gender: Gender;
}

// ─── Step config ──────────────────────────────────────────────────────────────
// Four sections, each reviewable and editable before submit. Every step can
// validate on Next, surface inline errors, and jump to the problem.

const STEPS = ['You', 'Your baby', 'Your home', 'Family'] as const;
const TOTAL_STEPS = STEPS.length;

// ─── Small UI primitives ──────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelText}>{children}</Text>
      {optional ? <Text style={styles.optional}>Optional</Text> : null}
    </View>
  );
}

function InputError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={14} color="#ef4444" />
      <Text style={styles.errorText}>{msg}</Text>
    </View>
  );
}

type ChipOption<T extends string> = {
  value: T;
  label: string;
  /** Ionicon name — shown as a small, monochrome icon beside the label. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: Array<ChipOption<T>>;
  value: T | null;
  onChange: (v: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <View style={[styles.chipGroup, columns === 2 ? styles.chipGroupRow : null]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.8}
            onPress={() => onChange(opt.value)}
            style={[
              columns === 2 ? styles.chipHalf : styles.chip,
              active ? styles.chipActive : null,
            ]}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={18}
                color={active ? Colors.primary : '#6b7280'}
                style={styles.chipIcon}
              />
            ) : null}
            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{opt.label}</Text>
            {active ? (
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} style={styles.chipCheck} />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { setMotherName, setProfile, addKid, setParentGender, onboardingComplete } = useProfileStore();

  const initialName = user?.name ?? '';

  // ── Step 1: You ──
  const [name, setName] = useState(initialName);
  const [stage, setStage] = useState<Stage | null>(null);
  const [relation, setRelation] = useState<Relation | null>(null);

  // ── Step 2: Your baby ──
  const [kidName, setKidName] = useState('');
  const [keyDate, setKeyDate] = useState(''); // YYYY-MM-DD
  const [kidGender, setKidGender] = useState<Gender | null>(null);

  // ── Step 3: Your home ──
  const [state, setState] = useState('');
  const [diet, setDiet] = useState<Diet | null>(null);
  const [familyType, setFamilyType] = useState<FamilyType | null>(null);

  // ── Step 4: More children ──
  const [extraKids, setExtraKids] = useState<ExtraKidDraft[]>([]);

  // ── UX state ──
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Re-entry / signed-out guards. We deliberately use <Redirect> instead
  // of a useEffect+router.replace pair: expo-router's navigation context
  // isn't ready during a screen's first commit phase, so calling replace()
  // from a mount effect throws "Attempted to navigate before mounting the
  // Root Layout component" — which is what users were seeing as the ugly
  // red error screen on cold-load of /(auth)/onboarding. <Redirect>
  // schedules navigation safely against the layout lifecycle.
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const phoneOnFile = useProfileStore((s) => s.phone);
  if (!isAuthed) return <Redirect href="/(auth)/welcome" />;
  if (onboardingComplete) {
    return <Redirect href={phoneOnFile ? '/(tabs)' : '/(auth)/phone'} />;
  }

  // ── Derived copy ──
  const kidDateLabel = stage === 'pregnant' ? 'Due date' : "Baby's date of birth";
  const kidDateHelp =
    stage === 'pregnant'
      ? 'Pick the expected due date. You can update this later.'
      : "Pick your baby's date of birth.";

  // ── Validation ──
  const validateStep = useCallback((s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!name.trim()) e.name = 'Please tell us your name.';
      if (!stage) e.stage = 'Pick the option that best describes you right now.';
      if (!relation) e.relation = 'What is your relation to this little one?';
    }
    if (s === 1) {
      if (!keyDate) e.keyDate = 'A date helps us personalise every tip to the right week.';
      if (!kidGender) e.kidGender = 'Pick one (Surprise is fine if you want to wait).';
    }
    if (s === 2) {
      if (!state) e.state = 'Which state do you live in?';
      if (!diet) e.diet = 'Tell us what works for your household.';
      if (!familyType) e.familyType = 'Helps us suggest what actually fits your home.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [name, stage, relation, keyDate, kidGender, state, diet, familyType]);

  const canGoNext = useMemo(() => {
    if (step === 0) return !!(name.trim() && stage && relation);
    if (step === 1) return !!(keyDate && kidGender);
    if (step === 2) return !!(state && diet && familyType);
    return true;
  }, [step, name, stage, relation, keyDate, kidGender, state, diet, familyType]);

  const handleNext = () => {
    if (!validateStep(step)) return;
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const addEmptyExtraKid = () => {
    setExtraKids((prev) => [
      ...prev,
      { stage: 'newborn', name: '', dob: '', gender: 'surprise' },
    ]);
  };
  const updateExtraKid = (i: number, patch: Partial<ExtraKidDraft>) => {
    setExtraKids((prev) => prev.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));
  };
  const removeExtraKid = (i: number) => {
    setExtraKids((prev) => prev.filter((_, idx) => idx !== i));
  };

  // ── Submit ──
  const handleSubmit = async () => {
    // Re-validate everything before writing — defends against jumping back
    // in history without the step-by-step validation firing.
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      // Jump to the first failing step
      if (!name.trim() || !stage || !relation) setStep(0);
      else if (!keyDate || !kidGender) setStep(1);
      else setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      setParentGender(relation!);
      setMotherName(name.trim());

      const parsed = new Date(keyDate + 'T00:00:00');
      const validKeyDate = !isNaN(parsed.getTime()) ? parsed.toISOString() : '';
      const now = Date.now();
      const dateIsFuture = parsed.getTime() > now;

      setProfile({
        stage: stage!,
        keyDate: validKeyDate,
        state,
        diet: diet!,
        familyType: familyType!,
      });

      const cleanedName = kidName.trim();
      const primaryName = !cleanedName || cleanedName.toLowerCase() === 'not decided yet'
        ? 'Little one'
        : cleanedName;
      const isPrimaryExpecting = stage === 'pregnant' && dateIsFuture;
      addKid({
        name: primaryName,
        dob: validKeyDate,
        stage: isPrimaryExpecting ? 'pregnant' : 'newborn',
        gender: kidGender!,
        isExpecting: isPrimaryExpecting,
      });

      extraKids.forEach((ek) => {
        const ekParsed = ek.dob ? new Date(ek.dob + 'T00:00:00') : null;
        const ekIso = ekParsed && !isNaN(ekParsed.getTime()) ? ekParsed.toISOString() : new Date().toISOString();
        const ekFuture = ekParsed ? ekParsed.getTime() > now : false;
        const ekIsExpecting = ek.stage === 'pregnant' && ekFuture;
        addKid({
          name: ek.name.trim() || 'Sibling',
          dob: ekIso,
          stage: ekIsExpecting ? 'pregnant' : 'newborn',
          gender: ek.gender,
          isExpecting: ekIsExpecting,
        });
      });

      // Hand off to the dedicated setup screen, which owns the Firestore
      // write + onboardingComplete flip + retry UI. Keeping the
      // persistence step out of this submit handler means the Firestore
      // round-trip has a guaranteed UI window (a real screen) instead of
      // racing against a router.replace().
      // Cast — typed-routes hasn't regenerated yet for this brand-new file.
      (router.replace as any)('/(auth)/setup');
    } catch (err: any) {
      Alert.alert(
        'Could not continue',
        err?.message ?? 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header — clean, minimal, with stepper */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerBrand}>MaaMitra</Text>
          <Text style={styles.headerStepCount}>
            {step + 1} <Text style={styles.headerStepCountDim}>/ {TOTAL_STEPS}</Text>
          </Text>
        </View>

        {/* Step rail — thin bars with a label under the active one */}
        <View style={styles.stepRail}>
          {STEPS.map((_, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <View
                key={i}
                style={[
                  styles.stepRailBar,
                  done ? styles.stepRailBarDone : active ? styles.stepRailBarActive : null,
                ]}
              />
            );
          })}
        </View>

        <Text style={styles.headerSectionLabel}>{STEPS[step]}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 1: You ── */}
          {step === 0 && (
            <View>
              <SectionTitle
                title="Tell us about you"
                subtitle="A few quick details so every tip we give lands on your exact moment."
              />

              <View style={styles.field}>
                <FieldLabel>Your name</FieldLabel>
                <TextInput
                  style={[styles.textInput, errors.name ? styles.textInputError : null]}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    if (errors.name) setErrors((e) => ({ ...e, name: '' }));
                  }}
                  placeholder="How should we address you?"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
                <InputError msg={errors.name} />
              </View>

              <View style={styles.field}>
                <FieldLabel>Where are you right now?</FieldLabel>
                <ChipGroup<Stage>
                  options={[
                    { value: 'pregnant', label: "We're expecting", icon: 'heart-outline' },
                    { value: 'newborn', label: 'My baby is here', icon: 'happy-outline' },
                  ]}
                  value={stage}
                  onChange={(v) => {
                    setStage(v);
                    if (errors.stage) setErrors((e) => ({ ...e, stage: '' }));
                  }}
                />
                <InputError msg={errors.stage} />
              </View>

              <View style={styles.field}>
                <FieldLabel>Your relation to the baby</FieldLabel>
                <ChipGroup<Relation>
                  options={[
                    { value: 'mother', label: 'Mother', icon: 'woman-outline' },
                    { value: 'father', label: 'Father', icon: 'man-outline' },
                  ]}
                  value={relation}
                  onChange={(v) => {
                    setRelation(v);
                    if (errors.relation) setErrors((e) => ({ ...e, relation: '' }));
                  }}
                  columns={2}
                />
                {/* Role is content-defining AND locked. Making this
                    explicit now prevents a confused user from setting
                    it wrong and getting stuck in the wrong content
                    variant forever. */}
                <View style={styles.lockNotice}>
                  <Ionicons name="lock-closed-outline" size={13} color="#6d1a7a" />
                  <Text style={styles.lockNoticeText}>
                    This shapes your whole experience — content, tips, and guides — and can't be changed later. Pick carefully.
                  </Text>
                </View>
                <InputError msg={errors.relation} />
              </View>
            </View>
          )}

          {/* ── Step 2: Your baby ── */}
          {step === 1 && (
            <View>
              <SectionTitle
                title="About your little one"
                subtitle="This lets us personalise milestones, feeding, vaccines, and more."
              />

              <View style={styles.field}>
                <FieldLabel optional>Baby's name</FieldLabel>
                <TextInput
                  style={styles.textInput}
                  value={kidName}
                  onChangeText={setKidName}
                  placeholder={stage === 'pregnant' ? 'Not decided yet is fine' : "e.g. Navsa"}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <FieldLabel>{kidDateLabel}</FieldLabel>
                <DatePickerField
                  value={keyDate}
                  onChange={(v) => {
                    setKeyDate(v);
                    if (errors.keyDate) setErrors((e) => ({ ...e, keyDate: '' }));
                  }}
                />
                <Text style={styles.helpText}>{kidDateHelp}</Text>
                <InputError msg={errors.keyDate} />
              </View>

              <View style={styles.field}>
                <FieldLabel>Gender</FieldLabel>
                <ChipGroup<Gender>
                  options={[
                    { value: 'boy', label: 'Boy', icon: 'male-outline' },
                    { value: 'girl', label: 'Girl', icon: 'female-outline' },
                    { value: 'surprise', label: 'Surprise', icon: 'help-circle-outline' },
                  ]}
                  value={kidGender}
                  onChange={(v) => {
                    setKidGender(v);
                    if (errors.kidGender) setErrors((e) => ({ ...e, kidGender: '' }));
                  }}
                />
                <Text style={styles.helpText}>
                  Used only for pronouns and gender-specific health checks. Pick "Surprise" if you'd rather not share.
                </Text>
                <InputError msg={errors.kidGender} />
              </View>
            </View>
          )}

          {/* ── Step 3: Your home ── */}
          {step === 2 && (
            <View>
              <SectionTitle
                title="Your home"
                subtitle="State-specific schemes, diet-appropriate foods, and context-aware advice."
              />

              <View style={styles.field}>
                <FieldLabel>State</FieldLabel>
                <StateSelectorComponent
                  selected={state}
                  onSelect={(v: string) => {
                    setState(v);
                    if (errors.state) setErrors((e) => ({ ...e, state: '' }));
                  }}
                />
                <InputError msg={errors.state} />
              </View>

              <View style={styles.field}>
                <FieldLabel>Dietary preference</FieldLabel>
                <ChipGroup<Diet>
                  options={[
                    { value: 'vegetarian', label: 'Vegetarian', icon: 'leaf-outline' },
                    { value: 'eggetarian', label: 'Eggetarian', icon: 'ellipse-outline' },
                    { value: 'non-vegetarian', label: 'Non-vegetarian', icon: 'restaurant-outline' },
                    { value: 'vegan', label: 'Vegan', icon: 'nutrition-outline' },
                  ]}
                  value={diet}
                  onChange={(v) => {
                    setDiet(v);
                    if (errors.diet) setErrors((e) => ({ ...e, diet: '' }));
                  }}
                  columns={2}
                />
                <Text style={styles.helpText}>
                  We filter food and weaning suggestions to match. You can change this later in Profile.
                </Text>
                <InputError msg={errors.diet} />
              </View>

              <View style={styles.field}>
                <FieldLabel>Your family setup</FieldLabel>
                <ChipGroup<FamilyType>
                  options={[
                    { value: 'nuclear', label: 'Nuclear', icon: 'home-outline' },
                    { value: 'joint', label: 'Joint', icon: 'people-outline' },
                    { value: 'in-laws', label: 'With in-laws', icon: 'business-outline' },
                    { value: 'single-parent', label: 'Single parent', icon: 'person-outline' },
                  ]}
                  value={familyType}
                  onChange={(v) => {
                    setFamilyType(v);
                    if (errors.familyType) setErrors((e) => ({ ...e, familyType: '' }));
                  }}
                  columns={2}
                />
                <Text style={styles.helpText}>
                  Helps us tune tone — joint-family tips differ from nuclear ones. Never shown to other users.
                </Text>
                <InputError msg={errors.familyType} />
              </View>
            </View>
          )}

          {/* ── Step 4: More kids ── */}
          {step === 3 && (
            <View>
              <SectionTitle
                title="Any other children?"
                subtitle="Add siblings here so each has their own milestones, vaccines, and tips."
              />

              {extraKids.length === 0 ? (
                <View style={styles.emptyExtraKids}>
                  <Text style={styles.emptyExtraKidsText}>
                    No other children added yet. Tap below if you'd like to add one.
                  </Text>
                </View>
              ) : (
                extraKids.map((ek, i) => (
                  <View key={i} style={styles.extraKidCard}>
                    <View style={styles.extraKidHeader}>
                      <Text style={styles.extraKidTitle}>Child {i + 2}</Text>
                      <TouchableOpacity
                        onPress={() => removeExtraKid(i)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#9ca3af" />
                      </TouchableOpacity>
                    </View>

                    <FieldLabel>Stage</FieldLabel>
                    <ChipGroup
                      options={[
                        { value: 'pregnant' as const, label: 'Expecting', icon: 'heart-outline' },
                        { value: 'newborn' as const, label: 'Born', icon: 'happy-outline' },
                      ]}
                      value={ek.stage}
                      onChange={(v) => updateExtraKid(i, { stage: v })}
                      columns={2}
                    />

                    <View style={{ marginTop: 12 }}>
                      <FieldLabel optional>Name</FieldLabel>
                      <TextInput
                        style={styles.textInput}
                        value={ek.name}
                        onChangeText={(v) => updateExtraKid(i, { name: v })}
                        placeholder="Child's name"
                        placeholderTextColor="#9ca3af"
                        autoCapitalize="words"
                      />
                    </View>

                    <View style={{ marginTop: 12 }}>
                      <FieldLabel>{ek.stage === 'pregnant' ? 'Due date' : 'Date of birth'}</FieldLabel>
                      <DatePickerField
                        value={ek.dob}
                        onChange={(v) => updateExtraKid(i, { dob: v })}
                      />
                    </View>

                    <View style={{ marginTop: 12 }}>
                      <FieldLabel>Gender</FieldLabel>
                      <ChipGroup<Gender>
                        options={[
                          { value: 'boy', label: 'Boy', icon: 'male-outline' },
                          { value: 'girl', label: 'Girl', icon: 'female-outline' },
                          { value: 'surprise', label: 'Surprise', icon: 'help-circle-outline' },
                        ]}
                        value={ek.gender}
                        onChange={(v) => updateExtraKid(i, { gender: v })}
                      />
                    </View>
                  </View>
                ))
              )}

              <TouchableOpacity
                onPress={addEmptyExtraKid}
                activeOpacity={0.85}
                style={styles.addChildBtn}
              >
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.addChildBtnText}>
                  {extraKids.length === 0 ? 'Add another child' : 'Add one more'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.finishHint}>
                You can also add children later from the Family tab.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Bottom action bar ── */}
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          {step > 0 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.8}
              disabled={submitting}
            >
              <Ionicons name="chevron-back" size={16} color="#6b7280" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            onPress={handleNext}
            disabled={!canGoNext || submitting}
            activeOpacity={0.9}
            style={[
              styles.nextBtn,
              { flex: 1.6, marginLeft: step > 0 ? 10 : 0 },
              (!canGoNext || submitting) && styles.nextBtnDisabled,
            ]}
          >
            <Text style={styles.nextBtnText}>
              {submitting
                ? 'Saving…'
                : step === TOTAL_STEPS - 1
                ? 'Finish'
                : 'Continue'}
            </Text>
            {!submitting && (
              <Ionicons
                name={step === TOTAL_STEPS - 1 ? 'checkmark' : 'arrow-forward'}
                size={16}
                color="#ffffff"
                style={{ marginLeft: 6 }}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  flex1: { flex: 1 },

  // ── Header ──
  header: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerBrand: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: '#1C1033',
    letterSpacing: -0.2,
  },
  headerStepCount: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  headerStepCountDim: {
    fontFamily: Fonts.sansMedium,
    color: '#c4b5d6',
  },
  stepRail: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  stepRailBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#EDE9F6',
  },
  stepRailBarActive: {
    backgroundColor: Colors.primary,
  },
  stepRailBarDone: {
    backgroundColor: Colors.primary,
    opacity: 0.5,
  },
  headerSectionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: 12,
    color: '#6b7280',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 120,
  },

  // ── Section heading ──
  sectionTitleWrap: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#1C1033',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },

  // ── Field basics ──
  field: { marginBottom: 22 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#1C1033',
    letterSpacing: 0.1,
  },
  optional: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 13 : 14,
    fontSize: 15,
    fontFamily: Fonts.sansRegular,
    color: '#1C1033',
  },
  textInputError: {
    borderColor: '#ef4444',
  },
  helpText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    lineHeight: 17,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#ef4444',
  },

  // ── Chips (cleaner, no saturated fills) ──
  chipGroup: {
    gap: 8,
  },
  chipGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E1EE',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 10,
  },
  chipHalf: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E1EE',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 10,
    flexBasis: '48%',
    flexGrow: 1,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FAF7FF',
    borderWidth: 1.5,
  },
  chipIcon: {
    // spacing handled via gap
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#1C1033',
    flexShrink: 1,
    flex: 1,
  },
  chipTextActive: {
    color: '#1C1033',
    fontFamily: Fonts.sansBold,
  },
  chipCheck: {
    marginLeft: 4,
  },

  // ── Lock notice ──
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8F6FB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  lockNoticeText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 17,
  },

  // Step 4 — extra kids
  emptyExtraKids: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0EDF5',
    borderStyle: 'dashed',
  },
  emptyExtraKidsText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 19,
  },
  extraKidCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    marginBottom: 14,
  },
  extraKidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  extraKidTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#1C1033',
    letterSpacing: 0.2,
  },
  addChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    borderStyle: 'dashed',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  addChildBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: Colors.primary,
  },
  finishHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },

  // ── Action bar ──
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EDF5',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 2,
    flex: 1,
  },
  backBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#6b7280',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
