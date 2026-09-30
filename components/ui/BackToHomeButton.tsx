import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from './AppIcon';
import { Colors, Fonts } from '../../constants/theme';

/**
 * "‹ Home" link for tab screens that are reached from Home cards but have
 * no tab-bar slot of their own (Family, Library) or are the Ask FAB's
 * root list (Chats). Goes back when there's history, otherwise to Home.
 */
export default function BackToHomeButton({ label = 'Home' }: { label?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  return (
    <TouchableOpacity
      onPress={goBack}
      style={styles.btn}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
    >
      <AppIcon name="nav.back" size={16} color={Colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 6 },
  text: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.primary },
});
