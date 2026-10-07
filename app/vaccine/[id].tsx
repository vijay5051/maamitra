import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { syncCompletedVaccines } from '../../services/firebase';
import { getEnrichment } from '../../data/vaccineEnrichments';
import { getDiseases } from '../../data/vaccineDiseases';
import DatePickerField from '../../components/ui/DatePickerField';
import { ScreenHeader } from '../../components/settings/ScreenHeader';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { successBump } from '../../lib/haptics';

export default function VaccineDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeKid } = useActiveKid();
  const { markVaccineDone, unmarkVaccineDone } = useProfileStore();
  const schedule = useVaccineSchedule();

  const vaccine = useMemo(() => schedule.find((v) => v.id === id), [schedule, id]);
  const enrichment = useMemo(() => (id ? getEnrichment(id) : undefined), [id]);
  const diseases = useMemo(
    () => (enrichment ? getDiseases(enrichment.diseaseIds) : []),
    [enrichment],
  );

  const [showDateInput, setShowDateInput] = useState(false);
  const [pendingDate, setPendingDate] = useState('');
  const [dateError, setDateError] = useState('');

  if (!vaccine || !id) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Vaccine" />
        <View style={s.missingWrap}>
          <Text style={s.missingTitle}>Vaccine not found</Text>
          <Text style={s.missingBody}>
            This vaccine may not be part of the schedule you've picked. Go back and open one from
            the list.
          </Text>
        </View>
      </View>
    );
  }

  const isDone = vaccine.status === 'done';
  const isOverdue = vaccine.status === 'overdue';
  const isDueSoon = vaccine.status === 'due-soon';
  const kidId = activeKid?.id ?? '';
  const canMark = isDone || isOverdue || isDueSoon;

  const syncToCloud = () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;
    const { completedVaccines } = useProfileStore.getState();
    syncCompletedVaccines(uid, completedVaccines).catch(console.error);
  };

  const handleToggle = () => {
    if (!canMark || !kidId) return;
    if (isDone) {
      unmarkVaccineDone(vaccine.id, kidId);
      syncToCloud();
      return;
    }
    setShowDateInput(true);
    setPendingDate(new Date().toISOString().split('T')[0]);
  };

  const handleConfirmDate = () => {
    if (!pendingDate || isDone || !kidId) return;
    const chosen = new Date(pendingDate + 'T00:00:00');
    if (chosen > new Date()) {
      setDateError('Pick today or a past date — future dates are not allowed.');
      return;
    }
    setDateError('');
    markVaccineDone(vaccine.id, kidId, chosen.toISOString());
    successBump();
    setShowDateInput(false);
    syncToCloud();
  };

  const today = new Date().toISOString().split('T')[0];
  const doneDateStr = vaccine.doneDate
    ? new Date(vaccine.doneDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const statusChip = (() => {
    if (isDone) return { label: doneDateStr ? `Given · ${doneDateStr}` : 'Given', color: '#16A34A', bg: '#DCFCE7' };
    if (isOverdue) return { label: 'Overdue', color: '#B91C1C', bg: '#FEE2E2' };
    if (isDueSoon) return { label: 'Due soon', color: '#C2410C', bg: '#FFEDD5' };
    return { label: vaccine.formattedDate, color: Colors.textMuted, bg: Colors.bgTint };
  })();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScreenHeader title={vaccine.name} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Hero: name, age label, status chip. */}
        <View style={s.heroCard}>
          <Text style={s.heroName}>{vaccine.name}</Text>
          <View style={s.heroMetaRow}>
            <View style={s.heroMeta}>
              <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
              <Text style={s.heroMetaText}>{vaccine.ageLabel}</Text>
            </View>
            <View style={s.heroMeta}>
              <Ionicons name="layers-outline" size={14} color={Colors.primary} />
              <Text style={s.heroMetaText}>{vaccine.category}</Text>
            </View>
          </View>
          <View style={[s.statusChip, { backgroundColor: statusChip.bg }]}>
            <Text style={[s.statusChipText, { color: statusChip.color }]}>{statusChip.label}</Text>
          </View>
          <Text style={s.heroDesc}>{vaccine.description}</Text>
        </View>

        {/* Protects against — the headline parents actually care about. */}
        {diseases.length > 0 ? (
          <View style={s.sectionWrap}>
            <Text style={s.sectionTitle}>Protects against</Text>
            {diseases.map((d) => (
              <View key={d.id} style={s.diseaseCard}>
                <View style={s.diseaseHeader}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={d.severity === 'severe' ? '#B91C1C' : Colors.primary}
                  />
                  <Text style={s.diseaseName}>{d.name}</Text>
                </View>
                <Text style={s.diseaseOneLiner}>{d.oneLiner}</Text>
                <Text style={s.diseaseWhy}>{d.whyItMatters}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Why important — single-sentence rationale. */}
        {enrichment?.whyImportant ? (
          <View style={s.sectionWrap}>
            <Text style={s.sectionTitle}>Why this one matters</Text>
            <View style={s.plainCard}>
              <Text style={s.plainText}>{enrichment.whyImportant}</Text>
            </View>
          </View>
        ) : null}

        {/* Side effects — manages expectations. */}
        {enrichment?.sideEffects ? (
          <View style={s.sectionWrap}>
            <Text style={s.sectionTitle}>What to expect</Text>
            <View style={s.plainCard}>
              <Text style={s.plainText}>{enrichment.sideEffects}</Text>
            </View>
          </View>
        ) : null}

        {/* Aliases — the names the paediatrician will actually say. */}
        {enrichment?.aliases && enrichment.aliases.length > 0 ? (
          <View style={s.sectionWrap}>
            <Text style={s.sectionTitle}>Doctors may also call this</Text>
            <View style={s.aliasRow}>
              {enrichment.aliases.map((a) => (
                <View key={a} style={s.aliasChip}>
                  <Text style={s.aliasChipText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Primary action: mark / undo. The inline checkbox on the list is
            the fast path; this is the explicit one for parents who got here
            via a reminder notification. */}
        <View style={s.actionWrap}>
          {canMark ? (
            <TouchableOpacity
              onPress={handleToggle}
              style={[s.actionBtn, isDone ? s.actionBtnUndo : s.actionBtnPrimary]}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isDone ? 'refresh-outline' : 'checkmark-circle-outline'}
                size={18}
                color={isDone ? Colors.error : '#ffffff'}
              />
              <Text style={[s.actionBtnText, isDone && { color: Colors.error }]}>
                {isDone ? 'Undo given' : 'Mark as given'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.actionBtn, s.actionBtnDisabled]}>
              <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
              <Text style={[s.actionBtnText, { color: Colors.textMuted }]}>Not yet due</Text>
            </View>
          )}
        </View>

        {showDateInput ? (
          <View style={s.dateWrap}>
            <Text style={s.dateLabel}>Date given</Text>
            <DatePickerField
              value={pendingDate}
              onChange={(d) => {
                setPendingDate(d);
                setDateError('');
              }}
              maxDate={today}
              placeholder="Select date given"
            />
            {dateError ? <Text style={s.dateError}>⚠️ {dateError}</Text> : null}
            <View style={s.dateBtns}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => {
                  setShowDateInput(false);
                  setPendingDate('');
                  setDateError('');
                }}
                activeOpacity={0.7}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, !pendingDate && s.confirmBtnDisabled]}
                onPress={handleConfirmDate}
                disabled={!pendingDate}
                activeOpacity={0.85}
              >
                <Text style={s.confirmBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Text style={s.disclaimer}>
          Information shown here is a summary for parents, not medical advice. Please check with
          your paediatrician for anything specific to your child.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  missingWrap: { padding: Spacing.xl, alignItems: 'center' },
  missingTitle: { fontFamily: Fonts.sansBold, fontSize: 18, color: Colors.textDark, marginBottom: 6 },
  missingBody: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },

  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroName: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: Colors.textDark,
    letterSpacing: -0.2,
  },
  heroMetaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8, flexWrap: 'wrap' },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  heroMetaText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: Colors.textLight },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.xs,
    marginTop: 10,
  },
  statusChipText: { fontFamily: Fonts.sansBold, fontSize: 12 },
  heroDesc: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: Colors.textLight,
    lineHeight: 20,
    marginTop: 12,
  },

  sectionWrap: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    color: Colors.textLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: Spacing.xs,
  },
  diseaseCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 12,
    marginBottom: 8,
  },
  diseaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  diseaseName: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.textDark },
  diseaseOneLiner: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 18,
  },
  diseaseWhy: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginTop: 6,
    fontStyle: 'italic',
  },

  plainCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: 12,
  },
  plainText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 14,
    color: Colors.textDark,
    lineHeight: 20,
  },

  aliasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aliasChip: {
    backgroundColor: Colors.bgTint,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    borderRadius: Radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aliasChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },

  actionWrap: { marginTop: Spacing.md, marginBottom: Spacing.md },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnUndo: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  actionBtnDisabled: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  actionBtnText: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#ffffff' },

  dateWrap: {
    marginTop: 10,
    paddingTop: 10,
    gap: 6,
  },
  dateLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateError: { fontFamily: Fonts.sansMedium, fontSize: 11.5, color: Colors.error },
  dateBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.textLight },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#A7F3C3' },
  confirmBtnText: { fontFamily: Fonts.sansBold, fontSize: 13, color: '#fff' },

  disclaimer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
});
