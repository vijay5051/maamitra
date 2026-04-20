import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientAvatar from '../ui/GradientAvatar';
import TagPill from '../ui/TagPill';
import { ChatMessage, useChatStore } from '../../store/useChatStore';
import { Fonts } from '../../constants/theme';
import {
  detectLanguage,
  isSpeechSynthesisSupported,
  speak,
  type TTSHandle,
} from '../../services/voice';

interface ChatBubbleProps {
  message: ChatMessage;
  onSave?: (id: string) => void;
  isFirstInGroup?: boolean;
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ message, onSave, isFirstInGroup = true }: ChatBubbleProps) {
  const isAssistant = message.role === 'assistant';
  const voiceLanguage = useChatStore((s) => s.voiceLanguage);
  const [speaking, setSpeaking] = useState(false);
  const ttsRef = useRef<TTSHandle | null>(null);

  useEffect(() => {
    return () => {
      ttsRef.current?.stop();
    };
  }, []);

  const handleSpeak = () => {
    if (speaking) {
      ttsRef.current?.stop();
      ttsRef.current = null;
      setSpeaking(false);
      return;
    }
    // Prefer the language the message was actually written in (so Hindi
    // replies play in Hindi even when the user's preferred voice lang is
    // English). Fall back to the user preference.
    const detected = detectLanguage(message.content);
    const lang = detected ?? voiceLanguage;
    ttsRef.current = speak(message.content, lang) ?? null;
    if (ttsRef.current) {
      setSpeaking(true);
      // SpeechSynthesis doesn't always fire events reliably — clear the
      // speaking state on a reasonable timer. 14 chars/second is a fair
      // upper bound.
      const estMs = Math.min(60000, Math.max(3000, (message.content.length / 14) * 1000));
      setTimeout(() => setSpeaking(false), estMs + 500);
    }
  };

  const ttsSupported = isAssistant && isSpeechSynthesisSupported();

  if (!isAssistant) {
    const hasImage = !!message.imageDataUrl;
    const hasText = !!message.content?.trim();
    return (
      <View style={styles.userOuterRow}>
        <View style={styles.userWrapper}>
          {hasImage ? (
            <Image
              source={{ uri: message.imageDataUrl }}
              style={styles.userImage}
              resizeMode="cover"
            />
          ) : null}
          {hasText ? (
            <LinearGradient
              colors={['#7C3AED', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.userBubble, hasImage && { marginTop: 6 }]}
            >
              <Text style={[styles.userText, webTextStyle]}>{message.content}</Text>
            </LinearGradient>
          ) : null}
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  // Bot bubble — frosted white with rose left border strip
  const emergencyStyle = message.isEmergency
    ? { backgroundColor: '#fff5f5' }
    : {};

  return (
    <View style={styles.outerRow}>
      <View style={styles.botWrapper}>
        {isFirstInGroup ? (
          <GradientAvatar emoji="🤱" size={30} style={styles.avatar} />
        ) : (
          <View style={styles.avatarSpacer} />
        )}
        <View style={styles.botContent}>
          <View style={[styles.botBubble, emergencyStyle]}>
            {/* Rose left border strip */}
            <LinearGradient
              colors={message.isEmergency ? ['#ef4444', '#ef4444'] : ['#7C3AED', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leftBorderStrip}
            />
            <Text style={[styles.botText, webTextStyle]}>{message.content}</Text>
          </View>
          {message.tag ? (
            <TagPill
              label={message.tag.tag}
              color={message.tag.color}
              style={styles.tagPill}
            />
          ) : null}
          <View style={styles.actionRow}>
            {ttsSupported ? (
              <TouchableOpacity
                onPress={handleSpeak}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={styles.iconAction}
                accessibilityLabel={speaking ? 'Stop reading' : 'Read aloud'}
              >
                <Ionicons
                  name={speaking ? 'stop-circle' : 'volume-medium-outline'}
                  size={16}
                  color={speaking ? '#7C3AED' : '#7C3AED'}
                />
                <Text style={[styles.iconActionText, speaking && { color: '#7C3AED' }]}>
                  {speaking ? 'Stop' : 'Listen'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {onSave ? (
              <TouchableOpacity
                onPress={() => onSave(message.id)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={styles.iconAction}
              >
                <Text style={styles.saveText}>Save 🔖</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
}

// Web-specific text style to ensure long words/URLs break and wrap correctly
const webTextStyle = Platform.OS === 'web'
  ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as any)
  : {};

const styles = StyleSheet.create({
  outerRow: {
    width: '100%',
  },
  userOuterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },

  // User bubble
  userWrapper: {
    alignItems: 'flex-end',
    maxWidth: '80%',
    marginVertical: 4,
    marginRight: 12,
    minWidth: 0,
  },
  userImage: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#EDE9F6',
  },
  userBubble: {
    borderRadius: 18,
    borderTopRightRadius: 4,
    paddingVertical: 11,
    paddingHorizontal: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
    boxShadow: '0px 4px 16px rgba(28, 16, 51, 0.168)',
  },
  userText: {
    color: '#ffffff',
    fontFamily: Fonts.sansRegular,
    fontSize: 18,    // +20% from 15 — easier to read on mobile
    lineHeight: 26,
  },

  // Bot bubble
  botWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '88%',
    marginVertical: 4,
    marginLeft: 8,
    minWidth: 0,
  },
  avatar: {
    marginRight: 8,
    marginBottom: 4,
    flexShrink: 0,
  },
  avatarSpacer: {
    width: 30,
    marginRight: 8,
    flexShrink: 0,
  },
  botContent: {
    flex: 1,
    minWidth: 0,
  },
  botBubble: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(28, 16, 51, 0.06)',
    paddingVertical: 11,
    paddingHorizontal: 14,
    paddingLeft: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.06)',
    position: 'relative',
  },
  leftBorderStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 18,
  },
  botText: {
    color: '#1C1033',
    fontFamily: Fonts.sansRegular,
    fontSize: 18,    // +20% from 15
    lineHeight: 26,
  },
  tagPill: {
    marginTop: 6,
  },
  saveButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  saveText: {
    color: '#9ca3af',
    fontFamily: Fonts.sansMedium,
    fontSize: 14,    // +20% so actions don't feel tiny next to the larger body
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  iconAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconActionText: {
    color: '#7C3AED',
    fontFamily: Fonts.sansMedium,
    fontSize: 14,    // +20%
  },
  timestamp: {
    color: '#C4B5D4',
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    marginTop: 4,
    marginHorizontal: 2,
  },
});
