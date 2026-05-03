import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import GradientAvatar from '../ui/GradientAvatar';
import TagPill from '../ui/TagPill';
import { ChatMessage, useChatStore } from '../../store/useChatStore';
import { Fonts } from '../../constants/theme';
import { detectLanguage } from '../../services/voice';
import { synthesizeSpeech, synthesisToDataUrl } from '../../services/cloudTts';
import { Colors } from '../../constants/theme';

/**
 * Action chips embedded by the AI in the form `[GO:Label|/path]` — see the
 * APP_MAP block in services/claude.ts. We strip them out of the rendered
 * text and render tappable buttons below the bubble that deep-link into
 * the right tab/section.
 */
interface ActionChip {
  label: string;
  path: string;
}

// Whitelist of route bases the LLM is allowed to deep-link to. Anything
// that doesn't start with one of these gets dropped at parse time so a
// fabricated /profile / /settings / /home path never reaches the
// router (where it produces an "Unmatched Route" page).
const ALLOWED_PATH_PREFIXES = [
  '/(tabs)',
  '/post/',
  '/conversation/',
];
// Common aliases the model occasionally invents → the real route.
const PATH_ALIASES: Record<string, string> = {
  '/profile': '/(tabs)?openProfile=1',
  '/settings': '/(tabs)?openSettings=1',
  '/home': '/(tabs)',
  '/family': '/(tabs)/family',
  '/health': '/(tabs)/health',
  '/wellness': '/(tabs)/wellness',
  '/library': '/(tabs)/library',
  '/community': '/(tabs)/community',
  '/chat': '/(tabs)/chat',
  '/yoga': '/(tabs)/wellness',
  '/mood': '/(tabs)/wellness?focus=mood',
  '/vaccines': '/(tabs)/health?tab=vaccines',
  '/growth': '/(tabs)/health?tab=growth',
  '/schemes': '/(tabs)/health?tab=schemes',
};

// Per-screen whitelist of query-param keys that actually do something.
// Anything else is silently dropped so we don't litter the URL bar with
// inert ?section=yoga style noise the model occasionally emits.
const ALLOWED_QUERY_KEYS_BY_PATH: Record<string, string[]> = {
  '/(tabs)': ['openProfile', 'openSettings'],
  '/(tabs)/health': ['tab'],
  '/(tabs)/wellness': ['focus'],
  '/(tabs)/library': ['tab', 'topic', 'articleId'],
  '/(tabs)/community': ['search'],
};

function filterQueryString(pathBase: string, qs: string): string {
  const allowed = ALLOWED_QUERY_KEYS_BY_PATH[pathBase];
  if (!qs) return '';
  if (!allowed) return ''; // unknown base: drop all params
  const kept: string[] = [];
  for (const pair of qs.split('&')) {
    const [k, v = ''] = pair.split('=');
    if (allowed.includes(k)) kept.push(v ? `${k}=${v}` : k);
  }
  return kept.length ? `?${kept.join('&')}` : '';
}

function normalizeChipPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return null;
  const [pathOnly, qs = ''] = trimmed.split('?');
  // Alias map first — handles bare /profile, /yoga, etc.
  if (PATH_ALIASES[pathOnly]) {
    const aliased = PATH_ALIASES[pathOnly];
    const [aliasBase, aliasQs = ''] = aliased.split('?');
    const merged = [aliasQs, qs].filter(Boolean).join('&');
    const cleanQs = filterQueryString(aliasBase, merged);
    return `${aliasBase}${cleanQs}`;
  }
  // Otherwise must start with a known prefix.
  if (!ALLOWED_PATH_PREFIXES.some((p) => trimmed.startsWith(p))) return null;
  // Drop unhandled query params on the known prefix.
  const cleanQs = filterQueryString(pathOnly, qs);
  return `${pathOnly}${cleanQs}`;
}

function parseActionChips(text: string): { stripped: string; chips: ActionChip[] } {
  // Tolerant to whitespace inside the brackets and to GO/NAV/LINK aliases
  // (the model occasionally drifts on the keyword). Both `|` and `→`
  // accepted as the label↔path separator.
  const re = /\[(?:GO|NAV|LINK|OPEN)\s*:\s*([^|→\]\n]+?)\s*(?:\||→)\s*([^\]\n]+?)\s*\]/gi;
  const chips: ActionChip[] = [];
  const seen = new Set<string>();
  const stripped = text
    .replace(re, (_match, rawLabel: string, rawPath: string) => {
      const label = rawLabel.trim();
      const path = normalizeChipPath(rawPath);
      // Defence: drop chips that don't resolve to a known route — better
      // to silently skip than to ship the user to "Unmatched Route".
      if (!label || !path) return '';
      // De-dupe — sometimes the model emits the same chip twice.
      const key = `${label}::${path}`;
      if (seen.has(key)) return '';
      seen.add(key);
      if (chips.length < 3) chips.push({ label, path });
      return '';
    })
    // Collapse the blank lines that the chip removal leaves behind.
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { stripped, chips };
}

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
  const router = useRouter();
  const voiceLanguage = useChatStore((s) => s.voiceLanguage);
  const [speaking, setSpeaking] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // Pull `[GO:Label|/path]` action tokens out of assistant messages so we
  // can render tappable deep-link chips (and not show the raw token).
  const { stripped: displayText, chips: actionChips } = useMemo(
    () =>
      isAssistant
        ? parseActionChips(message.content || '')
        : { stripped: message.content || '', chips: [] as ActionChip[] },
    [isAssistant, message.content],
  );
  // Player ref kept loose-typed because expo-audio has slightly different
  // shapes on web vs native; we only ever call .pause() / .release().
  const playerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      try { playerRef.current?.pause?.(); } catch {}
      try { playerRef.current?.release?.(); } catch {}
      playerRef.current = null;
    };
  }, []);

  const handleSpeak = async () => {
    if (speaking) {
      try { playerRef.current?.pause?.(); } catch {}
      try { playerRef.current?.release?.(); } catch {}
      playerRef.current = null;
      setSpeaking(false);
      return;
    }
    if (loadingAudio) return;
    setLoadingAudio(true);
    try {
      // Prefer the language the message was actually written in (so Hindi
      // replies play in Hindi even when the user's preferred voice lang
      // is English). Fall back to the user preference, then en-IN.
      // Use the chip-stripped text — we don't want the TTS to read out
      // "[GO: open vaccine tracker / tabs / health …]" tokens.
      const speakText = displayText || message.content;
      const detected = detectLanguage(speakText);
      const lang = detected ?? voiceLanguage ?? 'en-IN';
      const audio = await synthesizeSpeech(speakText, lang);
      const uri = synthesisToDataUrl(audio);
      const expoAudio = await import('expo-audio');
      const player = expoAudio.createAudioPlayer({ uri });
      playerRef.current = player;
      // Listen for playback finish so we flip the icon back to "Listen".
      try {
        player.addListener?.('playbackStatusUpdate', (status: any) => {
          if (status?.didJustFinish || status?.isLoaded === false) {
            setSpeaking(false);
            try { player.release?.(); } catch {}
            playerRef.current = null;
          }
        });
      } catch {}
      setSpeaking(true);
      player.play();
    } catch (err: any) {
      console.warn('cloud tts failed:', err);
      setSpeaking(false);
    } finally {
      setLoadingAudio(false);
    }
  };

  // Cloud TTS works on every platform we ship (web, iOS, Android) — no
  // device support gating like the old expo-speech path needed.
  const ttsSupported = isAssistant;

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
              colors={[Colors.primary, Colors.primary]}
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
              colors={message.isEmergency ? ['#ef4444', '#ef4444'] : [Colors.primary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.leftBorderStrip}
            />
            <Text style={[styles.botText, webTextStyle]}>{displayText}</Text>
          </View>
          {actionChips.length > 0 ? (
            <View style={styles.actionChipsRow}>
              {actionChips.map((chip, i) => (
                <TouchableOpacity
                  key={`${chip.path}-${i}`}
                  style={styles.actionChip}
                  onPress={() => {
                    try {
                      router.push(chip.path as any);
                    } catch (err) {
                      // Navigation failed — fall back to the home tab
                      // so the user lands somewhere usable, never on
                      // an Unmatched-Route screen.
                      console.warn('[chat] action chip nav failed:', chip.path, err);
                      try {
                        router.push('/(tabs)' as any);
                      } catch {}
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-forward-circle" size={14} color="#fff" />
                  <Text style={styles.actionChipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
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
                disabled={loadingAudio}
              >
                <Ionicons
                  name={
                    loadingAudio
                      ? 'hourglass-outline'
                      : speaking
                        ? 'stop-circle'
                        : 'volume-medium-outline'
                  }
                  size={16}
                  color={Colors.primary}
                />
                <Text style={[styles.iconActionText, speaking && { color: Colors.primary }]}>
                  {loadingAudio ? 'Loading…' : speaking ? 'Stop' : 'Listen'}
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
    shadowColor: Colors.primary,
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
  actionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 2,
    maxWidth: '100%',
  },
  actionChipText: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    fontWeight: '700' as any,
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
    color: Colors.primary,
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
