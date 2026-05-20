import React from 'react';
import { Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

// Shared building blocks for every screen under /settings/*.
// Extracted from the legacy SettingsModal so each sub-route can render
// the same row/toggle/header look without re-implementing styles.

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger,
  avatarUri,
  showChevron = true,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  avatarUri?: string;
  showChevron?: boolean;
}) {
  const content = (
    <>
      {avatarUri ? (
        <RNImage source={{ uri: avatarUri }} style={styles.rowAvatar} />
      ) : (
        <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
          <Ionicons name={icon as any} size={18} color={danger ? '#ef4444' : Colors.primary} />
        </View>
      )}
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {onPress && showChevron && !danger ? (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

export function ToggleRow({
  label,
  sub,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.toggleRow}
      onPress={disabled ? undefined : onToggle}
      activeOpacity={0.75}
      disabled={disabled}
    >
      <View style={styles.toggleLabelWrap}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn, disabled && { opacity: 0.5 }]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.sansBold,
    color: Colors.textLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.bgTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.bgTint,
  },
  rowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.textDark,
  },
  rowLabelDanger: { color: Colors.error },
  rowValue: {
    fontSize: 13,
    fontFamily: Fonts.sansRegular,
    color: Colors.textLight,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSoft,
    marginLeft: 60,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  toggleLabelWrap: { flex: 1 },
  toggleLabel: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.textDark,
  },
  toggleSub: {
    fontSize: 12,
    fontFamily: Fonts.sansRegular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e5e7eb',
    padding: 3,
  },
  toggleTrackOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
});
