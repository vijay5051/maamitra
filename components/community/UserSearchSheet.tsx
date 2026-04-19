import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientAvatar from '../ui/GradientAvatar';
import { Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocialStore } from '../../store/useSocialStore';
import { searchPublicProfiles, UserPublicProfile } from '../../services/social';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Open the profile modal for the tapped user. */
  onSelectUser: (uid: string) => void;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function UserRow({
  profile,
  onPress,
}: {
  profile: UserPublicProfile;
  onPress: () => void;
}) {
  const subline =
    profile.bio?.trim() ||
    (profile.expertise && profile.expertise.length > 0 ? profile.expertise.slice(0, 2).join(' · ') : '') ||
    profile.state ||
    '';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {profile.photoUrl ? (
        <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
      ) : (
        <GradientAvatar name={profile.name} size={44} />
      )}
      <View style={styles.rowContent}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.name}
        </Text>
        {subline ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subline}
          </Text>
        ) : null}
      </View>
      {profile.badge ? <Text style={styles.badge}>{profile.badge}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

export default function UserSearchSheet({ visible, onClose, onSelectUser }: Props) {
  const myUid = useAuthStore((s) => s.user?.uid) || '';
  // Exclude users I've blocked from search results.
  const blockedUids = useSocialStore((s) => s.blockedUids);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const excludeUids = useMemo(() => {
    const all = new Set<string>();
    blockedUids?.forEach((u) => all.add(u));
    if (myUid) all.add(myUid); // don't surface yourself in search
    return Array.from(all);
  }, [blockedUids, myUid]);

  // Debounce typing so we don't hammer Firestore on every keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const hits = await searchPublicProfiles(q, excludeUids);
        setResults(hits);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, excludeUids]);

  // Reset on close so reopening doesn't show stale results.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setLoading(false);
    }
  }, [visible]);

  const handlePick = (uid: string) => {
    onSelectUser(uid);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#1C1033', '#3b1060', '#6d1a7a']} style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Find people</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.searchInput}
              autoFocus
              autoCapitalize="words"
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Body */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#E8487A" />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(p) => p.uid}
            renderItem={({ item }) => <UserRow profile={item} onPress={() => handlePick(item.uid)} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                {!hasSearched ? (
                  <>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={styles.emptyTitle}>Search for moms & dads</Text>
                    <Text style={styles.emptySub}>
                      Type a name to find people on MaaMitra.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyEmoji}>🤷‍♀️</Text>
                    <Text style={styles.emptyTitle}>No matches for "{query}"</Text>
                    <Text style={styles.emptySub}>
                      Check the spelling, or try a shorter prefix.
                    </Text>
                  </>
                )}
              </View>
            }
            contentContainerStyle={results.length === 0 ? styles.emptyList : styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 8 : 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: '#ffffff',
    padding: 0,
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
  badge: {
    fontSize: 11,
    fontFamily: Fonts.sansMedium,
    color: '#8b5cf6',
    backgroundColor: '#faf5ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
