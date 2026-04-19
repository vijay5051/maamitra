import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Fonts } from '../../constants/theme';
import { useChatStore } from '../../store/useChatStore';
import {
  INDIAN_LANGUAGES,
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  type STTHandle,
} from '../../services/voice';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  /** When set, prefills the input so the user just has to review + hit send. */
  prefill?: string;
}

export default function ChatInput({ onSend, disabled = false, prefill }: ChatInputProps) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const isSendingRef = useRef(false);
  const sttHandleRef = useRef<STTHandle | null>(null);

  const voiceLanguage = useChatStore((s) => s.voiceLanguage);
  const setVoiceLanguage = useChatStore((s) => s.setVoiceLanguage);
  const sttSupported = isSpeechRecognitionSupported();

  // Mic pulse animation while listening — expanding ring around the button.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (listening) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 120 });
    }
  }, [listening]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  // Adopt a new prefill whenever it changes (e.g. user taps a contextual Ask
  // chip on another screen and arrives here).
  useEffect(() => {
    if (prefill && prefill.trim()) setText(prefill);
  }, [prefill]);

  useEffect(() => {
    // Safety: abort any in-flight recognition when input unmounts.
    return () => {
      sttHandleRef.current?.stop();
    };
  }, []);

  const handleSend = () => {
    const trimmed = text.trim();
    if (isSendingRef.current || disabled || !trimmed) return;
    isSendingRef.current = true;
    onSend(trimmed);
    setText('');
    setTimeout(() => { isSendingRef.current = false; }, 300);
  };

  const handleMicPress = () => {
    if (listening) {
      sttHandleRef.current?.stop();
      sttHandleRef.current = null;
      setListening(false);
      return;
    }
    if (!sttSupported) {
      setVoiceError('Voice input needs a modern browser. Try Chrome or Safari on a laptop.');
      setTimeout(() => setVoiceError(null), 4000);
      return;
    }
    setVoiceError(null);
    setListening(true);
    sttHandleRef.current = startSpeechRecognition({
      languageCode: voiceLanguage,
      onInterim: (t) => setText(t),
      onFinal: (t) => {
        setText(t);
        setListening(false);
        sttHandleRef.current = null;
      },
      onError: (msg) => {
        setVoiceError(msg);
        setListening(false);
        sttHandleRef.current = null;
        setTimeout(() => setVoiceError(null), 4000);
      },
    });
    if (!sttHandleRef.current) {
      setListening(false);
    }
  };

  const canSend = text.trim().length > 0 && !disabled;
  const currentLang = INDIAN_LANGUAGES.find((l) => l.code === voiceLanguage) ?? INDIAN_LANGUAGES[0];

  return (
    <View style={styles.container}>
      {voiceError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="mic-off-outline" size={14} color="#b91c1c" />
          <Text style={styles.errorBannerText}>{voiceError}</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={listening ? 'Listening…' : 'Ask MaaMitra anything…'}
          placeholderTextColor="#C4B5D4"
          multiline
          maxLength={1000}
          editable={!disabled && !listening}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Language picker — only visible if voice is supported */}
        {sttSupported && (
          <TouchableOpacity
            style={styles.langBtn}
            activeOpacity={0.7}
            onPress={() => setLangPickerOpen(true)}
            accessibilityLabel="Change language"
          >
            <Text style={styles.langBtnText} numberOfLines={1}>
              {currentLang.code.split('-')[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mic button */}
        <View style={styles.micBtnWrap}>
          {listening ? (
            <Animated.View style={[styles.micPulse, pulseStyle]} />
          ) : null}
          <TouchableOpacity
            style={[styles.micBtn, listening && styles.micBtnActive]}
            activeOpacity={0.7}
            onPress={handleMicPress}
            accessibilityLabel={listening ? 'Stop listening' : 'Start voice input'}
          >
            <Ionicons
              name={listening ? 'stop' : 'mic-outline'}
              size={18}
              color={listening ? '#ffffff' : '#E8487A'}
            />
          </TouchableOpacity>
        </View>

        {/* Send button */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={canSend ? 0.8 : 1}
        >
          {canSend ? (
            <LinearGradient
              colors={['#E8487A', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendButton}
            >
              <Ionicons name="paper-plane" size={18} color="#ffffff" />
            </LinearGradient>
          ) : (
            <View style={[styles.sendButton, styles.sendDisabled]}>
              <Ionicons name="paper-plane" size={18} color="#C4B5D4" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Language picker modal */}
      <Modal
        visible={langPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLangPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLangPickerOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Voice language</Text>
            <Text style={styles.modalSub}>
              Picks how your speech is transcribed and how replies are read
              aloud. The AI itself will always reply in whatever language you
              type or speak.
            </Text>
            <FlatList
              data={INDIAN_LANGUAGES}
              keyExtractor={(l) => l.code}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const active = item.code === voiceLanguage;
                return (
                  <TouchableOpacity
                    style={[styles.langRow, active && styles.langRowActive]}
                    onPress={() => {
                      setVoiceLanguage(item.code);
                      setLangPickerOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.langRowNative, active && styles.langRowActiveText]}>
                        {item.native}
                      </Text>
                      <Text style={styles.langRowLabel}>{item.label}</Text>
                    </View>
                    {active && (
                      <Ionicons name="checkmark-circle" size={20} color="#E8487A" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,248,252,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(232,72,122,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  errorBannerText: {
    color: '#991b1b',
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(232,72,122,0.15)',
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    boxShadow: '0px 2px 12px rgba(232, 72, 122, 0.08)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.sansRegular,
    color: '#1C1033',
    lineHeight: 20,
    maxHeight: 120,
    paddingVertical: 4,
    marginRight: 6,
  },
  langBtn: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginRight: 6,
    marginBottom: 4,
  },
  langBtnText: {
    fontSize: 11,
    fontFamily: Fonts.sansBold,
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  micBtnWrap: {
    position: 'relative',
    alignSelf: 'flex-end',
    marginBottom: 2,
    marginRight: 6,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8487A',
  },
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232,72,122,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#E8487A',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    boxShadow: '0px 4px 12px rgba(232, 72, 122, 0.35)',
  },
  sendDisabled: {
    backgroundColor: '#F3F0F8',
    shadowColor: 'transparent',
    elevation: 0,
    boxShadow: 'none',
  },

  // Language picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,16,51,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E1EE',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: '#1C1033',
    marginBottom: 6,
  },
  modalSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FFF8FC',
  },
  langRowActive: {
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: 'rgba(232,72,122,0.25)',
  },
  langRowActiveText: {
    color: '#E8487A',
  },
  langRowNative: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: '#1C1033',
  },
  langRowLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
