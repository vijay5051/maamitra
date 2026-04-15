import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientButton from '../ui/GradientButton';
import DatePickerField from '../ui/DatePickerField';
import { Kid } from '../../store/useProfileStore';

interface AddChildModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (kid: Partial<Kid>) => void;
}

type Stage = 'pregnant' | 'newborn' | 'planning';
type Gender = 'boy' | 'girl' | 'surprise';

const TOTAL_STEPS = 4;

const STAGES: Array<{ label: string; emoji: string; value: Stage }> = [
  { label: 'Pregnant', emoji: '🤰', value: 'pregnant' },
  { label: 'Baby has arrived', emoji: '👶', value: 'newborn' },
  { label: 'Planning', emoji: '🌸', value: 'planning' },
];

const GENDERS: Array<{ label: string; emoji: string; value: Gender }> = [
  { label: 'Boy', emoji: '👦', value: 'boy' },
  { label: 'Girl', emoji: '👧', value: 'girl' },
  { label: 'Surprise', emoji: '🎁', value: 'surprise' },
];

interface OptionChipProps {
  label: string;
  emoji: string;
  selected: boolean;
  onPress: () => void;
}

function OptionChip({ label, emoji, selected, onPress }: OptionChipProps) {
  if (selected) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.chipWrapper}>
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chip}
        >
          <Text style={styles.chipEmoji}>{emoji}</Text>
          <Text style={styles.chipLabelSelected}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.chipWrapper, styles.chipUnselected]}>
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AddChildModal({ visible, onClose, onAdd }: AddChildModalProps) {
  const [step, setStep] = useState(1);
  const [stage, setStage] = useState<Stage | null>(null);
  const [name, setName] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);

  const reset = () => {
    setStep(1);
    setStage(null);
    setName('');
    setDateStr('');
    setGender(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleAdd = () => {
    let parsedDate: Date | undefined;
    if (dateStr.trim()) {
      // dateStr is YYYY-MM-DD from DatePickerField
      parsedDate = new Date(dateStr.trim() + 'T00:00:00');
      if (isNaN(parsedDate.getTime())) parsedDate = undefined;
    }
    const kid: Partial<Kid> = {
      stage: stage ?? 'newborn',
      name: name.trim() || undefined,
      gender: gender ?? undefined,
      dob: parsedDate ? parsedDate.toISOString() : '',
      isExpecting: stage === 'pregnant',
    };
    onAdd(kid);
    reset();
    onClose();
  };

  const canNext = (): boolean => {
    if (step === 1) return stage !== null;
    if (step === 2) return name.trim().length > 0;
    if (step === 3) return dateStr.trim().length > 0;
    if (step === 4) return gender !== null;
    return false;
  };

  const isExpecting = stage === 'pregnant';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i + 1 <= step && styles.dotActive]}
              />
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {step === 1 && (
              <>
                <Text style={styles.stepTitle}>What's your journey? 💫</Text>
                <Text style={styles.stepSubtitle}>Tell us where you are right now</Text>
                <View style={styles.optionsGrid}>
                  {STAGES.map((s) => (
                    <OptionChip
                      key={s.value}
                      label={s.label}
                      emoji={s.emoji}
                      selected={stage === s.value}
                      onPress={() => setStage(s.value)}
                    />
                  ))}
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.stepTitle}>What's your baby's name? 💕</Text>
                <Text style={styles.stepSubtitle}>Even a nickname is perfect</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="E.g. Aarav, Priya, Little one…"
                  placeholderTextColor="#9ca3af"
                  autoFocus
                  returnKeyType="next"
                />
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.stepTitle}>
                  {isExpecting ? 'When is the due date? 📅' : 'When was the birth date? 🎂'}
                </Text>
                <Text style={styles.stepSubtitle}>Tap to open calendar</Text>
                <DatePickerField
                  value={dateStr}
                  onChange={setDateStr}
                  placeholder={isExpecting ? 'Select due date' : 'Select birth date'}
                  maxDate={isExpecting ? undefined : new Date().toISOString().slice(0, 10)}
                  minDate={isExpecting ? new Date().toISOString().slice(0, 10) : '2018-01-01'}
                />
              </>
            )}

            {step === 4 && (
              <>
                <Text style={styles.stepTitle}>Gender? 🌈</Text>
                <Text style={styles.stepSubtitle}>Or keep it a surprise!</Text>
                <View style={styles.optionsGrid}>
                  {GENDERS.map((g) => (
                    <OptionChip
                      key={g.value}
                      label={g.label}
                      emoji={g.emoji}
                      selected={gender === g.value}
                      onPress={() => setGender(g.value)}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Navigation */}
          <View style={styles.navRow}>
            {step > 1 ? (
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <View style={styles.nextWrapper}>
              {step < TOTAL_STEPS ? (
                <GradientButton
                  title="Next →"
                  onPress={handleNext}
                  disabled={!canNext()}
                  style={styles.nextBtn}
                />
              ) : (
                <GradientButton
                  title="Add to Family 💕"
                  onPress={handleAdd}
                  disabled={!canNext()}
                  style={styles.nextBtn}
                />
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  dotActive: {
    backgroundColor: '#ec4899',
    width: 20,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
    lineHeight: 20,
  },
  optionsGrid: {
    gap: 12,
  },
  chipWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
  },
  chipUnselected: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#fdf6ff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  chipEmoji: {
    fontSize: 24,
  },
  chipLabel: {
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  chipLabelSelected: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.2)',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '600',
  },
  nextWrapper: {
    flex: 2,
  },
  nextBtn: {
    width: '100%',
  },
});
