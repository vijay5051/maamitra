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
  const panelWidth = width ?? (isWide ? Math.min(560, screenW * 0.5) : screenW);

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
          {footer ? <View style={styles.footer}>{footer}</View> : null}
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
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
    flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end',
  },
});
