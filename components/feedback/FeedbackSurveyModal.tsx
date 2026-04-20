/**
 * FeedbackSurveyModal — one-screen tester survey.
 *
 * Design rule: minimum clicks. Everything is tap-to-select (chips /
 * stars / single-choice pills). Only one optional free-text field.
 * Typical completion is 5-7 taps + Submit.
 *
 * Surfaces: (1) auto-prompted from app/_layout.tsx after N days of use,
 * (2) manually from Home → "Share feedback" and admin Settings → same.
 *
 * Writes to Firestore `testerFeedback` collection. Read back in
 * app/admin/feedback.tsx.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Colors, Fonts, Radius, Shadow, Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useFeedbackStore } from '../../store/useFeedbackStore';
import { submitTesterFeedback } from '../../services/firebase';

// Tag sets kept short — long lists make people freeze. Tied directly
// to the feature inventory so loved/frustrated map to real product
// areas when we analyse responses.
const LOVED_TAGS = [
  'AI chat',
  'Vaccine tracker',
  'Growth tracker',
  'Teeth tracker',
  'Food tracker',
  'Community',
  'Wellness / mood',
  'Govt. schemes',
  'Library',
  'Design & feel',
];

const FRUSTRATED_TAGS = [
  'Too slow',
  'Confusing UI',
  'AI answers',
  'Not enough content',
  'Crashes / bugs',
  'Notifications',
  'Community quality',
  'Nothing really',
];

type PriceBand = 'free-only' | '<999' | '999-1499' | '1499-1999' | '1999-2499' | '2499+';
type PayChoice = 'yes' | 'maybe' | 'no';

const PRICE_OPTIONS: { key: PriceBand; label: string }[] = [
  { key: 'free-only',  label: 'Only if free' },
  { key: '<999',       label: 'Under ₹999' },
  { key: '999-1499',   label: '₹999 – ₹1,499' },
  { key: '1499-1999',  label: '₹1,499 – ₹1,999' },
  { key: '1999-2499',  label: '₹1,999 – ₹2,499' },
  { key: '2499+',      label: '₹2,499+' },
];

const PAY_OPTIONS: { key: PayChoice; label: string; tint: string }[] = [
  { key: 'yes',   label: 'Yes',       tint: '#10B981' },
  { key: 'maybe', label: 'Maybe',     tint: '#F59E0B' },
  { key: 'no',   label: 'Not today',  tint: '#EF4444' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function FeedbackSurveyModal({ visible, onClose }: Props) {
  const { user } = useAuthStore();
  const { profile, kids, parentGender, motherName } = useProfileStore();
  const { markSubmitted, markDismissed } = useFeedbackStore();

  const [rating, setRating] = useState(0);
  const [loved, setLoved] = useState<string[]>([]);
  const [frustrated, setFrustrated] = useState<string[]>([]);
  const [priceBand, setPriceBand] = useState<PriceBand | null>(null);
  const [pay, setPay] = useState<PayChoice | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);

  const canSubmit = useMemo(() => rating > 0 && !!priceBand && !!pay, [rating, priceBand, pay]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, tag: string) => {
    setArr(arr.includes(tag) ? arr.filter((t) => t !== tag) : [...arr, tag]);
  };

  const reset = () => {
    setRating(0); setLoved([]); setFrustrated([]);
    setPriceBand(null); setPay(null); setNote(''); setError(''); setThanks(false);
  };

  const handleClose = () => {
    if (!thanks) markDismissed();
    onClose();
    // Give the close animation a beat before clearing state
    setTimeout(reset, 300);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Please pick a rating, price, and if you\'d pay.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const userName = motherName || user?.name || '';
      await submitTesterFeedback({
        uid: user?.uid ?? null,
        userName: userName || undefined,
        userEmail: user?.email ?? undefined,
        rating,
        loved,
        frustrated,
        priceBand: priceBand!,
        wouldPayAnnual: pay!,
        note: note.trim() || undefined,
        stage: profile?.stage ?? undefined,
        kidsCount: kids?.length ?? 0,
        parentGender: parentGender || undefined,
        platform: Platform.OS,
      });
      markSubmitted();
      setThanks(true);
    } catch (e) {
      console.error('submitTesterFeedback failed:', e);
      setError('Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Tester feedback</Text>
              <Text style={s.title}>{thanks ? 'Thank you 💜' : 'Help shape MaaMitra'}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <Ionicons name="close-circle-outline" size={26} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {thanks ? (
            <View style={s.thanksWrap}>
              <View style={s.thanksIcon}>
                <Ionicons name="heart" size={32} color={Colors.primary} />
              </View>
              <Text style={s.thanksText}>
                Your feedback shapes what we build next. Really — thank you.
              </Text>
              <TouchableOpacity onPress={handleClose} style={s.thanksBtn}>
                <Text style={s.thanksBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.sub}>
                30 seconds. No right answers — we just want the truth.
              </Text>

              {/* Q1: Rating */}
              <Text style={s.qLabel}>1. How do you feel about MaaMitra overall?</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <Ionicons
                      name={n <= rating ? 'star' : 'star-outline'}
                      size={32}
                      color={n <= rating ? '#F59E0B' : '#D1D5DB'}
                      style={{ marginRight: 6 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Q2: Loved */}
              <Text style={s.qLabel}>2. What did you love? <Text style={s.hint}>(tap any)</Text></Text>
              <View style={s.chipWrap}>
                {LOVED_TAGS.map((tag) => (
                  <Chip key={tag} label={tag} active={loved.includes(tag)} onPress={() => toggle(loved, setLoved, tag)} />
                ))}
              </View>

              {/* Q3: Frustrated */}
              <Text style={s.qLabel}>3. What frustrated you? <Text style={s.hint}>(tap any)</Text></Text>
              <View style={s.chipWrap}>
                {FRUSTRATED_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    active={frustrated.includes(tag)}
                    tone="warn"
                    onPress={() => toggle(frustrated, setFrustrated, tag)}
                  />
                ))}
              </View>

              {/* Q4: Price */}
              <Text style={s.qLabel}>4. Fair annual price for you?</Text>
              <View style={s.chipWrap}>
                {PRICE_OPTIONS.map((o) => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    active={priceBand === o.key}
                    single
                    onPress={() => setPriceBand(o.key)}
                  />
                ))}
              </View>

              {/* Q5: Pay */}
              <Text style={s.qLabel}>5. Would you pay ₹1,999/year today?</Text>
              <View style={s.payRow}>
                {PAY_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    onPress={() => setPay(o.key)}
                    style={[
                      s.payPill,
                      pay === o.key && { backgroundColor: `${o.tint}1A`, borderColor: o.tint },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.payPillText, pay === o.key && { color: o.tint }]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Q6: Optional note */}
              <Text style={s.qLabel}>6. One thing you'd add or fix? <Text style={s.hint}>(optional)</Text></Text>
              <TextInput
                style={s.noteInput}
                placeholder="e.g. sleep tracker, bigger font, Hindi support…"
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={280}
              />

              {error ? <Text style={s.errorText}>{error}</Text> : null}
            </ScrollView>
          )}

          {/* Submit */}
          {!thanks ? (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.9}
              style={{ marginTop: 14 }}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primary]}
                style={[s.submitBtn, (!canSubmit || submitting) && { opacity: 0.55 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitText}>Submit feedback</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ─── Chip ──────────────────────────────────────────────────────────

function Chip({
  label,
  active,
  onPress,
  tone,
  single,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: 'warn';
  single?: boolean;
}) {
  const activeBg = tone === 'warn' ? 'rgba(239,68,68,0.08)' : Colors.primarySoft;
  const activeBorder = tone === 'warn' ? '#EF4444' : Colors.primary;
  const activeText = tone === 'warn' ? '#EF4444' : Colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        s.chip,
        active && { backgroundColor: activeBg, borderColor: activeBorder },
        single && { minWidth: 120 },
      ]}
    >
      <Text style={[s.chipText, active && { color: activeText, fontFamily: Fonts.sansSemiBold }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '92%',
    ...Shadow.lg,
  },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyebrow: {
    fontSize: 10, fontFamily: Fonts.sansBold, color: Colors.primary,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  title: { fontSize: 20, fontFamily: Fonts.sansBold, color: Colors.textDark, marginTop: 2 },
  sub: { fontSize: 13, color: Colors.textLight, marginBottom: 14, fontFamily: Fonts.sansRegular },

  qLabel: {
    fontSize: 14, fontFamily: Fonts.sansSemiBold, color: Colors.textDark,
    marginTop: 14, marginBottom: 8,
  },
  hint: { fontSize: 12, fontFamily: Fonts.sansRegular, color: Colors.textMuted },

  starsRow: { flexDirection: 'row', alignItems: 'center' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: '#fff',
  },
  chipText: { fontSize: 13, color: Colors.textDark, fontFamily: Fonts.sansMedium },

  payRow: { flexDirection: 'row', gap: 8 },
  payPill: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  payPillText: { fontSize: 14, fontFamily: Fonts.sansSemiBold, color: Colors.textDark },

  noteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, fontSize: 14, fontFamily: Fonts.sansRegular, color: Colors.textDark,
    minHeight: 60, maxHeight: 100, textAlignVertical: 'top',
    backgroundColor: '#FAFAFB',
  },

  errorText: { fontSize: 12, color: Colors.error, marginTop: 10, fontFamily: Fonts.sansMedium },

  submitBtn: {
    paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontFamily: Fonts.sansBold, letterSpacing: 0.3 },

  thanksWrap: { alignItems: 'center', paddingVertical: 20, gap: 14 },
  thanksIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  thanksText: {
    fontSize: 15, color: Colors.textDark, textAlign: 'center',
    fontFamily: Fonts.sansRegular, lineHeight: 22, paddingHorizontal: 14,
  },
  thanksBtn: {
    marginTop: 4, paddingVertical: 10, paddingHorizontal: 28,
    borderRadius: Radius.full, backgroundColor: Colors.primarySoft,
  },
  thanksBtnText: { color: Colors.primary, fontSize: 14, fontFamily: Fonts.sansBold },
});
