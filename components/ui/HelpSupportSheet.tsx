import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Colors,
  Fonts,
  FontSize,
  Gradients,
  Radius,
  Shadow,
  Spacing,
} from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { submitSupportTicket } from '../../services/firebase';

// ─── Help & Support ────────────────────────────────────────────────────
// FAQ + contact form. Tickets land in Firestore `supportTickets` for the
// team to triage; users who prefer direct email can tap the email chip.

const SUPPORT_EMAIL = 'maamitra@gmail.com';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is my data private?',
    a: "Yes. Your chats, kids' profiles, and health info are stored under your account and only visible to you by default. Community posts respect the visibility toggles in Settings → Privacy.",
  },
  {
    q: 'Can I add multiple children?',
    a: 'Yes — go to the Family tab and tap "Add child". Each kid gets their own milestones, vaccine tracker, and age-specific tips in the Ask bar.',
  },
  {
    q: 'How accurate is the AI guidance?',
    a: 'MaaMitra aligns with IAP 2024 and FOGSI guidelines and is trained to be cautious about medical advice. For anything urgent, always consult your doctor — the AI will tell you when to do so.',
  },
  {
    q: 'Why do I see "mama" even though I\'m a dad?',
    a: 'Make sure your profile gender is set to Father in Settings → Edit Profile. The AI adapts its language — "dad", "papa", pronouns — once that field is set.',
  },
  {
    q: 'Can I delete my account?',
    a: 'Yes. Open the Profile sheet → Edit profile → scroll to Account → Delete Account. This permanently removes your data.',
  },
  {
    q: 'How do I report a post or comment?',
    a: 'Tap the three-dot menu on any post in the Connect tab to report or block. Our team reviews reports within 24 hours.',
  },
];

export default function HelpSupportSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { motherName } = useProfileStore();

  const [name, setName] = useState(motherName || user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Each time the sheet is opened, snap the ScrollView back to the top
  // and collapse any expanded FAQ. Without this, re-opening after scrolling
  // left the user mid-way down the sheet with a prior FAQ still open.
  const scrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    if (!visible) return;
    setOpenFaq(null);
    // Defer one tick so the ScrollView has mounted before we scroll.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 30);
    return () => clearTimeout(t);
  }, [visible]);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length >= 10 &&
    !submitting;

  const resetForm = () => {
    setSubject('');
    setMessage('');
    setSent(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitSupportTicket({
        uid: user?.uid ?? null,
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        platform: Platform.OS,
      });
      setSent(true);
    } catch (err: any) {
      Alert.alert(
        'Could not send',
        err?.message ??
          "We couldn't submit your message. Please email us directly at " +
            SUPPORT_EMAIL,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmail = () => {
    const body = `Hi MaaMitra team,\n\n${message || ''}\n\n— ${name || ''}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject || 'Support request',
    )}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Email unavailable',
        `Please send us a message directly at ${SUPPORT_EMAIL}.`,
      );
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kb}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <LinearGradient colors={Gradients.primary} style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Help & Support</Text>
              <View style={styles.closeBtn} />
            </LinearGradient>

            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Quick email chip */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.emailChip}
                onPress={handleEmail}
              >
                <View style={styles.emailIconWrap}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={Colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emailChipLabel}>Email us directly</Text>
                  <Text style={styles.emailChipSub}>{SUPPORT_EMAIL}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {/* FAQ */}
              <Text style={styles.sectionLabel}>FREQUENTLY ASKED</Text>
              <View style={styles.faqCard}>
                {FAQ.map((item, i) => {
                  const open = openFaq === i;
                  return (
                    <View key={i}>
                      <TouchableOpacity
                        style={styles.faqRow}
                        onPress={() => setOpenFaq(open ? null : i)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.faqQ}>{item.q}</Text>
                        <Ionicons
                          name={open ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={Colors.textMuted}
                        />
                      </TouchableOpacity>
                      {open && <Text style={styles.faqA}>{item.a}</Text>}
                      {i < FAQ.length - 1 && <View style={styles.faqDivider} />}
                    </View>
                  );
                })}
              </View>

              {/* Contact form */}
              <Text style={styles.sectionLabel}>SEND A MESSAGE</Text>
              {sent ? (
                <View style={styles.sentCard}>
                  <View style={styles.sentIconWrap}>
                    <Ionicons
                      name="checkmark-circle"
                      size={36}
                      color={Colors.success}
                    />
                  </View>
                  <Text style={styles.sentTitle}>Message sent</Text>
                  <Text style={styles.sentBody}>
                    Thanks — we typically reply within 1–2 business days. Keep
                    an eye on {email || 'your email'}.
                  </Text>
                  <TouchableOpacity
                    style={styles.sentCta}
                    onPress={resetForm}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sentCtaTxt}>Send another</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.formCard}>
                  <FormField
                    label="Your name"
                    value={name}
                    onChange={setName}
                    placeholder="e.g. Priya"
                  />
                  <FormField
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                  />
                  <FormField
                    label="Subject"
                    value={subject}
                    onChange={setSubject}
                    placeholder="What's this about?"
                  />
                  <FormField
                    label="Message"
                    value={message}
                    onChange={setMessage}
                    placeholder="Tell us what's going on (min. 10 characters)"
                    multiline
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      !canSubmit && { opacity: 0.45 },
                    ]}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={Gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitInner}
                    >
                      <Text style={styles.submitTxt}>
                        {submitting ? 'Sending…' : 'Send message'}
                      </Text>
                      {!submitting && (
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color="#fff"
                        />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.footer}>
                By contacting us you agree to our privacy practices. We'll
                never share your message with anyone outside the MaaMitra team.
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#C4B5D4"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={keyboardType !== 'email-address'}
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,16,51,0.5)',
    justifyContent: 'flex-end',
  },
  kb: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.lg,
  },

  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },

  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgPink,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  emailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailChipLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
  },
  emailChipSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },

  sectionLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },

  faqCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  faqQ: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textDark,
  },
  faqA: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textLight,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    lineHeight: 20,
  },
  faqDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },

  formCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  fieldLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.md,
    color: Colors.textDark,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMulti: {
    minHeight: 96,
    paddingTop: 12,
  },

  submitBtn: {
    marginTop: Spacing.md,
    borderRadius: Radius.full,
    overflow: 'hidden',
    ...Shadow.md,
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
  },
  submitTxt: {
    color: '#fff',
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.md,
  },

  sentCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  sentIconWrap: { marginBottom: Spacing.md },
  sentTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.lg,
    color: Colors.textDark,
    marginBottom: 6,
  },
  sentBody: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.sm,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  sentCta: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  sentCtaTxt: {
    color: Colors.primary,
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
  },

  footer: {
    fontFamily: Fonts.sansRegular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: Spacing.xxl,
    textAlign: 'center',
  },
});
