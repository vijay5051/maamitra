import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Spacing } from '../../../constants/theme';

type EmptyStateKind = 'empty' | 'loading' | 'error';

interface Props {
  kind?: EmptyStateKind;
  title: string;
  body?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: React.ReactNode;
  compact?: boolean;
}

export default function EmptyState({ kind = 'empty', title, body, icon, action, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      {kind === 'loading' ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <View style={[styles.iconRing, kind === 'error' && styles.iconRingError]}>
          <Ionicons
            name={icon ?? (kind === 'error' ? 'alert-circle-outline' : 'sparkles-outline')}
            size={22}
            color={kind === 'error' ? Colors.error : Colors.primary}
          />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <View style={{ marginTop: Spacing.md }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  compact: { paddingVertical: Spacing.lg },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  iconRingError: { backgroundColor: '#FEE2E2' },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, textAlign: 'center' },
  body: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', maxWidth: 360 },
});
