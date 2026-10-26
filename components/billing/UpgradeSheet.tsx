import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts } from '../../constants/theme';
import { usePlanAccess } from '../../hooks/usePlanAccess';
import { usePlanStore, UpgradeReason } from '../../store/usePlanStore';
import { cheapestPlanWhere, GatedFeature, GatedLibrary, PLAN_LIMITS, PLAN_NAMES, PlanLimits } from '../../lib/plans';

const FEATURE_COPY: Record<GatedFeature, { title: string; body: string }> = {
  photoQuestions: { title: 'Ask with a photo', body: 'Send a photo of a rash, a food label or a report and get an answer about it.' },
  readAloud: { title: 'Hear answers read aloud', body: 'Listen to MaaMitra’s answers in a natural voice, in English or Hindi.' },
  vaccineReminders: { title: 'Vaccine due-date reminders', body: 'Get a reminder before each of your child’s vaccines is due.' },
  vaccinePdf: { title: 'Vaccine record as PDF', body: 'Download or share your child’s vaccine record as a PDF for the doctor.' },
  fullMilestones: { title: 'All 68 milestones', body: 'Track 50 detailed milestones across movement, language, social and thinking skills.' },
  journey: { title: 'Journey timeline', body: 'See every milestone, tooth and first in one timeline of your child’s growing up.' },
  mealPlannerHistory: { title: 'Meal planner history', body: 'Look back at past weeks’ tiffin plans and reuse them.' },
  travelPack: { title: 'My Travel Pack', body: 'Save travel meals for your next trip and tick off what you’ve tested at home.' },
};

const LIBRARY_COPY: Record<GatedLibrary, { title: string; unit: string }> = {
  tiffin: { title: 'More tiffin recipes', unit: 'tiffin recipes' },
  travel: { title: 'More travel meals', unit: 'travel meals' },
  nuskhe: { title: 'More of Dadi Maa’s nuskhe', unit: 'home remedies' },
  yoga: { title: 'All yoga sessions', unit: 'yoga sessions' },
};

const count = (n: number, all: string) => (Number.isFinite(n) ? String(n) : all);

function describe(reason: UpgradeReason, current: PlanLimits) {
  switch (reason.kind) {
    case 'feature':
      return { ...FEATURE_COPY[reason.feature], needs: cheapestPlanWhere((l) => l.features.has(reason.feature)) };
    case 'library': {
      const { title, unit } = LIBRARY_COPY[reason.library];
      const lib = reason.library;
      return {
        title,
        body: `Free includes ${PLAN_LIMITS.free.library[lib]} ${unit}. Plus has ${count(PLAN_LIMITS.plus.library[lib], 'all')}, and Family has all of them.`,
        needs: cheapestPlanWhere((l) => l.library[lib] > current.library[lib]),
      };
    }
    case 'children':
      return {
        title: 'Add another child',
        body: `Free covers ${PLAN_LIMITS.free.children} child. Plus covers ${PLAN_LIMITS.plus.children} children, and Family covers 3 or more.`,
        needs: cheapestPlanWhere((l) => l.children > current.children),
      };
    case 'aiQuestions':
      return {
        title: `You’ve used today’s ${current.aiQuestionsPerDay} AI questions`,
        body: `Your questions reset at midnight. Plus gives you ${PLAN_LIMITS.plus.aiQuestionsPerDay} a day, and Family gives you unlimited questions.`,
        needs: cheapestPlanWhere((l) => l.aiQuestionsPerDay > current.aiQuestionsPerDay),
      };
  }
}

export default function UpgradeSheet() {
  const router = useRouter();
  const reason = usePlanStore((s) => s.upgradeReason);
  const close = usePlanStore((s) => s.closeUpgrade);
  const { limits } = usePlanAccess();
  if (!reason) return null;

  const { title, body, needs } = describe(reason, limits);
  const onWeb = Platform.OS === 'web';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} accessibilityLabel="Close">
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.badge}>
            <Ionicons name="lock-closed" size={14} color={Colors.primary} />
            <Text style={s.badgeText}>{needs ? `MaaMitra ${PLAN_NAMES[needs]}` : 'Paid plans'}</Text>
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>
          {onWeb ? (
            <TouchableOpacity
              style={s.primary}
              onPress={() => {
                close();
                router.push('/pricing');
              }}
              accessibilityRole="button"
            >
              <Text style={s.primaryText}>See plans</Text>
            </TouchableOpacity>
          ) : (
            <Text style={s.note}>
              Plans can’t be bought in the app yet. If you already have a plan, it works here when you sign in with the same account.
            </Text>
          )}
          <TouchableOpacity style={s.secondary} onPress={close} accessibilityRole="button">
            <Text style={s.secondaryText}>{onWeb ? 'Not now' : 'OK'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 30,
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryAlpha08,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontFamily: Fonts.sansBold, fontSize: 12, color: Colors.primary },
  title: { fontFamily: Fonts.serif, fontSize: 21, color: Colors.textDark },
  body: { fontFamily: Fonts.sansRegular, fontSize: 14, lineHeight: 21, color: '#374151' },
  note: { fontFamily: Fonts.sansRegular, fontSize: 13, lineHeight: 19, color: Colors.textMuted },
  primary: { backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  primaryText: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.white },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.primary },
});
