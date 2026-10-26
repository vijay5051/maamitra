import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Confetti } from '../ui/Confetti';
import { Colors, Fonts } from '../../constants/theme';
import { useProfileStore, type Kid } from '../../store/useProfileStore';
import { birthdayCardKey, birthdayNote, birthdayShareText, birthdayToday } from '../../lib/birthday';
import { shareText } from '../../lib/share';

const FLAG_COLORS = [Colors.ochreMild, Colors.blushMild, Colors.lavenderMild, Colors.sageMild];
const FLAGS = 9;

interface BirthdayKid {
  kid: Kid;
  years: number;
}

/**
 * Home-screen birthday wishes. On a child's birthday the card opens by itself
 * once (per child, per year); after that a small banner on Home reopens it for
 * the rest of the day.
 */
export function BirthdayCelebration() {
  const kids = useProfileStore((s) => s.kids);
  const dismissed = useProfileStore((s) => s.dismissedPrompts);
  const dismissPrompt = useProfileStore((s) => s.dismissPrompt);
  const [openId, setOpenId] = useState<string | null>(null);

  const today = new Date().toDateString();
  const birthdays = useMemo<BirthdayKid[]>(() => {
    const out: BirthdayKid[] = [];
    for (const kid of kids ?? []) {
      if (kid.isExpecting) continue;
      const years = birthdayToday(kid.dob);
      if (years !== null) out.push({ kid, years });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kids, today]);

  // Auto-open the first card not yet seen this year (twins: one after the other).
  useEffect(() => {
    if (openId) return;
    const unseen = birthdays.find((b) => !dismissed[birthdayCardKey(b.kid.id)]);
    if (unseen) setOpenId(unseen.kid.id);
  }, [birthdays, dismissed, openId]);

  if (birthdays.length === 0) return null;

  const open = birthdays.find((b) => b.kid.id === openId) ?? null;
  const close = () => {
    if (openId) dismissPrompt(birthdayCardKey(openId));
    setOpenId(null);
  };

  return (
    <>
      {birthdays.map((b) => (
        <Pressable
          key={b.kid.id}
          style={styles.banner}
          onPress={() => setOpenId(b.kid.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${b.kid.name || 'your child'}'s birthday card`}
        >
          <Text style={styles.bannerEmoji}>🎂</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {b.kid.name?.trim() ? `${b.kid.name.trim()} turns ${b.years} today!` : `Your little one turns ${b.years} today!`}
            </Text>
            <Text style={styles.bannerSub}>A birthday card from MaaMitra</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </Pressable>
      ))}
      {open ? <BirthdayCardModal kid={open.kid} years={open.years} onClose={close} /> : null}
    </>
  );
}

export function BirthdayCardModal({ kid, years, onClose }: { kid: Kid; years: number; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [confetti, setConfetti] = useState(true);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const name = kid.name?.trim() || 'Little one';
  const { heading, note, parentLine } = birthdayNote(name, years);
  const cardWidth = Math.min(380, width - 32);

  const share = async () => {
    const res = await shareText(`${name}'s birthday`, birthdayShareText(name, years));
    if (res.method === 'clipboard' && res.ok) setShareMsg('Wish copied. Paste it in your family chat.');
    else if (!res.ok && res.method === 'none') setShareMsg('Sharing is not available on this device.');
    else setShareMsg(null);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { width: cardWidth }]}>
            <LinearGradient
              colors={[Colors.creamWarm, '#FDE9E4', '#EEE6FA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.4, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Bunting */}
            <View style={styles.buntingString} />
            <View style={styles.bunting}>
              {Array.from({ length: FLAGS }, (_, i) => (
                <View key={i} style={[styles.flag, { borderTopColor: FLAG_COLORS[i % FLAG_COLORS.length] }]} />
              ))}
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close birthday card">
              <Ionicons name="close" size={20} color={Colors.textLight} />
            </Pressable>

            {/* Avatar with balloons */}
            <View style={styles.heroRow}>
              <Balloon color={Colors.blushMild} tilt="-10deg" />
              <View style={styles.ring}>
                <View style={styles.avatar}>
                  {kid.photoUrl ? (
                    <Image source={{ uri: kid.photoUrl }} style={styles.photo} contentFit="cover" />
                  ) : (
                    <>
                      <Text style={styles.ageNum}>{years}</Text>
                      <Text style={styles.ageCake}>🎂</Text>
                    </>
                  )}
                </View>
              </View>
              <Balloon color={Colors.lavenderMild} tilt="10deg" />
            </View>

            <Text style={styles.kicker}>{heading.toUpperCase()}</Text>
            <Text style={styles.name}>{name}</Text>

            <View style={styles.ornament}>
              <View style={styles.ornLine} />
              <Text style={styles.ornStar}>✦</Text>
              <View style={styles.ornLine} />
            </View>

            <Text style={styles.note}>{note}</Text>
            <Text style={styles.parentLine}>{parentLine}</Text>
            <Text style={styles.signature}>With love, MaaMitra 💜</Text>

            <Pressable style={styles.shareBtn} onPress={share} accessibilityRole="button">
              <Ionicons name="share-social-outline" size={18} color={Colors.white} />
              <Text style={styles.shareText}>Share the joy with family</Text>
            </Pressable>
            {shareMsg ? <Text style={styles.shareMsg}>{shareMsg}</Text> : null}
            <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={styles.doneText}>Close</Text>
            </Pressable>
          </View>
        </ScrollView>
        <Confetti show={confetti} onDone={() => setConfetti(false)} />
      </View>
    </Modal>
  );
}

function Balloon({ color, tilt }: { color: string; tilt: string }) {
  return (
    <View style={[styles.balloonWrap, { transform: [{ rotate: tilt }] }]}>
      <View style={[styles.balloon, { backgroundColor: color }]}>
        <View style={styles.balloonShine} />
      </View>
      <View style={[styles.balloonKnot, { borderBottomColor: color }]} />
      <View style={styles.balloonString} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF4E0',
    borderColor: Colors.ochreMild,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  bannerEmoji: { fontSize: 28 },
  bannerTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.textDark },
  bannerSub: { fontFamily: Fonts.sansRegular, fontSize: 13, color: Colors.textLight, marginTop: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.55)' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 18px 50px rgba(28,16,51,0.35)' } as object)
      : { elevation: 12 }),
  },
  buntingString: { position: 'absolute', top: 12, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(123,94,156,0.35)' },
  bunting: { position: 'absolute', top: 12, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' },
  flag: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 22,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  ring: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 4,
    borderColor: Colors.ochreMild,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  avatar: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  ageNum: { fontFamily: Fonts.serif, fontSize: 56, lineHeight: 62, color: Colors.primary },
  ageCake: { fontSize: 22, marginTop: -6 },
  balloonWrap: { alignItems: 'center', marginTop: -18 },
  balloon: { width: 34, height: 42, borderRadius: 20 },
  balloonShine: { position: 'absolute', top: 7, left: 8, width: 7, height: 11, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.65)' },
  balloonKnot: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
    transform: [{ rotate: '180deg' }],
  },
  balloonString: { width: 1, height: 26, backgroundColor: 'rgba(28,16,51,0.25)' },
  kicker: { fontFamily: Fonts.sansBold, fontSize: 12.5, letterSpacing: 2.2, color: Colors.primary, marginTop: 18 },
  name: { fontFamily: Fonts.serif, fontSize: 34, color: Colors.textDark, marginTop: 4, textAlign: 'center' },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  ornLine: { width: 48, height: 1, backgroundColor: 'rgba(123,94,156,0.3)' },
  ornStar: { color: Colors.ochreMild, fontSize: 14 },
  note: { fontFamily: Fonts.serifMedium, fontSize: 16, lineHeight: 25, color: Colors.textDark, textAlign: 'center' },
  parentLine: { fontFamily: Fonts.sansRegular, fontSize: 13.5, lineHeight: 20, color: Colors.textLight, textAlign: 'center', marginTop: 12 },
  signature: { fontFamily: Fonts.serifMedium, fontSize: 15, color: Colors.primary, marginTop: 14 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 13,
    alignSelf: 'stretch',
    marginTop: 20,
  },
  shareText: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.white },
  shareMsg: { fontFamily: Fonts.sansMedium, fontSize: 12.5, color: Colors.primary, marginTop: 8, textAlign: 'center' },
  doneBtn: { paddingVertical: 10, marginTop: 4 },
  doneText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.textLight },
});
