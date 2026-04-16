import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';

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
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ask MaaMitra anything…"
          placeholderTextColor="#C4B5D4"
          multiline
          maxLength={1000}
          editable={!disabled}
          returnKeyType="default"
          blurOnSubmit={false}
        />
        {/* Mic button */}
        <TouchableOpacity style={styles.micBtn} activeOpacity={0.7}>
          <Ionicons name="mic-outline" size={18} color="#E8487A" />
        </TouchableOpacity>
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
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232,72,122,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    alignSelf: 'flex-end',
    marginBottom: 2,
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
});
