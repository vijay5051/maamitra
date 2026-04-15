import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[s.rowIcon, danger && s.rowIconDanger]}>
        <Ionicons name={icon as any} size={18} color={danger ? '#ef4444' : '#8b5cf6'} />
      </View>
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, danger && s.rowLabelDanger]}>{label}</Text>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
      </View>
      {onPress && !danger && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuthStore();
  const { motherName, profile, kids } = useProfileStore();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      onClose();
      await signOut();
      router.replace('/(auth)/welcome');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    // Show confirmation
    if (typeof window !== 'undefined') {
      // Web: use window.confirm
      const confirmed = window.confirm(
        'Delete account permanently?\n\nThis will delete all your data and cannot be undone.'
      );
      if (confirmed) performDelete();
    } else {
      // Native: use Alert
      Alert.alert(
        'Delete Account',
        'This will permanently delete all your data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const performDelete = async () => {
    try {
      setLoading(true);
      onClose();
      await deleteAccount();
      router.replace('/(auth)/welcome');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const initials = (motherName || user?.name || 'M').slice(0, 1).toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={['#f472b6', '#a78bfa']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.header}
        >
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Settings ⚙️</Text>
          <View style={s.closeBtn} />
        </LinearGradient>

        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile card */}
          <View style={s.profileCard}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={s.profileInfo}>
              <Text style={s.profileName}>{motherName || user?.name || 'Mom'}</Text>
              <Text style={s.profileEmail}>{user?.email || 'demo@maamitra.app'}</Text>
            </View>
          </View>

          {/* Profile & Kids */}
          <SectionHeader title="Profile" />
          <View style={s.card}>
            <SettingsRow
              icon="person-outline"
              label="Name"
              value={motherName || user?.name || '—'}
            />
            <View style={s.divider} />
            <SettingsRow
              icon="mail-outline"
              label="Email"
              value={user?.email || '—'}
            />
            {profile && (
              <>
                <View style={s.divider} />
                <SettingsRow
                  icon="location-outline"
                  label="State"
                  value={profile.state || '—'}
                />
                <View style={s.divider} />
                <SettingsRow
                  icon="restaurant-outline"
                  label="Diet"
                  value={profile.diet ? profile.diet.charAt(0).toUpperCase() + profile.diet.slice(1) : '—'}
                />
              </>
            )}
          </View>

          {/* Kids */}
          {kids.length > 0 && (
            <>
              <SectionHeader title="My Children" />
              <View style={s.card}>
                {kids.map((kid, i) => (
                  <React.Fragment key={kid.id}>
                    {i > 0 && <View style={s.divider} />}
                    <SettingsRow
                      icon={kid.isExpecting ? 'heart-outline' : 'happy-outline'}
                      label={kid.name || 'Baby'}
                      value={kid.isExpecting ? 'Expecting' : `${kid.ageInMonths}m old`}
                    />
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          {/* Account */}
          <SectionHeader title="Account" />
          <View style={s.card}>
            <SettingsRow
              icon="log-out-outline"
              label={loading ? 'Signing out…' : 'Sign Out'}
              onPress={loading ? undefined : handleSignOut}
            />
          </View>

          <View style={[s.card, s.dangerCard]}>
            <SettingsRow
              icon="trash-outline"
              label="Delete Account"
              onPress={loading ? undefined : handleDeleteAccount}
              danger
            />
          </View>

          {/* App info */}
          <Text style={s.version}>MaaMitra v1.0 · Made with 💕 in India</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  profileEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 4,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: 'rgba(239,68,68,0.15)',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  rowLabelDanger: { color: '#ef4444' },
  rowValue: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: '#f9fafb',
    marginLeft: 60,
  },

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 8,
  },
});
