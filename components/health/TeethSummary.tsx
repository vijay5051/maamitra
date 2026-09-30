
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

const ROSE = Colors.primary;
const PLUM = Colors.primary;
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#6B7280';

interface Props {
  /** Teeth currently in (erupted, not yet lost). */
  eruptedCount: number;
  /** Milk teeth that have fallen out (incl. ones already replaced). */
  shedCount: number;
  /** Adult teeth that have come in (big-kid mode only). */
  adultCount?: number;
  totalTeeth: number;
  ageMonths: number | null; // null for expecting / no kid
  isExpecting: boolean;
  kidName: string;
  /** 5y+ mode — progress tracks milk teeth falling out, not eruption. */
  bigKid?: boolean;
}

/** Returns a friendly band label for how many teeth a typical child has at this age. */
function expectedBand(ageMonths: number): string | null {
  if (ageMonths < 4) return null;
  if (ageMonths < 7) return 'Most babies have 0–2 teeth at 6 months';
  if (ageMonths < 10) return 'Most babies have 2–4 teeth around 9 months';
  if (ageMonths < 13) return 'Around 12 months: 4–8 teeth is typical';
  if (ageMonths < 19) return 'By 18 months: 8–12 teeth is common';
  if (ageMonths < 25) return 'By 2 years: 12–16 teeth is common';
  if (ageMonths < 36) return 'All 20 milk teeth usually appear by age 3';
  return 'All 20 milk teeth typically present by now';
}

/** 5y+ band: what's usually happening with milk teeth at this age. */
function bigKidBand(ageMonths: number): string {
  if (ageMonths < 72) return 'First wobbly tooth usually shows up between 6 and 7 — lower front teeth go first';
  if (ageMonths < 96) return 'Ages 6–8: front teeth swap out and the 6-year molars come in at the back';
  if (ageMonths < 108) return 'Around 8–9: a quiet spell — the next teeth to wobble are canines and molars';
  return 'Ages 9–12: canines and back milk teeth fall out; all usually gone by 12–13';
}

export default function TeethSummary({
  eruptedCount,
  shedCount,
  adultCount = 0,
  totalTeeth,
  ageMonths,
  isExpecting,
  kidName,
  bigKid = false,
}: Props) {
  // Baby mode: % of the 20 milk teeth that have ever come through (a shed
  // tooth erupted first). Big-kid mode: % of milk teeth that have fallen out.
  const everErupted = eruptedCount + shedCount;
  const pct = Math.min(100, Math.round(((bigKid ? shedCount : everErupted) / totalTeeth) * 100));
  const band = ageMonths !== null && !isExpecting
    ? (bigKid ? bigKidBand(ageMonths) : expectedBand(ageMonths))
    : null;
  const subtitle = bigKid
    ? `${shedCount} of ${totalTeeth} milk teeth out${adultCount > 0 ? ` · ${adultCount} adult ${adultCount === 1 ? 'tooth' : 'teeth'} in` : ''}`
    : `${everErupted} of ${totalTeeth} erupted${shedCount > 0 ? ` · ${shedCount} shed` : ''}`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons name="happy-outline" size={20} color={ROSE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {kidName ? `${kidName}'s ${bigKid ? 'smile' : 'teeth'}` : bigKid ? 'Milk teeth & adult teeth' : 'Teething progress'}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.pct}>{pct}%</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.bar}>
        <LinearGradient
          colors={[ROSE, PLUM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${pct}%` as any }]}
        />
      </View>

      {/* Age-aware hint */}
      {band && (
        <View style={styles.bandRow}>
          <Ionicons name="sparkles-outline" size={13} color={PLUM} />
          <Text style={styles.bandText}>{band}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: MIST,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(28, 16, 51, 0.054)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 14.5,
    color: INK,
  },
  subtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: STONE,
    marginTop: 1,
  },
  pct: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: ROSE,
  },
  bar: {
    height: 8,
    backgroundColor: MIST,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  bandText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: PLUM,
    flex: 1,
  },
});

