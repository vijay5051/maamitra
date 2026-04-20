import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
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
  onSend: (text: string, attachment?: { dataUrl: string; mimeType: string }) => void;
  disabled?: boolean;
  /** When set, prefills the input so the user just has to review + hit send. */
  prefill?: string;
}

/**
 * Read a File into a data URL on web. Resizes to max 1600px on the longer
 * edge and re-encodes at 0.85 JPEG quality so base64 payloads stay small
 * enough for the Anthropic API without visible quality loss. Falls back
 * to the raw FileReader result if the Image/Canvas pipeline fails.
 */
async function fileToCompressedDataURL(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });

  try {
    // Use the DOM Image constructor explicitly — `Image` at module scope
    // has been shadowed by the React Native `Image` component we import.
    const ImageCtor: any = (window as any).Image;
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const el = new ImageCtor();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image'));
      el.src = rawDataUrl;
    });
    const maxEdge = 1600;
    const longer = Math.max(img.width, img.height);
    const scale = longer > maxEdge ? maxEdge / longer : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas ctx unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    const compressed = canvas.toDataURL('image/jpeg', 0.85);
    return { dataUrl: compressed, mimeType: 'image/jpeg' };
  } catch {
    // Fall back to the raw file — still works, just heavier.
    const mime = file.type || 'image/jpeg';
    return { dataUrl: rawDataUrl, mimeType: mime };
  }
}

export default function ChatInput({ onSend, disabled = false, prefill }: ChatInputProps) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const isSendingRef = useRef(false);
  const sttHandleRef = useRef<STTHandle | null>(null);
  // Hidden <input type="file"> on web — we programmatically click it
  // from the attach button so we don't need expo-image-picker.
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    // Allow sending an image-only message (trimmed may be empty).
    if (isSendingRef.current || disabled) return;
    if (!trimmed && !attachment) return;
    isSendingRef.current = true;
    onSend(trimmed, attachment ?? undefined);
    setText('');
    setAttachment(null);
    setTimeout(() => { isSendingRef.current = false; }, 300);
  };

  const handleAttachPress = () => {
    if (Platform.OS !== 'web') {
      setVoiceError('Image upload is available on the web app — native support coming soon.');
      setTimeout(() => setVoiceError(null), 4000);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    // Reset the input so selecting the same file twice re-triggers onChange.
    if (e?.target) e.target.value = '';
    if (!file) return;
    setAttaching(true);
    try {
      const out = await fileToCompressedDataURL(file);
      setAttachment(out);
    } catch (err: any) {
      setVoiceError(err?.message ?? 'Could not load that image.');
      setTimeout(() => setVoiceError(null), 4000);
    } finally {
      setAttaching(false);
    }
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

  const canSend = (text.trim().length > 0 || !!attachment) && !disabled;
  const currentLang = INDIAN_LANGUAGES.find((l) => l.code === voiceLanguage) ?? INDIAN_LANGUAGES[0];

  return (
    <View style={styles.container}>
      {voiceError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#b91c1c" />
          <Text style={styles.errorBannerText}>{voiceError}</Text>
        </View>
      ) : null}

      {/* Attachment preview strip — shown above the input when an image
          is picked but not yet sent. Tap the × to drop it. */}
      {attachment ? (
        <View style={styles.attachmentPreview}>
          <Image source={{ uri: attachment.dataUrl }} style={styles.attachmentThumb} />
          <Text style={styles.attachmentLabel}>Photo ready to send</Text>
          <TouchableOpacity
            onPress={() => setAttachment(null)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Remove attachment"
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Hidden file input — web only. React Native Web renders any props
          we don't recognise as attributes, but the prop-level TS types
          don't know about <input>, so we splice it in via a dangerously-
          typed View-as-div below in the JSX tree. See attach button. */}
      {Platform.OS === 'web' ? (
        React.createElement('input', {
          ref: (el: HTMLInputElement | null) => { fileInputRef.current = el; },
          type: 'file',
          accept: 'image/*',
          onChange: handleFileChange,
          style: { display: 'none' },
        })
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

        {/* Attach image — web shows the file picker, native shows a hint */}
        <TouchableOpacity
          style={[styles.attachBtn, attaching && { opacity: 0.5 }]}
          activeOpacity={0.7}
          onPress={handleAttachPress}
          disabled={attaching}
          accessibilityLabel="Attach image"
        >
          <Ionicons
            name={attaching ? 'hourglass-outline' : 'image-outline'}
            size={18}
            color="#7C3AED"
          />
        </TouchableOpacity>

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
              color={listening ? '#ffffff' : '#7C3AED'}
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
              colors={['#7C3AED', '#7C3AED']}
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
            <Text style={styles.modalTitle}>Language</Text>
            <Text style={styles.modalSub}>
              MaaMitra will reply in this language and use it for voice
              input + spoken replies. Pick English to let MaaMitra
              auto-match whatever language you type.
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
                      <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />
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
    borderTopColor: 'rgba(28, 16, 51, 0.048)',
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
    borderColor: 'rgba(28, 16, 51, 0.09)',
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    boxShadow: '0px 2px 12px rgba(28, 16, 51, 0.048)',
  },
  input: {
    flex: 1,
    fontSize: 18,     // +20% from 15 — matches the bumped ChatBubble
    fontFamily: Fonts.sansRegular,
    color: '#1C1033',
    lineHeight: 24,
    maxHeight: 140,
    paddingVertical: 4,
    marginRight: 6,
  },
  attachBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginRight: 6,
    marginBottom: 2,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8F3FF',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
  },
  attachmentThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E5E1EE',
  },
  attachmentLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
    color: '#1C1033',
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
    backgroundColor: '#7C3AED',
  },
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 16, 51, 0.048)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#7C3AED',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    boxShadow: '0px 4px 12px rgba(28, 16, 51, 0.2)',
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
    backgroundColor: '#FAFAFB',
  },
  langRowActive: {
    backgroundColor: '#F5F0FF',
    borderWidth: 1,
    borderColor: 'rgba(28, 16, 51, 0.15)',
  },
  langRowActiveText: {
    color: '#7C3AED',
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
