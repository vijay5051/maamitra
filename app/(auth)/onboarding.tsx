import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import { useProfileStore, calculateAgeInMonths, calculateAgeInWeeks } from '../../store/useProfileStore';
import TypingIndicator from '../../components/ui/TypingIndicator';
import GradientAvatar from '../../components/ui/GradientAvatar';
import DatePickerField from '../../components/ui/DatePickerField';
import StateSelectorComponent from '../../components/onboarding/StateSelector';
import { saveFullProfile } from '../../services/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  role: 'bot' | 'user';
  text: string;
}

// ─── BotMessage ───────────────────────────────────────────────────────────────

function BotMessage({ text }: { text: string }) {
  return (
    <View style={msgStyles.botRow}>
      <GradientAvatar emoji="🤱" size={32} style={msgStyles.avatar} />
      <View style={msgStyles.botBubble}>
        <Text style={msgStyles.botText}>{text}</Text>
      </View>
    </View>
  );
}

// ─── UserMessage ──────────────────────────────────────────────────────────────

function UserMessage({ text }: { text: string }) {
  return (
    <View style={msgStyles.userRow}>
      <LinearGradient
        colors={['#ec4899', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={msgStyles.userBubble}
      >
        <Text style={msgStyles.userText}>{text}</Text>
      </LinearGradient>
    </View>
  );
}

const msgStyles = StyleSheet.create({
  botRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginVertical: 4,
    marginLeft: 8,
    minWidth: 0,
  },
  avatar: { marginRight: 8, marginBottom: 2, flexShrink: 0 },
  botBubble: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    minWidth: 0,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.08)',
  },
  botText: { color: '#1a1a2e', fontSize: 15, lineHeight: 22 },
  userRow: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    marginVertical: 4,
    marginRight: 12,
  },
  userBubble: {
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  userText: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
});

// ─── ChipSelector ─────────────────────────────────────────────────────────────

function ChipSelector({
  options,
  onSelect,
}: {
  options: string[];
  onSelect: (val: string) => void;
}) {
  return (
    <View style={chipStyles.wrap}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={chipStyles.chip}
          onPress={() => onSelect(opt)}
          activeOpacity={0.75}
        >
          <Text style={chipStyles.chipText}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#ec4899',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
    boxShadow: '0px 2px 6px rgba(236, 72, 153, 0.08)',
  },
  chipText: { color: '#ec4899', fontSize: 14, fontWeight: '600' },
});

// StateSelector is imported from components/onboarding/StateSelector

// ─── TextInputBox ─────────────────────────────────────────────────────────────

function TextInputBox({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (val: string) => void;
}) {
  const [text, setText] = useState('');

  return (
    <View style={tiStyles.row}>
      <TextInput
        style={tiStyles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        returnKeyType="send"
        onSubmitEditing={() => {
          if (text.trim()) { onSubmit(text.trim()); setText(''); }
        }}
      />
      <TouchableOpacity
        style={tiStyles.btn}
        onPress={() => {
          if (text.trim()) { onSubmit(text.trim()); setText(''); }
        }}
        disabled={!text.trim()}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={tiStyles.btnGrad}
        >
          <Ionicons name="paper-plane" size={18} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const tiStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  btn: { alignSelf: 'flex-end' },
  btnGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[dotStyles.dot, i === current ? dotStyles.activeDot : dotStyles.inactiveDot]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activeDot: { backgroundColor: '#ec4899', width: 20 },
  inactiveDot: { backgroundColor: 'rgba(255,255,255,0.5)' },
});

// ─── Step config ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9;

const STEP_QUESTIONS = (name: string) => [
  `Hi ${name}! I'm MaaMitra, your personal companion 🤱 First, tell me — what's your current journey?`,
  `Lovely! And what's your relation to this little one? This helps me give you the most relevant support 💕`,
  `Wonderful! When is your due date or baby's birthday? 📅 Tap the calendar to pick a date.`,
  `What's your little one's name? (or "not decided yet" if you're expecting)`,
  `What is your baby's gender? 💕`,
  `Which state are you in? I'll give you location-specific advice 🇮🇳`,
  `What are your dietary preferences?`,
  `What's your family setup like?`,
  `Do you have more children?`,
];

type InputType = 'chips' | 'text' | 'states' | 'date';

const STEP_INPUT_TYPES: InputType[] = ['chips', 'chips', 'date', 'text', 'chips', 'states', 'chips', 'chips', 'chips'];

const STEP_OPTIONS: (string[] | null)[] = [
  ["I'm pregnant 🤰", 'My baby has arrived 👶', 'Planning to conceive 🌸'],
  ['Mom 👩', 'Dad 👨', 'Grandparent 👴', 'Guardian 🤝', 'Other 💙'],
  null,
  null,
  ['Boy 👦', 'Girl 👧', 'Surprise 🎁'],
  null,
  ['Vegetarian 🥦', 'Eggetarian 🥚', 'Non-Vegetarian 🍗', 'Vegan 🌱'],
  ['Nuclear family', 'Joint family', 'Living with in-laws', 'Single parent'],
  ['Yes, I have more children', 'No, this is my only one'],
];

const STEP_TEXT_PLACEHOLDERS = [
  '',
  '',
  'e.g. 12 Sep 2025',
  "Baby's name",
  '',
  '',
  '',
  '',
  '',
];

// sub-question texts for extra children
const EXTRA_KID_QUESTIONS = [
  'What stage is this child at?',
  "What's their name?",
  "What's their date of birth? 📅 Tap the calendar to pick.",
  "What's their gender? 💕",
  'Would you like to add another child?',
];

const EXTRA_KID_INPUT_TYPES: InputType[] = ['chips', 'text', 'date', 'chips', 'chips'];
const EXTRA_KID_OPTIONS: (string[] | null)[] = [
  ['Expecting 🤰', 'Born 👶'],
  null,
  null,
  ['Boy 👦', 'Girl 👧', 'Surprise 🎁'],
  ["Yes, add another", "No, that's all"],
];
const EXTRA_KID_PLACEHOLDERS = ['', "Child's name", '', '', ''];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { setMotherName, setProfile, addKid, setOnboardingComplete, onboardingComplete } = useProfileStore();

  const motherName = user?.name ?? 'Mom';

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputType, setInputType] = useState<InputType>('chips');
  const [chipOptions, setChipOptions] = useState<string[]>([]);
  const [textPlaceholder, setTextPlaceholder] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [datePickerValue, setDatePickerValue] = useState(''); // YYYY-MM-DD for current date step

  // For extra children sub-flow
  const [extraKidSubStep, setExtraKidSubStep] = useState<number | null>(null);
  const [currentExtraKid, setCurrentExtraKid] = useState<Record<string, string>>({});

  const flatListRef = useRef<FlatList>(null);
  const stepQueue = useRef<number>(0);
  // Always-current answers snapshot so extra-kid callbacks never read stale closure
  const answersRef = useRef<Record<string, string>>({});
  // Stores YYYY-MM-DD when a date step is active; handleAnswer shows display text in bubble
  // but we store the raw value in answers for reliable parsing
  const pendingDateRaw = useRef('');

  const addMsg = useCallback((msg: ChatMsg) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const showBotMessage = useCallback(
    (text: string, step: number, nextInputType: InputType, options: string[] | null, placeholder: string) => {
      setShowInput(false);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addMsg({ id: `bot-${Date.now()}`, role: 'bot', text });
        setCurrentStep(step);
        setInputType(nextInputType);
        setChipOptions(options ?? []);
        setTextPlaceholder(placeholder);
        setTimeout(() => setShowInput(true), 200);
      }, 800);
    },
    [addMsg]
  );

  // Prevent re-entry: if already onboarded, redirect to chat
  useEffect(() => {
    if (onboardingComplete) {
      router.replace('/(tabs)/');
    }
  }, [onboardingComplete]);

  // Keep answersRef in sync with answers state
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Initial greeting — also reset extraKids ref so remounts don't accumulate
  useEffect(() => {
    extraKids.current = [];
    const question = STEP_QUESTIONS(motherName)[0];
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      addMsg({ id: 'bot-0', role: 'bot', text: question });
      setCurrentStep(0);
      setInputType('chips');
      setChipOptions(STEP_OPTIONS[0] ?? []);
      setShowInput(true);
    }, 1000);
  }, []);

  const handleUserAnswer = useCallback(
    (answer: string) => {
      setShowInput(false);

      // Add user reply — for date steps, answer is the formatted display string ("12 Sep 2025")
      // but we store the raw YYYY-MM-DD from pendingDateRaw so parsing is unambiguous
      addMsg({ id: `user-${Date.now()}`, role: 'user', text: answer });

      const valueToStore = pendingDateRaw.current || answer;
      pendingDateRaw.current = '';
      const newAnswers = { ...answers, [`step${currentStep}`]: valueToStore };
      setAnswers(newAnswers);

      const nextStep = currentStep + 1;

      // When advancing to the date step (step 2), use stage-aware question text
      if (nextStep === 2 && currentStep === 1) {
        const stageAnswer = newAnswers['step0'] ?? '';
        const dateQ = stageAnswer.includes('arrived')
          ? "When was your little one born? 🎂 Tap the calendar to pick the birth date."
          : stageAnswer.includes('pregnant')
          ? "When is your due date? 📅 Tap the calendar to pick a date."
          : "What's the expected date? 📅 Tap the calendar to pick a date.";
        showBotMessage(dateQ, nextStep, STEP_INPUT_TYPES[nextStep], STEP_OPTIONS[nextStep], STEP_TEXT_PLACEHOLDERS[nextStep]);
        return;
      }

      if (currentStep === 8) {
        // "Do you have more children?"
        if (answer.startsWith('Yes')) {
          // Start extra kid sub-flow
          setExtraKidSubStep(0);
          showBotMessage(
            EXTRA_KID_QUESTIONS[0],
            currentStep,
            EXTRA_KID_INPUT_TYPES[0],
            EXTRA_KID_OPTIONS[0],
            EXTRA_KID_PLACEHOLDERS[0]
          );
        } else {
          // Done
          finishOnboarding(newAnswers, []);
        }
        return;
      }

      // After baby name step (step 3), tailor gender question based on stage
      if (currentStep === 3) {
        const stageAnswer = newAnswers['step0'] ?? '';
        // Normalize: same derivation used in finishOnboarding so the two paths can't drift
        const derivedStage = stageAnswer.includes('pregnant') ? 'pregnant'
          : stageAnswer.includes('arrived') ? 'newborn'
          : 'planning';
        const isExpecting = derivedStage === 'pregnant' || derivedStage === 'planning';
        if (isExpecting) {
          // Expecting baby — gender is a surprise; auto-skip the gender step
          const answersWithGender = { ...newAnswers, step4: 'Surprise 🎁' };
          setAnswers(answersWithGender);
          const q = STEP_QUESTIONS(motherName)[5]; // jump to state question
          showBotMessage(q, 5, STEP_INPUT_TYPES[5], STEP_OPTIONS[5], STEP_TEXT_PLACEHOLDERS[5]);
        } else {
          // Born baby — only Boy / Girl options
          const q = STEP_QUESTIONS(motherName)[4];
          showBotMessage(q, 4, 'chips', ['Boy 👦', 'Girl 👧'], '');
        }
        return;
      }

      // Advance to next step
      const q = STEP_QUESTIONS(motherName)[nextStep];
      showBotMessage(
        q,
        nextStep,
        STEP_INPUT_TYPES[nextStep],
        STEP_OPTIONS[nextStep],
        STEP_TEXT_PLACEHOLDERS[nextStep]
      );
    },
    [answers, currentStep, motherName, showBotMessage]
  );

  // Extra kid sub-flow answers
  const extraKids = useRef<Record<string, string>[]>([]);

  const handleExtraKidAnswer = useCallback(
    (answer: string, subStep: number) => {
      setShowInput(false);
      addMsg({ id: `user-ek-${Date.now()}`, role: 'user', text: answer });

      // For date sub-steps, store raw YYYY-MM-DD; answer is the formatted display string
      const valueToStore = pendingDateRaw.current || answer;
      pendingDateRaw.current = '';
      const updatedKid = { ...currentExtraKid, [`sub${subStep}`]: valueToStore };
      setCurrentExtraKid(updatedKid);

      const nextSubStep = subStep + 1;

      if (subStep === 4) {
        // "Add another?" answer
        const finalKid = { ...updatedKid, [`sub${subStep}`]: answer };
        extraKids.current = [...extraKids.current, finalKid];

        if (answer.startsWith('Yes')) {
          setCurrentExtraKid({});
          setExtraKidSubStep(0);
          showBotMessage(
            EXTRA_KID_QUESTIONS[0],
            currentStep,
            EXTRA_KID_INPUT_TYPES[0],
            EXTRA_KID_OPTIONS[0],
            EXTRA_KID_PLACEHOLDERS[0]
          );
        } else {
          // Use answersRef to avoid stale closure — answers state may lag one render behind
          finishOnboarding(answersRef.current, extraKids.current);
        }
        return;
      }

      setCurrentExtraKid(updatedKid);
      setExtraKidSubStep(nextSubStep);

      // After extra kid DOB (sub-step 2), tailor gender question based on expecting status
      if (subStep === 2) {
        const isExpecting = (updatedKid['sub0'] ?? '').includes('Expecting');
        if (isExpecting) {
          // Expecting — auto-set surprise, skip to "add another?" step
          const kidWithGender = { ...updatedKid, sub3: 'Surprise 🎁' };
          setCurrentExtraKid(kidWithGender);
          setExtraKidSubStep(4);
          showBotMessage(
            EXTRA_KID_QUESTIONS[4],
            currentStep,
            EXTRA_KID_INPUT_TYPES[4],
            EXTRA_KID_OPTIONS[4],
            EXTRA_KID_PLACEHOLDERS[4]
          );
        } else {
          // Born — show only Boy / Girl
          showBotMessage(
            EXTRA_KID_QUESTIONS[3],
            currentStep,
            'chips',
            ['Boy 👦', 'Girl 👧'],
            ''
          );
        }
        return;
      }

      showBotMessage(
        EXTRA_KID_QUESTIONS[nextSubStep],
        currentStep,
        EXTRA_KID_INPUT_TYPES[nextSubStep],
        EXTRA_KID_OPTIONS[nextSubStep],
        EXTRA_KID_PLACEHOLDERS[nextSubStep]
      );
    },
    [answers, currentExtraKid, currentStep, showBotMessage]
  );

  const finishOnboarding = useCallback(
    (finalAnswers: Record<string, string>, extraKidData: Record<string, string>[]) => {
      setShowInput(false);
      setIsTyping(true);

      setTimeout(() => {
        setIsTyping(false);
        addMsg({
          id: 'bot-final',
          role: 'bot',
          text: `Perfect! I've got everything I need, ${motherName} 💕 I'm here for you every step of this beautiful journey. Let's get started! 🌟`,
        });

        setTimeout(() => {
          // Save profile
          const stageRaw = finalAnswers['step0'] ?? '';
          const stage = stageRaw.includes('pregnant') ? 'pregnant'
            : stageRaw.includes('arrived') ? 'newborn'
            : 'planning';

          // step1 = relation to child (NEW)
          const relationRaw = finalAnswers['step1'] ?? '';
          const parentGenderVal = relationRaw.includes('Mom') ? 'mother'
            : relationRaw.includes('Dad') ? 'father'
            : 'other';
          useProfileStore.getState().setParentGender(parentGenderVal);

          const dietRaw = finalAnswers['step6'] ?? '';
          const diet = dietRaw.includes('Non-Vegetarian') ? 'non-vegetarian'
            : dietRaw.includes('Eggetarian') ? 'eggetarian'
            : dietRaw.includes('Vegan') ? 'vegan'
            : 'vegetarian';

          const familyRaw = finalAnswers['step7'] ?? '';
          const familyType = familyRaw.includes('Nuclear') ? 'nuclear'
            : familyRaw.includes('Joint') ? 'joint'
            : familyRaw.includes('in-laws') ? 'in-laws'
            : 'single-parent';

          setMotherName(motherName);
          // Validate keyDate — append T00:00:00 to prevent UTC midnight being interpreted
          // as the previous calendar day in IST (+5:30) and other eastern timezones
          const rawKeyDate = finalAnswers['step2'] ?? '';
          const parsedKeyDate = rawKeyDate ? new Date(rawKeyDate + 'T00:00:00') : null;
          const validKeyDate = parsedKeyDate && !isNaN(parsedKeyDate.getTime()) ? parsedKeyDate.toISOString() : '';

          setProfile({
            stage,
            keyDate: validKeyDate,
            state: finalAnswers['step5'] ?? '',
            diet,
            familyType,
          });

          // Add primary kid
          // Sanitise name: "not decided yet" typed verbatim should not become the stored name
          const rawKidName = (finalAnswers['step3'] ?? '').trim();
          const kidName = !rawKidName || rawKidName.toLowerCase() === 'not decided yet'
            ? 'Little one'
            : rawKidName;
          const genderRaw = finalAnswers['step4'] ?? '';
          const gender = genderRaw.includes('Boy') ? 'boy' : genderRaw.includes('Girl') ? 'girl' : 'surprise';
          const parsedDate = validKeyDate ? new Date(validKeyDate) : new Date();
          const dobStr = parsedDate.toISOString();
          // A child is only "expecting" if stage is pregnant/planning AND the date is in the future
          const dateIsInFuture = parsedDate > new Date();
          const isExpecting = (stage === 'pregnant' || stage === 'planning') && dateIsInFuture;

          addKid({
            name: kidName,
            dob: dobStr,
            // Never pass 'planning' as Kid stage — use 'pregnant' for all expecting kids
            stage: isExpecting ? 'pregnant' : 'newborn',
            gender,
            isExpecting,
          });

          // Add extra kids
          extraKidData.forEach((ekData) => {
            const ekSelectedExpecting = ekData['sub0']?.includes('Expecting') ?? false;
            const ekName = ekData['sub1'] ?? 'Sibling';
            const ekDobRaw = ekData['sub2'] ?? '';
            const ekGenderRaw = ekData['sub3'] ?? '';
            const ekGender = ekGenderRaw.includes('Boy') ? 'boy' : ekGenderRaw.includes('Girl') ? 'girl' : 'surprise';
            // Same T00:00:00 suffix to avoid UTC-offset day-shift in IST
            const ekParsed = ekDobRaw ? new Date(ekDobRaw + 'T00:00:00') : new Date();
            const ekDob = isNaN(ekParsed.getTime()) ? new Date().toISOString() : ekParsed.toISOString();
            // Only expecting if user selected Expecting AND date is in the future
            const ekDateInFuture = ekParsed > new Date();
            const ekIsExpecting = ekSelectedExpecting && ekDateInFuture;
            const ekStage = ekIsExpecting ? 'pregnant' : 'newborn';
            addKid({
              name: ekName,
              dob: ekDob,
              stage: ekStage,
              gender: ekGender,
              isExpecting: ekIsExpecting,
            });
          });

          setOnboardingComplete(true);

          // Sync full profile to Firestore for cross-device persistence
          const { user: authUser } = useAuthStore.getState();
          if (authUser?.uid) {
            const { motherName: mn, profile: pr, kids: k, completedVaccines: cv, parentGender: pg, bio: b, expertise: ex, photoUrl: ph, visibilitySettings: vs } = useProfileStore.getState();
            saveFullProfile(authUser.uid, {
              motherName: mn,
              profile: pr,
              kids: k,
              completedVaccines: cv,
              onboardingComplete: true,
              parentGender: pg,
              bio: b,
              expertise: ex,
              photoUrl: ph,
              visibilitySettings: vs,
            }).catch(console.error);
          }

          router.replace('/(tabs)/');
        }, 1500);
      }, 800);
    },
    [motherName, setMotherName, setProfile, addKid, setOnboardingComplete, router, addMsg]
  );

  // Decide which handler to use
  const handleAnswer = useCallback(
    (answer: string) => {
      if (extraKidSubStep !== null) {
        handleExtraKidAnswer(answer, extraKidSubStep);
      } else {
        handleUserAnswer(answer);
      }
    },
    [extraKidSubStep, handleExtraKidAnswer, handleUserAnswer]
  );

  // Determine current input config
  const activeInputType = extraKidSubStep !== null ? EXTRA_KID_INPUT_TYPES[extraKidSubStep] : inputType;
  const activeChipOptions = extraKidSubStep !== null ? (EXTRA_KID_OPTIONS[extraKidSubStep] ?? []) : chipOptions;
  const activeTextPlaceholder = extraKidSubStep !== null ? EXTRA_KID_PLACEHOLDERS[extraKidSubStep] : textPlaceholder;

  // During extra-kid sub-flow currentStep stays at 8; show fully-progressed dots
  const displayStep = extraKidSubStep !== null
    ? TOTAL_STEPS - 1
    : Math.min(currentStep, TOTAL_STEPS - 1);

  return (
    <View style={styles.container}>
      {/* Gradient header */}
      <LinearGradient
        colors={['#ec4899', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <GradientAvatar emoji="🤱" size={36} style={styles.headerAvatar} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>MaaMitra</Text>
            <Text style={styles.headerSubtitle}>Your personal companion</Text>
          </View>
          <ProgressDots total={TOTAL_STEPS} current={displayStep} />
        </View>
      </LinearGradient>

      {/* Chat area */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatContent}
          renderItem={({ item }) =>
            item.role === 'bot' ? (
              <BotMessage text={item.text} />
            ) : (
              <UserMessage text={item.text} />
            )
          }
          ListFooterComponent={isTyping ? <View style={styles.typingWrap}><TypingIndicator /></View> : null}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />

        {/* Input area */}
        {showInput && !isTyping && (
          <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
            {activeInputType === 'chips' && (
              <ChipSelector options={activeChipOptions} onSelect={handleAnswer} />
            )}
            {activeInputType === 'text' && (
              <TextInputBox placeholder={activeTextPlaceholder} onSubmit={handleAnswer} />
            )}
            {activeInputType === 'states' && (
              <StateSelectorComponent onSelect={handleAnswer} />
            )}
            {activeInputType === 'date' && (() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const stageAnswer = answers['step0'] ?? '';
              const isBabyArrived = stageAnswer.includes('arrived');
              const isPregnant = stageAnswer.includes('pregnant');
              // Planning users also need a future date (can't have due date in the past)
              const isPlanning = !isBabyArrived && !isPregnant;
              // For extra kid sub-step 2: check if the extra kid is born or expecting
              const ekIsBorn = currentExtraKid['sub0']?.includes('Born') ?? false;
              const ekIsExpecting = currentExtraKid['sub0']?.includes('Expecting') ?? false;
              const maxDate = extraKidSubStep === 2
                ? (ekIsBorn ? todayStr : undefined)
                : (isBabyArrived ? todayStr : undefined);
              const minDate = extraKidSubStep === 2
                ? (ekIsExpecting ? todayStr : undefined)
                // Pregnant and planning users must pick today or future
                : (isPregnant || isPlanning ? todayStr : undefined);
              return (
              <View style={styles.datePickerWrap}>
                <DatePickerField
                  value={datePickerValue}
                  onChange={setDatePickerValue}
                  placeholder="Tap to select date"
                  maxDate={maxDate}
                  minDate={minDate}
                />
                <TouchableOpacity
                  style={[styles.dateContinueBtn, !datePickerValue && styles.dateContinueBtnDisabled]}
                  disabled={!datePickerValue}
                  onPress={() => {
                    if (!datePickerValue) return;
                    // Show human-readable date in chat bubble ("12 Sep 2025")
                    // but store raw YYYY-MM-DD in answers via pendingDateRaw ref
                    const d = new Date(datePickerValue + 'T00:00:00');
                    const display = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    pendingDateRaw.current = datePickerValue; // consumed in handleUserAnswer/handleExtraKidAnswer
                    handleAnswer(display); // display string shown in user bubble
                    setDatePickerValue('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dateContinueBtnText}>
                    {datePickerValue ? 'Continue →' : 'Pick a date first'}
                  </Text>
                </TouchableOpacity>
              </View>
              );
            })()}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    shadowColor: 'transparent',
  },
  headerText: { flex: 1 },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  chatContent: {
    paddingHorizontal: 4,
    paddingVertical: 16,
  },
  typingWrap: {
    paddingLeft: 52,
    paddingVertical: 4,
  },
  inputArea: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(236,72,153,0.1)',
  },
  datePickerWrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dateContinueBtn: {
    backgroundColor: '#ec4899',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dateContinueBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  dateContinueBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
