import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../../constants/theme';
import {
  allergyAlertSentences,
  AllergyMatch,
  matchChipText,
  NOT_A_GUARANTEE,
} from '../../../lib/foodAllergies';

const RED = '#B91C1C';
const RED_BG = '#FEF2F2';
const RED_BORDER = '#FCA5A5';
const AMBER = '#92400E';
const AMBER_BG = '#FEF3C7';
const AMBER_BORDER = '#FCD34D';
const STONE = '#6B7280';

/** Small chips for recipe cards: "Allergy: paneer (milk)" / "Suspected: banana". */
export function AllergyChips({ matches }: { matches: AllergyMatch[] }) {
  if (matches.length === 0) return null;
  const known = matches.filter((m) => m.entry.status === 'known');
  const suspected = matches.filter((m) => m.entry.status === 'suspected');
  const text = (ms: AllergyMatch[]) => {
    const names = ms.map(matchChipText);
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  };
  return (
    <View style={styles.chipRow}>
      {known.length > 0 && (
        <View style={[styles.chip, { backgroundColor: RED_BG, borderColor: RED_BORDER }]}>
          <Ionicons name="alert-circle" size={11} color={RED} />
          <Text style={[styles.chipText, { color: RED }]} numberOfLines={1}>Allergy: {text(known)}</Text>
        </View>
      )}
      {suspected.length > 0 && (
        <View style={[styles.chip, { backgroundColor: AMBER_BG, borderColor: AMBER_BORDER }]}>
          <Ionicons name="help-circle" size={11} color={AMBER} />
          <Text style={[styles.chipText, { color: AMBER }]} numberOfLines={1}>Suspected: {text(suspected)}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Warning block inside recipe details. With matches: one sentence each.
 * With a list but no match: a quiet "nothing detected — not a guarantee".
 */
export function AllergyBanner({
  matches,
  kidName,
  hasList,
}: {
  matches: AllergyMatch[];
  kidName: string;
  hasList: boolean;
}) {
  if (matches.length === 0) {
    if (!hasList) return null;
    return (
      <Text style={styles.quiet}>
        No foods from {kidName}’s allergy list were detected in this recipe. {NOT_A_GUARANTEE}
      </Text>
    );
  }
  const known = matches.some((m) => m.entry.status === 'known');
  const fg = known ? RED : AMBER;
  return (
    <View
      style={[styles.banner, { backgroundColor: known ? RED_BG : AMBER_BG, borderColor: known ? RED_BORDER : AMBER_BORDER }]}
      accessibilityRole="alert"
    >
      <Ionicons name={known ? 'alert-circle' : 'help-circle'} size={18} color={fg} />
      <View style={{ flex: 1, gap: 4 }}>
        {allergyAlertSentences(kidName, matches).map((s, i) => (
          <Text key={i} style={[styles.bannerText, { color: fg }]}>{s}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1, maxWidth: '100%',
  },
  chipText: { fontFamily: Fonts.sansSemiBold, fontSize: 10.5, flexShrink: 1 },
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 11, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  bannerText: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 19 },
  quiet: { fontFamily: Fonts.sansRegular, fontSize: 11.5, lineHeight: 17, color: STONE, marginBottom: 12 },
});
