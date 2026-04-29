import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/theme';
import GradientButton from '../ui/GradientButton';
import type { MicroSurvey } from '../../lib/microSurveys';

interface Props {
  visible: boolean;
  survey: MicroSurvey | null;
  onSubmit: (answer: string, freeText: string) => Promise<void> | void;
  onDismiss: () => void;
}

export default function MicroSurveyModal({ visible, survey, onSubmit, onDismiss }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!survey) return null;

  const handleSubmit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onSubmit(selected, freeText.trim());
    } finally {
      setBusy(false);
      setSelected(null);
      setFreeText('');
    }
  };

  const handleClose = () => {
    setSelected(null);
    setFreeText('');
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconBubble}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.label}>Quick beta check-in</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={styles.question}>{survey.question}</Text>
          {survey.helper ? <Text style={styles.helper}>{survey.helper}</Text> : null}

          <View style={styles.options}>
            {survey.options.map((opt) => {
              const isSel = selected === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.85}
                  onPress={() => setSelected(opt)}
                  style={[styles.option, isSel && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, isSel && styles.optionTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {survey.freeTextLabel ? (
            <View style={styles.freeWrap}>
              <Text style={styles.freeLabel}>{survey.freeTextLabel}</Text>
              <TextInput
                value={freeText}
                onChangeText={setFreeText}
                placeholder="A sentence or two helps us a lot…"
                placeholderTextColor="#a89bbf"
                multiline
                numberOfLines={3}
                style={styles.freeInput}
              />
            </View>
          ) : null}

          <GradientButton
            title={busy ? 'Sending…' : 'Submit'}
            onPress={handleSubmit}
            disabled={!selected || busy}
            style={styles.submitBtn}
          />
          <TouchableOpacity onPress={handleClose} style={styles.skipBtn}>
            <Text style={styles.skipText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 16, 51, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    shadowColor: '#1C1033',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  question: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    color: '#1C1033',
    lineHeight: 26,
    marginBottom: 6,
  },
  helper: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
    marginBottom: 14,
  },
  options: {
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  option: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    backgroundColor: '#FAFAFB',
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F5F0FF',
  },
  optionText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: '#1C1033',
  },
  optionTextSelected: {
    color: Colors.primary,
  },
  freeWrap: {
    marginBottom: 16,
  },
  freeLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
  },
  freeInput: {
    minHeight: 70,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#1C1033',
    backgroundColor: '#FAFAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 4,
  },
  skipBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#9ca3af',
  },
});
