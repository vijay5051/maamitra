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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientAvatar from '../ui/GradientAvatar';
import { Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocialStore } from '../../store/useSocialStore';
import { searchPublicProfiles, UserPublicProfile } from '../../services/social';
import { Colors } from '../../constants/theme';

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
  const insets = useSafeAreaInsets();
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
        {/* Light header — matches Home/Health. No gradient, no white-on-dark. */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Find people</Text>
              <Text style={styles.headerSub}>Moms & dads on MaaMitra</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Close search"
            >
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Colors.primary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoFocus
              autoCapitalize="words"
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
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
                    {/* Idle state — illustrated hero + 3-line tip list.
                        Was a single magnifier emoji + muted text; the screen
                        looked blank before typing. Tips teach users what the
                        search actually does without needing a dead-end page. */}
                    <View style={styles.emptyIconWrap}>
                      <Ionicons name="search" size={28} color={Colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>Find your people</Text>
                    <Text style={styles.emptySub}>
                      Search by first name to connect with other parents — follow,
                      chat, and swap notes from pregnancy to preschool.
                    </Text>

                    <View style={styles.tipsCard}>
                      {[
                        { icon: 'person-outline',         text: 'Try a first name — "Priya", "Rahul"' },
                        { icon: 'at-outline',             text: 'Matches parents on MaaMitra, not kids' },
                        { icon: 'shield-checkmark-outline', text: 'Only public profiles appear in results' },
                      ].map((tip) => (
                        <View key={tip.text} style={styles.tipRow}>
                          <View style={styles.tipIconWrap}>
                            <Ionicons name={tip.icon as any} size={13} color={Colors.primary} />
                          </View>
                          <Text style={styles.tipText}>{tip.text}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.emptyIconWrap}>
                      <Ionicons name="sad-outline" size={28} color={Colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No matches for &ldquo;{query}&rdquo;</Text>
                    <Text style={styles.emptySub}>
                      Check the spelling, or try a shorter prefix of the name.
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
  container: { flex: 1, backgroundColor: '#FAFAFB' },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgTint,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha12,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: Colors.textDark,
    padding: 0,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 8 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha20,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.textDark,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptySub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
  },
  tipsCard: {
    marginTop: 22,
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 12.5,
    color: Colors.textLight,
    lineHeight: 17,
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
    color: Colors.primary,
    backgroundColor: '#F5F0FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
