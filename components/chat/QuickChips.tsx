import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useProfileStore, calculateAgeInMonths } from '../../store/useProfileStore';
import { Fonts } from '../../constants/theme';

interface QuickChipsProps {
  onSelect: (text: string) => void;
}

// ─── Chip bank keyed by life-stage ───────────────────────────────────────────

const CHIPS_PREGNANT = [
  "What to eat in my third trimester?",
  "How to prepare for labour?",
  "Is it safe to travel at 7 months?",
  "Best exercises during pregnancy",
  "Signs of preterm labour to watch for",
  "Hospital bag checklist",
  "Normal vs concerning swelling?",
];

const CHIPS_NEWBORN = (name: string) => [
  `Why is ${name} crying so much?`,
  "How often should I breastfeed?",
  "Normal newborn poop colours",
  "Safe sleep position for baby",
  "When is the first vaccination?",
  "Baby has jaundice — what to do?",
  "I'm feeling overwhelmed",
  "Postpartum recovery tips for me",
];

const CHIPS_3TO6 = (name: string) => [
  `When does ${name} start solids?`,
  "4-month sleep regression tips",
  `Is ${name}'s development on track?`,
  "Tummy time tips for my baby",
  "Breastfeeding while going back to work",
  "Baby won't stop crying in the evening",
  "When to worry about fever?",
  "Postpartum yoga for me",
];

const CHIPS_6TO9 = (name: string) => [
  `Best first foods for ${name}?`,
  "Baby gagging vs choking — difference?",
  `How much water can ${name} have?`,
  "Sleep training — where to start?",
  `${name} isn't crawling yet — normal?`,
  "Finger foods at this age",
  "Common 6-month vaccines explained",
  "I'm exhausted — how to cope?",
];

const CHIPS_9TO12 = (name: string) => [
  `Is ${name} ready to walk?`,
  "When to introduce cow's milk?",
  `${name} keeps throwing food — tips?`,
  "Separation anxiety in babies",
  "First birthday party foods — safe list",
  `${name}'s first words — when to expect?`,
  "Safe baby proofing checklist",
  "Best vaccines before 12 months",
];

const CHIPS_TODDLER = (name: string) => [
  `${name} is a picky eater — help!`,
  "Healthy Indian toddler meal ideas",
  `When should ${name} see a dentist?`,
  "Screen time limits for toddlers",
  `${name} is having tantrums`,
  "Potty training readiness signs",
  "Best activities for cognitive development",
  "Toddler sleep schedule tips",
];

const CHIPS_PRESCHOOLER = (name: string) => [
  `${name} is starting school — how to prepare?`,
  "Healthy tiffin box ideas for preschoolers",
  `${name} is having trouble sharing`,
  "Screen time rules for 3-4 year olds",
  "Speech development milestones now",
  `${name} has tantrums in public`,
  "Building confidence in my child",
  "Activities for cognitive development at home",
];

const CHIPS_SCHOOLAGE = (name: string) => [
  `${name} is struggling at school — tips?`,
  "Nutritious after-school snack ideas",
  `${name} is having friendship issues`,
  "How much screen time is okay?",
  "Boosting immunity naturally for school kids",
  "Handling exam anxiety in children",
  `${name} is a fussy eater now`,
  "Building good study habits early",
];

const CHIPS_FALLBACK = [
  "When is the next vaccination?",
  "Baby won't sleep at night",
  "How to start solid foods?",
  "I'm feeling overwhelmed",
  "Baby has mild fever",
  "Breastfeeding tips",
  "Postpartum yoga for me",
  "Recommend safe baby products",
];

// ─── Select chips based on profile ───────────────────────────────────────────

function getChips(
  kidName: string,
  ageMonths: number | null,
  isExpecting: boolean,
): string[] {
  if (isExpecting) return CHIPS_PREGNANT;
  if (ageMonths === null) return CHIPS_FALLBACK;
  if (ageMonths < 3) return CHIPS_NEWBORN(kidName);
  if (ageMonths < 6) return CHIPS_3TO6(kidName);
  if (ageMonths < 9) return CHIPS_6TO9(kidName);
  if (ageMonths < 12) return CHIPS_9TO12(kidName);
  if (ageMonths < 36) return CHIPS_TODDLER(kidName);
  if (ageMonths < 60) return CHIPS_PRESCHOOLER(kidName);   // 3-5 years
  return CHIPS_SCHOOLAGE(kidName);                          // 5+ years
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickChips({ onSelect }: QuickChipsProps) {
  const { activeKid, ageLabel } = useActiveKid();
  const motherName = useProfileStore((s) => s.motherName);

  const chips = useMemo(() => {
    if (!activeKid) return CHIPS_FALLBACK;
    const months = activeKid.isExpecting ? null : calculateAgeInMonths(activeKid.dob);
    return getChips(activeKid.name, months, activeKid.isExpecting ?? false);
  }, [activeKid]);

  const greeting = useMemo(() => {
    if (!activeKid) return 'SUGGESTIONS';
    if (activeKid.isExpecting) return 'FOR YOUR PREGNANCY';
    if (!activeKid.isExpecting) {
      return `FOR ${activeKid.name.toUpperCase()} · ${ageLabel.toUpperCase()}`;
    }
    return `FOR ${activeKid.name.toUpperCase()}`;
  }, [activeKid, ageLabel]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{greeting}</Text>
      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.chipWrap}>
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip}
              onPress={() => onSelect(chip)}
              activeOpacity={0.75}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    color: '#C4B5D4',
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  scroll: {
    maxHeight: 200,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(232,72,122,0.22)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    boxShadow: '0px 2px 6px rgba(232, 72, 122, 0.07)',
  },
  chipText: {
    color: '#E8487A',
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
  },
});
