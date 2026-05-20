import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { saveFullProfile } from '../../services/firebase';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Card, Divider, SectionHeader, ToggleRow } from '../../components/settings/SettingsPrimitives';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { visibilitySettings, setVisibilitySettings } = useProfileStore();

  const handleToggle = (key: keyof typeof visibilitySettings) => {
    const updated = { ...visibilitySettings, [key]: !visibilitySettings[key] };
    setVisibilitySettings({ [key]: !visibilitySettings[key] });
    if (user?.uid) {
      const st = useProfileStore.getState();
      saveFullProfile(user.uid, {
        motherName: st.motherName,
        profile: st.profile,
        kids: st.kids,
        completedVaccines: st.completedVaccines,
        onboardingComplete: st.onboardingComplete,
        visibilitySettings: updated,
        photoUrl: st.photoUrl || '',
        parentGender: st.parentGender || '',
        bio: st.bio || '',
        expertise: st.expertise || [],
      }).catch(console.error);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Privacy" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
        <SectionHeader title="Profile visibility" subtitle="Control what other parents can see on your profile" />
        <Card>
          <ToggleRow
            label="Number of children"
            value={visibilitySettings.showKids}
            onToggle={() => handleToggle('showKids')}
          />
          <Divider />
          <ToggleRow
            label="State"
            value={visibilitySettings.showState}
            onToggle={() => handleToggle('showState')}
          />
          <Divider />
          <ToggleRow
            label="Bio"
            value={visibilitySettings.showBio}
            onToggle={() => handleToggle('showBio')}
          />
          <Divider />
          <ToggleRow
            label="Expertise tags"
            value={visibilitySettings.showExpertise}
            onToggle={() => handleToggle('showExpertise')}
          />
          <Divider />
          <ToggleRow
            label="Post count"
            value={visibilitySettings.showPostCount}
            onToggle={() => handleToggle('showPostCount')}
          />
        </Card>

        <SectionHeader title="Post visibility" subtitle="Choose who can see new posts you create" />
        <TouchableOpacity
          style={s.noteCard}
          onPress={() => handleToggle('postsFollowersOnly')}
          activeOpacity={0.75}
        >
          <View style={s.noteIcon}>
            <Ionicons name="people-outline" size={18} color={Colors.primary} />
          </View>
          <View style={s.noteContent}>
            <Text style={s.noteTitle}>Followers-only</Text>
            <Text style={s.noteText}>Limit every new post to followers only.</Text>
          </View>
          <View style={[s.toggleTrack, visibilitySettings.postsFollowersOnly && s.toggleTrackOn]}>
            <View style={[s.toggleThumb, visibilitySettings.postsFollowersOnly && s.toggleThumbOn]} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 14,
    marginBottom: 18,
  },
  noteIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.bgTint,
    alignItems: 'center', justifyContent: 'center',
  },
  noteContent: { flex: 1 },
  noteTitle: { fontSize: 15, fontFamily: Fonts.sansSemiBold, color: Colors.textDark },
  noteText: { fontSize: 12, fontFamily: Fonts.sansRegular, color: Colors.textLight, marginTop: 2, lineHeight: 16 },
  toggleTrack: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: '#e5e7eb', padding: 3,
  },
  toggleTrackOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
});
