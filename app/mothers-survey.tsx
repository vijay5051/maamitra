/**
 * Public mothers survey — /mothers-survey
 *
 * No sign-in. A mother answers 10 questions about her motherhood journey
 * (one per screen), optionally leaves a note and contact details, and the
 * response lands in Firestore for the admin "Mothers survey" screen.
 * The questions never mention MaaMitra — see data/mothersSurvey.ts.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '../constants/theme';
import {
  MOTHERS_SURVEY_CLOSING,
  MOTHERS_SURVEY_INTRO,
  MOTHERS_SURVEY_QUESTIONS,
  SurveyAnswers,
  SurveyQuestion,
} from '../data/mothersSurvey';
import { submitMothersSurvey } from '../services/mothersSurvey';

const DONE_KEY = 'maamitra_mothers_survey_done';
const TOTAL = MOTHERS_SURVEY_QUESTIONS.length;

type Step = 'intro' | 'questions' | 'finish' | 'done';

function alreadySubmitted(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function MothersSurveyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ src?: string; utm_source?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>(() => (alreadySubmitted() ? 'done' : 'intro'));
  const [consent, setConsent] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [comment, setComment] = useState('');
  const [wantsContact, setWantsContact] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, index]);

  const question = MOTHERS_SURVEY_QUESTIONS[index];
  const progress =
    step === 'intro' ? 0 : step === 'questions' ? index / TOTAL : 1;

  const goNext = () => {
    if (index < TOTAL - 1) setIndex(index + 1);
    else setStep('finish');
  };
  const goBack = () => {
    if (step === 'finish') setStep('questions');
    else if (index > 0) setIndex(index - 1);
    else setStep('intro');
  };

  const pick = (q: SurveyQuestion, key: string) => {
    setAnswers((prev) => {
      if (q.type === 'single') return { ...prev, [q.id]: key };
      const current = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
      const option = q.options.find((o) => o.key === key);
      let next: string[];
      if (current.includes(key)) {
        next = current.filter((k) => k !== key);
      } else if (option?.exclusive) {
        next = [key];
      } else {
        const kept = current.filter((k) => !q.options.find((o) => o.key === k)?.exclusive);
        if (q.max && kept.length >= q.max) return prev;
        next = [...kept, key];
      }
      return { ...prev, [q.id]: next };
    });
  };

  const skip = (q: SurveyQuestion) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
    goNext();
  };

  const submit = async () => {
    const cleanAnswers: SurveyAnswers = {};
    Object.entries(answers).forEach(([id, value]) => {
      if (Array.isArray(value) ? value.length > 0 : !!value) cleanAnswers[id] = value;
    });
    const digits = phone.replace(/\D/g, '');
    if (wantsContact && phone.trim() && (digits.length < 10 || digits.length > 13)) {
      setError('Please check the phone number, or leave it empty.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await submitMothersSurvey({
        answers: cleanAnswers,
        comment,
        contactConsent: wantsContact,
        name,
        phone,
        source: params.src || params.utm_source,
        platform: Platform.OS,
      });
      try {
        if (typeof window !== 'undefined') window.localStorage?.setItem(DONE_KEY, '1');
      } catch {
        /* private mode — the thank-you screen still shows for this visit */
      }
      setStep('done');
    } catch (e: any) {
      console.error('submitMothersSurvey failed:', e);
      // Only blame the connection when that is the actual cause.
      const offline = e?.code === 'unavailable' || (typeof navigator !== 'undefined' && navigator.onLine === false);
      setError(
        offline
          ? 'You seem to be offline. Please check your connection and try again.'
          : 'Sorry, we could not save your answers just now. Please try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selected = question ? answers[question.id] : undefined;
  const hasAnswer = Array.isArray(selected) ? selected.length > 0 : !!selected;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Mothers survey', headerShown: false }} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/play-store/icon-512-clean.png')} style={styles.logo} />
            <Text style={styles.brand}>MaaMitra</Text>
          </View>

          {step !== 'intro' && step !== 'done' && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}

          {step === 'intro' && (
            <View>
              <Text style={styles.h1}>{MOTHERS_SURVEY_INTRO.title}</Text>
              <Text style={styles.body}>{MOTHERS_SURVEY_INTRO.body}</Text>
              <View style={styles.noteBox}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.primary} />
                <Text style={styles.noteText}>
                  {MOTHERS_SURVEY_INTRO.privacy}{' '}
                  <Text style={styles.link} onPress={() => router.push('/privacy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.option, consent && styles.optionOn]}
                onPress={() => setConsent(!consent)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
              >
                <Mark type="multi" on={consent} />
                <Text style={[styles.optionText, consent && styles.optionTextOn]}>
                  {MOTHERS_SURVEY_INTRO.consent}
                </Text>
              </TouchableOpacity>
              <PrimaryButton label="Start the survey" disabled={!consent} onPress={() => setStep('questions')} />
            </View>
          )}

          {step === 'questions' && question && (
            <View>
              <Text style={styles.count}>
                Question {index + 1} of {TOTAL} · {question.section}
              </Text>
              <Text style={styles.h2}>{question.text}</Text>
              <Text style={styles.hint}>
                {question.type === 'single'
                  ? 'Choose one.'
                  : question.max
                    ? `Choose up to ${question.max}.`
                    : 'Choose all that apply.'}
              </Text>
              {question.options.map((o) => {
                const on = Array.isArray(selected) ? selected.includes(o.key) : selected === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => pick(question, o.key)}
                    activeOpacity={0.8}
                    accessibilityRole={question.type === 'single' ? 'radio' : 'checkbox'}
                    accessibilityState={{ checked: on }}
                  >
                    <Mark type={question.type} on={on} />
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <PrimaryButton
                label={index === TOTAL - 1 ? 'Continue' : 'Next'}
                disabled={!hasAnswer}
                onPress={goNext}
              />
              <View style={styles.navRow}>
                <TouchableOpacity onPress={goBack} style={styles.textBtn} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={16} color={Colors.textLight} />
                  <Text style={styles.textBtnLabel}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => skip(question)} style={styles.textBtn} activeOpacity={0.7}>
                  <Text style={styles.textBtnLabel}>Skip this question</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'finish' && (
            <View>
              <Text style={styles.count}>Almost done</Text>
              <Text style={styles.h2}>Anything else you would like to share about your motherhood journey?</Text>
              <Text style={styles.hint}>Optional — in your own words.</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={comment}
                onChangeText={setComment}
                placeholder="What has been hardest? What would have helped?"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={1000}
              />

              <TouchableOpacity
                style={[styles.option, wantsContact && styles.optionOn]}
                onPress={() => setWantsContact(!wantsContact)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: wantsContact }}
              >
                <Mark type="multi" on={wantsContact} />
                <Text style={[styles.optionText, wantsContact && styles.optionTextOn]}>
                  You may contact me about this survey and helpful updates for mothers (optional).
                </Text>
              </TouchableOpacity>
              {wantsContact && (
                <View>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="First name"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={60}
                  />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="WhatsApp number"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={20}
                  />
                </View>
              )}

              {!!error && <Text style={styles.error}>{error}</Text>}
              {submitting ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <PrimaryButton label="Submit my answers" onPress={submit} />
              )}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={goBack} style={styles.textBtn} activeOpacity={0.7} disabled={submitting}>
                  <Ionicons name="chevron-back" size={16} color={Colors.textLight} />
                  <Text style={styles.textBtnLabel}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'done' && (
            <View style={styles.doneWrap}>
              <View style={styles.doneIcon}>
                <Ionicons name="heart" size={34} color="#fff" />
              </View>
              <Text style={[styles.h1, { textAlign: 'center' }]}>Thank you</Text>
              <Text style={[styles.body, { textAlign: 'center' }]}>{MOTHERS_SURVEY_CLOSING}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Mark({ type, on }: { type: 'single' | 'multi'; on: boolean }) {
  return (
    <View style={[styles.mark, type === 'single' && styles.markRound, on && styles.markOn]}>
      {on && <Ionicons name="checkmark" size={14} color="#fff" />}
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.primary, disabled && styles.primaryDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { paddingHorizontal: 20, flexGrow: 1 },
  container: { width: '100%', maxWidth: 560, alignSelf: 'center' },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  logo: { width: 36, height: 36, borderRadius: 9 },
  brand: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textDark },

  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden', marginBottom: 22 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },

  h1: { fontFamily: Fonts.serif, fontSize: 30, lineHeight: 37, color: Colors.textDark, marginBottom: 12 },
  h2: { fontFamily: Fonts.serif, fontSize: 23, lineHeight: 30, color: Colors.textDark, marginBottom: 6 },
  body: { fontFamily: Fonts.sansRegular, fontSize: 16, lineHeight: 24, color: Colors.textLight, marginBottom: 16 },
  count: {
    fontFamily: Fonts.sansSemiBold, fontSize: 12, letterSpacing: 0.6,
    textTransform: 'uppercase', color: Colors.primary, marginBottom: 8,
  },
  hint: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textLight, marginBottom: 14 },

  noteBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.primarySoft, borderRadius: 14, padding: 14, marginBottom: 16,
  },
  noteText: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 14, lineHeight: 20, color: Colors.textDark },
  link: { color: Colors.primary, fontFamily: Fonts.sansSemiBold, textDecorationLine: 'underline' },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10,
  },
  optionOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  optionText: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 16, lineHeight: 22, color: Colors.textDark },
  optionTextOn: { fontFamily: Fonts.sansSemiBold },
  mark: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#C9C2D6',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  markRound: { borderRadius: 11 },
  markOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 14, marginBottom: 10,
    fontFamily: Fonts.sansRegular, fontSize: 16, color: Colors.textDark,
  },
  inputMulti: { minHeight: 120, textAlignVertical: 'top', marginBottom: 16 },

  primary: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 12,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#fff' },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  textBtnLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textLight },

  error: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.error, marginTop: 4 },

  doneWrap: { alignItems: 'center', paddingTop: 40 },
  doneIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
});
