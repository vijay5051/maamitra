import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import JustInTimePrompt from './JustInTimePrompt';
import StateSelector from '../onboarding/StateSelector';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocialStore } from '../../store/useSocialStore';
import { saveUserProfile } from '../../services/firebase';
import { Colors, Fonts } from '../../constants/theme';

export default function StatePrompt() {
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const dismiss = useProfileStore((s) => s.dismissPrompt);
  const [open, setOpen] = useState(false);

  const visible = !!profile && !profile.state;

  const handleSelect = (v: string) => {
    if (!profile) return;
    const updated = { ...profile, state: v };
    setProfile(updated);
    dismiss('state');
    setOpen(false);
    // Persist to Firestore so the state survives app restarts. Without this
    // only AsyncStorage is updated; Firestore overwrites it on next load and
    // the prompt reappears every session.
    const uid = useAuthStore.getState().user?.uid;
    if (uid) {
      saveUserProfile(uid, { profile: updated }).catch(console.error);
      useSocialStore.getState().syncPublicProfile();
    }
  };

  return (
    <>
      <JustInTimePrompt
        promptKey="state"
        question="Which state are you in?"
        reason="So we can show you moms nearby and state-specific schemes."
        visible={visible}
      >
        <Pressable
          onPress={() => setOpen(true)}
          style={styles.openBtn}
          accessibilityRole="button"
          accessibilityLabel="Open state picker"
        >
          <Ionicons name="location-outline" size={16} color={Colors.primary} />
          <Text style={styles.openBtnText}>Tap to choose your state</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
        </Pressable>
      </JustInTimePrompt>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        accessibilityViewIsModal
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose your state</Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={Colors.textLight} />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: 16 }}>
              <StateSelector selected={profile?.state ?? ''} onSelect={handleSelect} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    minHeight: 44,
  },
  openBtnText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.textDark,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 16, 51, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    color: Colors.textDark,
  },
  sheetBody: { flex: 1 },
});
