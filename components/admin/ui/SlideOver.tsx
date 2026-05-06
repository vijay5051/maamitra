import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export default function SlideOver({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenW >= 900;
  // Always cap to screenW — a caller passing e.g. width={640} on a 390px
  // phone would push 250px of the panel off the left edge of the screen
  // (the panel is right-anchored via justifyContent:'flex-end').
  const panelWidth = Math.min(
    width ?? (isWide ? Math.min(560, screenW * 0.5) : screenW),
    screenW,
  );

  return (
    <Modal visible={visible} transparent animationType={isWide ? 'slide' : 'fade'} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.panel, { width: panelWidth, height: screenH }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
          {footer ? (
            <ScrollView
              style={styles.footer}
              contentContainerStyle={styles.footerContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {footer}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'transparent' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,16,51,0.45)' },
  panel: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: Spacing.xl, gap: Spacing.lg },
  footer: {
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
    maxHeight: 220,
  },
  footerContent: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
});
