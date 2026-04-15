import React from 'react';
import {
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
    return (
      <View style={styles.userWrapper}>
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.userBubble}
        >
          <Text style={styles.userText}>{message.content}</Text>
        </LinearGradient>
        <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
      </View>
    );
  }

  // Bot bubble — white, left aligned
  const emergencyStyle = message.isEmergency
    ? { borderLeftWidth: 4, borderLeftColor: '#ef4444', backgroundColor: '#fff5f5' }
    : {};

  return (
    <View style={styles.botWrapper}>
      <GradientAvatar emoji="🤱" size={32} style={styles.avatar} />
      <View style={styles.botContent}>
        <View style={[styles.botBubble, emergencyStyle]}>
          <Text style={styles.botText}>{message.content}</Text>
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
  );
}

const styles = StyleSheet.create({
  // User bubble
  userWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '82%',
    marginVertical: 4,
    marginRight: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  userBubble: {
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
    flexWrap: 'wrap',
  },

  // Bot bubble
  botWrapper: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    maxWidth: '82%',
    marginVertical: 4,
    marginLeft: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  avatar: {
    marginRight: 8,
    marginBottom: 4,
    flexShrink: 0,
  },
  botContent: {
    flexShrink: 1,
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
    flexShrink: 1,
    minWidth: 0,
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.08)',
  },
  botText: {
    color: '#1a1a2e',
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
    flexWrap: 'wrap',
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
