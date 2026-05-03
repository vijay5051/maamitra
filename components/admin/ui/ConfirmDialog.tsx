import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  body?: string;
  /** Require typing this string before the confirm button enables. */
  requireType?: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  visible,
  title,
  body,
  requireType,
  destructive,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = !!requireType && typed.trim() !== requireType;

  async function handle() {
    if (blocked || busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); setTyped(''); }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconRing, destructive && styles.iconRingDanger]}>
            <Ionicons
              name={destructive ? 'warning-outline' : 'help-circle-outline'}
              size={22}
              color={destructive ? Colors.error : Colors.primary}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          {requireType ? (
            <View style={styles.typeWrap}>
              <Text style={styles.typeHint}>
                Type <Text style={styles.typeHintBold}>{requireType}</Text> to confirm
              </Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                style={styles.typeInput}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          ) : null}
          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onCancel}>
              <Text style={styles.btnSecondaryText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                destructive ? styles.btnDanger : styles.btnPrimary,
                (blocked || busy) && { opacity: 0.5 },
              ]}
              onPress={handle}
              disabled={blocked || busy}
            >
              <Text style={styles.btnPrimaryText}>{busy ? 'Working…' : confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(28,16,51,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 440,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.lg,
  },
  iconRing: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  iconRingDanger: { backgroundColor: '#FEE2E2' },
  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  body: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 20 },
  typeWrap: { gap: 6 },
  typeHint: { fontSize: FontSize.xs, color: Colors.textLight },
  typeHintBold: { fontWeight: '800', color: Colors.textDark },
  typeInput: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    backgroundColor: Colors.bgLight,
  },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center' },
  btnSecondary: { backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border },
  btnSecondaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  btnDanger: { backgroundColor: Colors.error },
});
