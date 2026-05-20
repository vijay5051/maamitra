import { Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

// Identity card shared by the avatar sheet ("compact") and the Settings
// index screen ("expanded"). Same component, two visual densities, so a
// user feels like the two surfaces are showing the same "Me" object.

export type IdentityStripVariant = 'compact' | 'expanded';

export interface IdentityStripProps {
  name: string;
  subline?: string;
  photoUrl?: string;
  initialsFallback: string;
  variant?: IdentityStripVariant;
  /** Optional pencil button — opens the canonical Profile editor. */
  onEditPress?: () => void;
}

export function IdentityStrip({
  name,
  subline,
  photoUrl,
  initialsFallback,
  variant = 'compact',
  onEditPress,
}: IdentityStripProps) {
  const expanded = variant === 'expanded';
  const avatarSize = expanded ? 56 : 52;

  return (
    <View style={[styles.container, expanded ? styles.containerExpanded : styles.containerCompact]}>
      <View style={styles.row}>
        {photoUrl ? (
          <RNImage
            source={{ uri: photoUrl }}
            style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
            ]}
          >
            <Text style={styles.avatarFallbackTxt}>{initialsFallback.charAt(0).toUpperCase() || 'M'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={expanded ? styles.nameExpanded : styles.nameCompact} numberOfLines={1}>
            {name}
          </Text>
          {subline ? (
            <Text style={styles.subline} numberOfLines={1}>
              {subline}
            </Text>
          ) : null}
        </View>
        {onEditPress ? (
          <TouchableOpacity
            onPress={onEditPress}
            style={styles.editBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgTint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE9F6',
  },
  containerCompact: {
    padding: 14,
    marginBottom: Spacing.md,
  },
  containerExpanded: {
    padding: 16,
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  avatarFallbackTxt: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: '#ffffff',
  },
  nameCompact: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: Colors.textDark,
    letterSpacing: -0.2,
  },
  nameExpanded: {
    fontFamily: Fonts.sansBold,
    fontSize: 19,
    color: Colors.textDark,
    letterSpacing: -0.2,
  },
  subline: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E1EE',
  },
});
