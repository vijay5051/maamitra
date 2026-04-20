import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import TagPill from '../ui/TagPill';

export interface Scheme {
  id: string;
  emoji: string;
  name: string;
  shortDesc: string;
  description: string;
  eligibility: string;
  benefit: string;
  url: string;
}

interface SchemeCardProps {
  scheme: Scheme;
}

export default function SchemeCard({ scheme }: SchemeCardProps) {
  const handleOpen = () => {
    WebBrowser.openBrowserAsync(scheme.url);
  };

  return (
    <TouchableOpacity onPress={handleOpen} activeOpacity={0.85} style={styles.card}>
      <View style={styles.row}>
        {/* Emoji in gradient circle */}
        <LinearGradient
          colors={['#7C3AED', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emojiCircle}
        >
          <Text style={styles.emoji}>{scheme.emoji}</Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.name}>{scheme.name}</Text>
          <Text style={styles.shortDesc} numberOfLines={2}>{scheme.shortDesc}</Text>
          <TagPill label={scheme.eligibility} color="#7C3AED" style={styles.pill} />
        </View>

        {/* External link */}
        <Ionicons name="open-outline" size={18} color="#9ca3af" style={styles.linkIcon} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(28, 16, 51, 0.048)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: {
    fontSize: 22,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 3,
  },
  shortDesc: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
    marginBottom: 8,
  },
  pill: {
    alignSelf: 'flex-start',
  },
  linkIcon: {
    marginTop: 2,
  },
});
