import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientAvatar from '../ui/GradientAvatar';
import { Fonts } from '../../constants/theme';
import {
  fetchPostReactors,
  CommunityPost,
  ReactorEntry,
} from '../../services/social';
import { Colors } from '../../constants/theme';

interface Props {
  visible: boolean;
  post: CommunityPost | null;
  /** If set, show only users who reacted with this specific emoji. */
  emojiFilter?: string;
  onClose: () => void;
  /** Open the profile modal for the tapped user. */
  onSelectUser: (uid: string) => void;
}

function ReactorRow({
  entry,
  onPress,
}: {
  entry: ReactorEntry;
  onPress: () => void;
}) {
  const name = entry.profile?.name || 'Unknown mom';
  const photo = entry.profile?.photoUrl;
  const subline =
    entry.profile?.bio?.trim() ||
    entry.profile?.state ||
    (entry.profile?.expertise?.length ? entry.profile.expertise.slice(0, 2).join(' · ') : '');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatar} />
      ) : (
        <GradientAvatar name={name} size={44} />
      )}
      <View style={styles.rowContent}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {subline ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subline}
          </Text>
        ) : null}
      </View>
      <Text style={styles.emojiStack}>{entry.emojis.join(' ')}</Text>
    </TouchableOpacity>
  );
}

export default function ReactorsSheet({ visible, post, emojiFilter, onClose, onSelectUser }: Props) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<ReactorEntry[]>([]);

  useEffect(() => {
    if (!visible || !post) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchPostReactors(post, emojiFilter);
        if (!cancelled) setEntries(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, post, emojiFilter]);

  const totalCount = entries.length;
  const title = emojiFilter
    ? `${emojiFilter}  ${totalCount}`
    : `Reactions · ${totalCount}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient colors={['#1C1033', '#3b1060', '#6d1a7a']} style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(e) => e.uid}
            renderItem={({ item }) => (
              <ReactorRow
                entry={item}
                onPress={() => {
                  onSelectUser(item.uid);
                  onClose();
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🌸</Text>
                <Text style={styles.emptyTitle}>No reactions yet</Text>
                <Text style={styles.emptySub}>Be the first to react to this post.</Text>
              </View>
            }
            contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: '#ffffff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 8 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: '#1a1a2e',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f0f7',
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  rowContent: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: Fonts.sansBold,
    fontSize: 15,
    color: '#1a1a2e',
  },
  sub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emojiStack: {
    fontSize: 16,
  },
});
