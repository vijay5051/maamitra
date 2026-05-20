import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Radius, Spacing, withAlpha } from '../../constants/theme';

/**
 * Shows a warm warning banner when the current user hasn't verified their
 * email. Community posts, DMs, follows, and comments are blocked server-side
 * by firestore.rules until they verify, so the banner gives them a clear path
 * forward (resend mail → tap "I verified" after clicking the link).
 *
 * Renders nothing for Google sign-ins or already-verified users.
 */
export function EmailVerifyBanner() {
  const user = useAuthStore((s) => s.user);
  const resend = useAuthStore((s) => s.resendVerificationEmail);
  const refresh = useAuthStore((s) => s.refreshEmailVerified);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  if (!user || !user.email || user.emailVerified || user.isGoogleSignIn) return null;

  const handleResend = async () => {
    try {
      setSending(true);
      await resend();
      Alert.alert('Verification email sent', `Check ${user.email} — click the link, then tap "I verified" below.`);
    } catch {
      Alert.alert('Could not send', 'Please try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const handleCheck = async () => {
    try {
      setChecking(true);
      const ok = await refresh();
      if (!ok) {
        Alert.alert("Not verified yet", 'Click the link in the email we sent, then tap "I verified" again.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.banner}>
      <Ionicons name="mail-unread" size={20} color={Colors.warning} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Verify your email to post, comment, and message</Text>
        <Text style={styles.body}>We sent a link to {user.email}.</Text>
        <View style={styles.row}>
          <TouchableOpacity disabled={sending} onPress={handleResend} style={styles.btn}>
            <Text style={styles.btnText}>{sending ? 'Sending…' : 'Resend email'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={checking} onPress={handleCheck} style={[styles.btn, styles.btnPrimary]}>
            <Text style={[styles.btnText, styles.btnPrimaryText]}>{checking ? 'Checking…' : 'I verified'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // Soft warm warning fill — keep as a tinted warning surface (matches
    // the existing #fef3c7 cream-yellow look).
    backgroundColor: withAlpha(Colors.warning, 0.18),
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  title: { color: Colors.warning, fontWeight: '600', fontSize: 14, marginBottom: 2 },
  body:  { color: '#92400e', fontSize: 12, marginBottom: Spacing.sm },
  row:   { flexDirection: 'row', gap: Spacing.sm },
  btn:   {
    paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: Radius.xs,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#fcd34d',
  },
  btnPrimary: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  btnText: { color: '#92400e', fontWeight: '600', fontSize: 13 },
  btnPrimaryText: { color: Colors.white },
});
