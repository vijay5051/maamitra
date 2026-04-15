import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientAvatar from '../ui/GradientAvatar';
import TagPill from '../ui/TagPill';
import { ChatMessage } from '../../store/useChatStore';

interface ChatBubbleProps {
  message: ChatMessage;
  onSave?: (id: string) => void;
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBubble({ message, onSave }: ChatBubbleProps) {
  const isAssistant = message.role === 'assistant';

  if (!isAssistant) {
    // User bubble — gradient, right aligned
    // outerRow is a flex ROW with justifyContent:'flex-end' so that the child maxWidth
    // is resolved as a flex-item constraint (not a block sizing problem)
    return (
      <View style={styles.userOuterRow}>
        <View style={styles.userWrapper}>
          <LinearGradient
            colors={['#ec4899', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.userBubble}
          >
            <Text style={[styles.userText, webTextStyle]}>{message.content}</Text>
          </LinearGradient>
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  // Bot bubble — white, left aligned
  const emergencyStyle = message.isEmergency
    ? { borderLeftWidth: 4, borderLeftColor: '#ef4444', backgroundColor: '#fff5f5' }
    : {};

  return (
    <View style={styles.outerRow}>
    <View style={styles.botWrapper}>
      <GradientAvatar emoji="🤱" size={32} style={styles.avatar} />
      <View style={styles.botContent}>
        <View style={[styles.botBubble, emergencyStyle]}>
          <Text style={[styles.botText, webTextStyle]}>{message.content}</Text>
        </View>
        {message.tag ? (
          <TagPill
            label={message.tag.tag}
            color={message.tag.color}
            style={styles.tagPill}
          />
        ) : null}
        {onSave ? (
          <TouchableOpacity
            onPress={() => onSave(message.id)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={styles.saveButton}
          >
            <Text style={styles.saveText}>Save 🔖</Text>
          </TouchableOpacity>
        ) : null}
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
  // Full-width outer row for bot bubble — ensures children can stretch to 100%
  outerRow: {
    width: '100%',
  },

  // Flex-row outer row for user bubble — maxWidth on flex-item resolves correctly in row context
  userOuterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },

  // User bubble
  userWrapper: {
    alignItems: 'flex-end',
    maxWidth: '82%',
    marginVertical: 4,
    marginRight: 12,
    minWidth: 0,
  },
  userBubble: {
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },

  // Bot bubble — definite width (not maxWidth) so flex:1 on botContent resolves correctly
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
  // flex: 1 is critical — tells botContent to fill the remaining row width
  // (after the avatar) so the text inside knows its constraint and can wrap
  botContent: {
    flex: 1,
    minWidth: 0,
  },
  botBubble: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.08)',
  },
  botText: {
    color: '#1a1a2e',
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 2,
  },
});
