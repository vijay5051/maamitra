import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import DatePickerField from '../../components/ui/DatePickerField';
import StateSelectorComponent from '../../components/onboarding/StateSelector';
import { saveFullProfile } from '../../services/firebase';
import { Fonts } from '../../constants/theme';

// ─── Domain types ─────────────────────────────────────────────────────────────

type Stage = 'pregnant' | 'newborn' | 'planning';
type Relation = 'mother' | 'father' | 'other';
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

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon as any} size={20} color="#ffffff" />
      </View>
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
  return <Text style={styles.errorText}>{msg}</Text>;
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: Array<{ value: T; label: string; icon?: string }>;
  value: T | null;
  onChange: (v: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <View style={[styles.chipGroup, columns === 2 ? { flexDirection: 'row', flexWrap: 'wrap' } : null]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.85}
            onPress={() => onChange(opt.value)}
            style={[
              columns === 2 ? styles.chipHalf : styles.chip,
              active ? styles.chipActive : null,
            ]}
          >
            {opt.icon ? <Text style={styles.chipIcon}>{opt.icon}</Text> : null}
            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{opt.label}</Text>
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
  const { setMotherName, setProfile, addKid, setOnboardingComplete, setParentGender, onboardingComplete } = useProfileStore();

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

  // Prevent re-entry: if already onboarded, redirect appropriately
  useEffect(() => {
    if (!onboardingComplete) return;
    const phone = useProfileStore.getState().phone;
    router.replace(phone ? '/(tabs)/' : '/(auth)/phone');
  }, [onboardingComplete]);

  // ── Derived copy ──
  const kidDateLabel = stage === 'pregnant' || stage === 'planning' ? 'Due date' : "Baby's date of birth";
  const kidDateHelp =
    stage === 'pregnant'
      ? 'Pick the expected due date. You can update this later.'
      : stage === 'planning'
      ? "If you don't have a date yet, pick a rough estimate — you can change it anytime."
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
      const isPrimaryExpecting = (stage === 'pregnant' || stage === 'planning') && dateIsFuture;
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

      setOnboardingComplete(true);

      const authUser = useAuthStore.getState().user;
      if (authUser?.uid) {
        const st = useProfileStore.getState();
        saveFullProfile(authUser.uid, {
          motherName: st.motherName,
          profile: st.profile,
          kids: st.kids,
          completedVaccines: st.completedVaccines,
          onboardingComplete: true,
          parentGender: st.parentGender,
          bio: st.bio,
          expertise: st.expertise,
          photoUrl: st.photoUrl,
          visibilitySettings: st.visibilitySettings,
        }).catch(console.error);
      }

      const phone = useProfileStore.getState().phone;
      router.replace(phone ? '/(tabs)/' : '/(auth)/phone');
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Progress ──
  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  // ── Render ──
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Gradient hero */}
      <LinearGradient
        colors={['#1C1033', '#3b1060', '#6d1a7a']}
        style={styles.header}
      >
        <Text style={styles.headerTop}>Step {step + 1} of {TOTAL_STEPS}</Text>
        <Text style={styles.headerTitle}>{STEPS[step]}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        {/* Step dots */}
        <View style={styles.stepDots}>
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <View key={label} style={styles.stepDotWrap}>
                <View
                  style={[
                    styles.stepDot,
                    done ? styles.stepDotDone : active ? styles.stepDotActive : null,
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  ) : (
                    <Text style={styles.stepDotText}>{i + 1}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepDotLabel,
                    active ? styles.stepDotLabelActive : null,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

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
                icon="person-outline"
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
                    { value: 'pregnant', label: "We're expecting", icon: '🤰' },
                    { value: 'newborn', label: 'My baby is here', icon: '👶' },
                    { value: 'planning', label: 'Planning to conceive', icon: '🌸' },
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
                    { value: 'mother', label: 'Mom', icon: '👩' },
                    { value: 'father', label: 'Dad', icon: '👨' },
                    { value: 'other', label: 'Other caregiver', icon: '💙' },
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
                icon="sparkles-outline"
                title="About your little one"
                subtitle="This lets us personalise milestones, feeding, vaccines, and more."
              />

              <View style={styles.field}>
                <FieldLabel optional>Baby's name</FieldLabel>
                <TextInput
                  style={styles.textInput}
                  value={kidName}
                  onChangeText={setKidName}
                  placeholder={stage === 'pregnant' || stage === 'planning' ? 'Not decided yet is fine' : "e.g. Navsa"}
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
                    { value: 'boy', label: 'Boy', icon: '👦' },
                    { value: 'girl', label: 'Girl', icon: '👧' },
                    { value: 'surprise', label: 'Surprise', icon: '🎁' },
                  ]}
                  value={kidGender}
                  onChange={(v) => {
                    setKidGender(v);
                    if (errors.kidGender) setErrors((e) => ({ ...e, kidGender: '' }));
                  }}
                />
                <InputError msg={errors.kidGender} />
              </View>
            </View>
          )}

          {/* ── Step 3: Your home ── */}
          {step === 2 && (
            <View>
              <SectionTitle
                icon="home-outline"
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
                    { value: 'vegetarian', label: 'Vegetarian', icon: '🥦' },
                    { value: 'eggetarian', label: 'Eggetarian', icon: '🥚' },
                    { value: 'non-vegetarian', label: 'Non-Veg', icon: '🍗' },
                    { value: 'vegan', label: 'Vegan', icon: '🌱' },
                  ]}
                  value={diet}
                  onChange={(v) => {
                    setDiet(v);
                    if (errors.diet) setErrors((e) => ({ ...e, diet: '' }));
                  }}
                  columns={2}
                />
                <InputError msg={errors.diet} />
              </View>

              <View style={styles.field}>
                <FieldLabel>Your family setup</FieldLabel>
                <ChipGroup<FamilyType>
                  options={[
                    { value: 'nuclear', label: 'Nuclear', icon: '🏡' },
                    { value: 'joint', label: 'Joint', icon: '👨‍👩‍👧‍👦' },
                    { value: 'in-laws', label: 'With in-laws', icon: '🏘️' },
                    { value: 'single-parent', label: 'Single parent', icon: '💪' },
                  ]}
                  value={familyType}
                  onChange={(v) => {
                    setFamilyType(v);
                    if (errors.familyType) setErrors((e) => ({ ...e, familyType: '' }));
                  }}
                  columns={2}
                />
                <InputError msg={errors.familyType} />
              </View>
            </View>
          )}

          {/* ── Step 4: More kids ── */}
          {step === 3 && (
            <View>
              <SectionTitle
                icon="people-outline"
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
                        { value: 'pregnant' as const, label: 'Expecting', icon: '🤰' },
                        { value: 'newborn' as const, label: 'Born', icon: '👶' },
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
                          { value: 'boy', label: 'Boy', icon: '👦' },
                          { value: 'girl', label: 'Girl', icon: '👧' },
                          { value: 'surprise', label: 'Surprise', icon: '🎁' },
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
                <Ionicons name="add-circle-outline" size={20} color="#7C3AED" />
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
              <Ionicons name="chevron-back" size={18} color="#7C3AED" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            onPress={handleNext}
            disabled={!canGoNext || submitting}
            activeOpacity={0.85}
            style={{ flex: 1.6, marginLeft: step > 0 ? 10 : 0 }}
          >
            <LinearGradient
              colors={['#E8487A', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.nextBtn,
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
                  size={18}
                  color="#ffffff"
                  style={{ marginLeft: 6 }}
                />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8FC' },
  flex1: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
  },
  headerTop: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: '#ffffff',
    borderRadius: 3,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  stepDotWrap: {
    flex: 1,
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: '#ffffff',
  },
  stepDotDone: {
    backgroundColor: '#22c55e',
  },
  stepDotText: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  stepDotLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  stepDotLabelActive: {
    color: '#ffffff',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },

  sectionTitleWrap: {
    marginBottom: 22,
  },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: '#1C1033',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },

  field: { marginBottom: 20 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: '#1C1033',
  },
  optional: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: '#9ca3af',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E1EE',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 14,
    fontSize: 16,
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
  errorText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
  },

  chipGroup: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E5E1EE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  chipHalf: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E5E1EE',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 8,
    width: '48%',
    marginRight: '2%',
    marginBottom: 8,
  },
  chipActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F8F3FF',
  },
  chipIcon: {
    fontSize: 18,
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#1C1033',
    flexShrink: 1,
  },
  chipTextActive: {
    color: '#7C3AED',
    fontFamily: Fonts.sansBold,
  },

  lockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF0F5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  lockNoticeText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: '#6d1a7a',
    lineHeight: 16,
  },

  // Step 4 — extra kids
  emptyExtraKids: {
    backgroundColor: '#FFF0F5',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
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
    fontSize: 15,
    color: '#1C1033',
  },
  addChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.25)',
    borderStyle: 'dashed',
    backgroundColor: '#F8F3FF',
    marginBottom: 8,
  },
  addChildBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#7C3AED',
  },
  finishHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDE9F6',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
    flex: 1,
  },
  backBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#7C3AED',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
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
