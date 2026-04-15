import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Ask MaaMitra anything…"
        placeholderTextColor="#9ca3af"
        multiline
        maxLength={1000}
        editable={!disabled}
        returnKeyType="default"
        blurOnSubmit={false}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={canSend ? 0.8 : 1}
        style={styles.sendWrapper}
      >
        {canSend ? (
          <LinearGradient
            colors={['#ec4899', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendButton}
          >
            <Ionicons name="paper-plane" size={20} color="#ffffff" />
          </LinearGradient>
        ) : (
          <View style={[styles.sendButton, styles.sendDisabled]}>
            <Ionicons name="paper-plane" size={20} color="#9ca3af" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(236,72,153,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#fdf6ff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1a1a2e',
    lineHeight: 20,
    maxHeight: 120,
    marginRight: 8,
  },
  sendWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: '#f3f4f6',
  },
});
