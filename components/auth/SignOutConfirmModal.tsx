import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, withAlpha } from '../../constants/theme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SignOutConfirmModal({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="log-out-outline" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Sign out of MaaMitra?</Text>
          <Text style={styles.body}>
            You'll need your mobile number or Google account to come back in. Your data stays safe.
          </Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={onConfirm} accessibilityRole="button" accessibilityLabel="Sign out">
              <Text style={styles.confirmText}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha(Colors.textDark, 0.4), alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.cardBg, borderRadius: 18, padding: 22, maxWidth: 360, width: '100%' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.textDark, textAlign: 'center', marginBottom: 6 },
  body: { fontFamily: Fonts.sansRegular, fontSize: 14, color: Colors.textLight, textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textLight },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.error, alignItems: 'center' },
  confirmText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.white },
});
