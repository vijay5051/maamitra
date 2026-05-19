import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Colors } from '../../constants/theme';

interface Props {
  message: string | null;
}

export default function LivePreviewPill({ message }: Props) {
  if (!message) return null;
  return (
    <View style={styles.pill} accessibilityLiveRegion="polite">
      <Ionicons name="sparkles-outline" size={14} color={Colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  text: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Colors.textDark,
    lineHeight: 18,
  },
});
