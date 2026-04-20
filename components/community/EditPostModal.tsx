import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

const TOPICS = ['Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products', 'General'];

interface Props {
  visible: boolean;
  initialText: string;
  initialTopic: string;
  onClose: () => void;
  onSave: (updates: { text: string; topic: string }) => Promise<void> | void;
}

export default function EditPostModal({
  visible,
  initialText,
  initialTopic,
  onClose,
  onSave,
}: Props) {
  const [text, setText] = useState(initialText);
  const [topic, setTopic] = useState(initialTopic || 'General');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setTopic(initialTopic || 'General');
      setError('');
    }
  }, [visible, initialText, initialTopic]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setError('Please write at least 10 characters');
      return;
    }
    setSaving(true);
    try {
      await onSave({ text: trimmed, topic });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit post ✏️</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle-outline" size={26} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Topic</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {TOPICS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.topicChip, t === topic && styles.topicChipActive]}
                onPress={() => setTopic(t)}
                activeOpacity={0.75}
              >
                <Text style={[styles.topicChipText, t === topic && styles.topicChipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Your post</Text>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={(t) => { setText(t); setError(''); }}
            placeholder="Edit your post..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGrad}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FAFAFB',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 20, color: '#1C1033' },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 10, color: '#9CA3AF', letterSpacing: 1, marginBottom: 8 },
  topicChip: {
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginRight: 6,
    backgroundColor: '#ffffff',
  },
  topicChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(124,58,237,0.06)' },
  topicChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#9CA3AF' },
  topicChipTextActive: { fontFamily: Fonts.sansBold, color: Colors.primary },
  textArea: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: '#1C1033',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  errorText: { fontFamily: Fonts.sansRegular, color: '#ef4444', fontSize: 12, marginBottom: 8 },
  saveBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 14 },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 16 },
});
