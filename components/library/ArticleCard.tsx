import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TagPill from '../ui/TagPill';
import { Colors } from '../../constants/theme';

export interface Article {
  id: string;
  title: string;
  preview: string;
  topic: string;
  readTime: string;
  ageMin?: number;
  ageMax?: number;
  emoji: string;
  tag?: string;
}

interface ArticleCardProps {
  article: Article;
  onPress?: () => void;
}

export default function ArticleCard({ article, onPress }: ArticleCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.87}
      style={styles.card}
    >
      {/* Top emoji strip */}
      <LinearGradient
        colors={['#F5F0FF', '#F5F0FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.strip}
      >
        <View style={styles.topicPillWrap}>
          <TagPill label={article.topic} color={Colors.primary} />
        </View>
        <Text style={styles.stripEmoji}>{article.emoji}</Text>
      </LinearGradient>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {article.preview}
        </Text>
        <View style={styles.footer}>
          {article.tag ? (
            <TagPill label={article.tag} color={Colors.primary} size="sm" />
          ) : (
            <View />
          )}
          <Text style={styles.readTime}>{article.readTime}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(28, 16, 51, 0.048)',
  },
  strip: {
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  topicPillWrap: {
    position: 'absolute',
    top: 12,
    left: 14,
  },
  stripEmoji: {
    fontSize: 36,
  },
  body: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 21,
  },
  preview: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  readTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
