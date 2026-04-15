import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientAvatar from '../ui/GradientAvatar';
import GradientButton from '../ui/GradientButton';

interface NewPostModalProps {
  visible: boolean;
  onClose: () => void;
  onPost: (text: string, topic: string) => void;
  authorName: string;
}

const TOPICS = ['All', 'Newborn', 'Pregnancy', 'Nutrition', 'Mental Health', 'Milestones', 'Products'];
const MAX_CHARS = 500;

export default function NewPostModal({
  visible,
  onClose,
  onPost,
  authorName,
}: NewPostModalProps) {
  const [text, setText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('All');

  const handlePost = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onPost(trimmed, selectedTopic);
    setText('');
    setSelectedTopic('All');
    onClose();
  };

  const handleClose = () => {
    setText('');
    setSelectedTopic('All');
    onClose();
  };

  const canPost = text.trim().length > 0;
  const charsLeft = MAX_CHARS - text.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Post</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Author row */}
            <View style={styles.authorRow}>
              <GradientAvatar name={authorName} size={44} />
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{authorName}</Text>
                <Text style={styles.postingTo}>Posting to community 🤱</Text>
              </View>
            </View>

            {/* Text input */}
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={(t) => setText(t.slice(0, MAX_CHARS))}
              placeholder={`What's on your mind, ${authorName.split(' ')[0]}? 💭`}
              placeholderTextColor="#9ca3af"
              multiline
              autoFocus
              textAlignVertical="top"
            />

            {/* Character count */}
            <Text style={[styles.charCount, charsLeft < 50 && styles.charCountWarn]}>
              {charsLeft} characters left
            </Text>

            {/* Topic chips */}
            <Text style={styles.topicLabel}>Topic</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topicsScroll}
            >
              {TOPICS.map((topic) => {
                const isSelected = selectedTopic === topic;
                if (isSelected) {
                  return (
                    <TouchableOpacity
                      key={topic}
                      onPress={() => setSelectedTopic(topic)}
                      style={styles.topicChipWrapper}
                    >
                      <LinearGradient
                        colors={['#ec4899', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.topicChip}
                      >
                        <Text style={styles.topicChipTextSelected}>{topic}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={topic}
                    onPress={() => setSelectedTopic(topic)}
                    style={[styles.topicChipWrapper, styles.topicChipUnselected]}
                  >
                    <Text style={styles.topicChipText}>{topic}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ScrollView>

          {/* Share button */}
          <View style={styles.footer}>
            <GradientButton
              title="Share Post 🤱"
              onPress={handlePost}
              disabled={!canPost}
              style={styles.shareBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cancelBtn: {
    width: 60,
  },
  cancelText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  scrollContent: {
    padding: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  postingTo: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  textInput: {
    minHeight: 120,
    fontSize: 16,
    color: '#1a1a2e',
    lineHeight: 24,
    padding: 0,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
  },
  charCountWarn: {
    color: '#f97316',
  },
  topicLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  topicsScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  topicChipWrapper: {
    borderRadius: 999,
    overflow: 'hidden',
    marginRight: 8,
  },
  topicChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  topicChipUnselected: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  topicChipText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  topicChipTextSelected: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  shareBtn: {
    width: '100%',
  },
});
