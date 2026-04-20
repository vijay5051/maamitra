import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Card from '../ui/Card';
import JawChart from './JawChart';
import ToothDetailSheet from './ToothDetailSheet';
import TeethSummary from './TeethSummary';
import { eruptionWindowLabel, shedWindowLabel, TEETH, ToothRef, TOOTH_BY_ID } from '../../data/teeth';
import { useTeethStore } from '../../store/useTeethStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { calculateAgeInMonths } from '../../store/useProfileStore';
import { Fonts } from '../../constants/theme';

const ROSE = '#7C3AED';
const PLUM = '#7C3AED';
const SAGE = '#34D399';
const GOLD = '#F59E0B';
const MIST = '#EDE9F6';
const INK  = '#1C1033';
const STONE = '#6B7280';

export default function TeethTab() {
  const router = useRouter();
  const { activeKid, ageLabel } = useActiveKid();
  const byKid = useTeethStore((s) => s.byKid);
  const setToothState = useTeethStore((s) => s.setToothState);
  const clearTooth = useTeethStore((s) => s.clearTooth);

  const [selected, setSelected] = useState<ToothRef | null>(null);
  const [refOpen, setRefOpen] = useState(false);

  const kidId = activeKid?.id ?? '';
  const teethMap = kidId ? byKid[kidId] ?? {} : {};
  const eruptedCount = Object.values(teethMap).filter((e) => e.state === 'erupted').length;
  const shedCount = Object.values(teethMap).filter((e) => e.state === 'shed').length;

  const ageMonths = useMemo(() => {
    if (!activeKid || activeKid.isExpecting || !activeKid.dob) return null;
    return calculateAgeInMonths(activeKid.dob);
  }, [activeKid]);

  // ── No active kid ─────────────────────────────────────────────────────
  if (!activeKid) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Ionicons name="happy-outline" size={40} color={ROSE} style={{ marginBottom: 12, opacity: 0.85 }} />
        <Text style={styles.emptyTitle}>Add your baby first</Text>
        <Text style={styles.emptyText}>
          Add a child in your family profile to start tracking their teeth.
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push('/(tabs)/family')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[ROSE, PLUM]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyBtnGrad}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Add a child</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Card>
    );
  }

  // ── Expecting — no chart yet ──────────────────────────────────────────
  if (activeKid.isExpecting) {
    return (
      <Card style={styles.emptyCard} shadow="sm">
        <Ionicons name="heart-outline" size={40} color={PLUM} style={{ marginBottom: 12, opacity: 0.85 }} />
        <Text style={styles.emptyTitle}>Teething comes later 💛</Text>
        <Text style={styles.emptyText}>
          The first tooth usually appears around 6 months. We'll be ready to track when {activeKid.name || 'your baby'} arrives.
        </Text>
      </Card>
    );
  }

  const handleAskAI = () => {
    const eruptedList = TEETH
      .filter((t) => teethMap[t.id]?.state === 'erupted')
      .map((t) => t.shortName.toLowerCase())
      .slice(0, 6)
      .join(', ');

    const eruptedDesc = eruptedCount === 0
      ? 'No teeth have appeared yet'
      : `${eruptedCount} of 20 teeth have erupted${eruptedList ? ` (${eruptedList})` : ''}`;

    const prefill = `My baby ${activeKid.name} is ${ageLabel}. ${eruptedDesc}. Any soothing tips for teething right now, and what tooth typically comes next?`;

    router.push({ pathname: '/(tabs)/chat', params: { prefill } });
  };

  return (
    <View>
      <TeethSummary
        eruptedCount={eruptedCount}
        shedCount={shedCount}
        totalTeeth={TEETH.length}
        ageMonths={ageMonths}
        isExpecting={false}
        kidName={activeKid.name}
      />

      {/* Pre-eruption banner */}
      {ageMonths !== null && ageMonths < 4 && (
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={16} color={PLUM} />
          <Text style={styles.bannerText}>
            Most babies get their first tooth between 6–10 months. Nothing to track yet is perfectly normal.
          </Text>
        </View>
      )}

      {/* Late-eruption nudge */}
      {ageMonths !== null && ageMonths >= 15 && eruptedCount === 0 && (
        <View style={[styles.banner, { backgroundColor: 'rgba(245,158,11,0.08)', borderLeftColor: GOLD }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
          <Text style={[styles.bannerText, { color: '#92400e' }]}>
            Most babies have their first tooth by 12 months. Worth mentioning to your paediatrician at the next visit.
          </Text>
        </View>
      )}

      {/* Interactive chart */}
      <Text style={styles.tapHint}>Tap a tooth to log when it appeared</Text>
      <JawChart
        teeth={teethMap}
        selectedToothId={selected?.id ?? null}
        onSelect={(t) => setSelected(t)}
      />

      {/* AI suggestions */}
      <TouchableOpacity onPress={handleAskAI} activeOpacity={0.9} style={styles.askBtn}>
        <LinearGradient
          colors={[ROSE, PLUM]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.askBtnGrad}
        >
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={styles.askBtnText}>Ask MaaMitra about teething</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Reference accordion */}
      <TouchableOpacity
        onPress={() => setRefOpen((v) => !v)}
        activeOpacity={0.85}
        style={styles.refHeader}
      >
        <Ionicons name="book-outline" size={16} color={PLUM} />
        <Text style={styles.refHeaderText}>Reference: when each tooth appears</Text>
        <Ionicons name={refOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
      </TouchableOpacity>
      {refOpen && (
        <View style={styles.refList}>
          {TEETH.map((t) => {
            const entry = teethMap[t.id];
            const dot = entry?.state === 'erupted' ? SAGE : entry?.state === 'shed' ? GOLD : MIST;
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.refRow}
                activeOpacity={0.7}
                onPress={() => setSelected(TOOTH_BY_ID[t.id])}
              >
                <View style={[styles.refDot, { backgroundColor: dot }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.refName}>{t.name}</Text>
                  <Text style={styles.refMeta}>
                    Erupt {eruptionWindowLabel(t)} · Shed {shedWindowLabel(t)}
                  </Text>
                </View>
                <Text style={styles.refFdi}>{t.id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={PLUM} />
        <Text style={styles.disclaimerText}>
          Eruption ranges follow FOGSI / AAP guidelines. Every baby is different — talk to your paediatric dentist with any concerns.
        </Text>
      </View>

      <ToothDetailSheet
        visible={!!selected}
        tooth={selected}
        entry={selected ? teethMap[selected.id] ?? null : null}
        kidAgeMonths={ageMonths ?? 0}
        onSave={(entry) => {
          if (selected) setToothState(kidId, selected.id, entry);
        }}
        onClear={() => {
          if (selected) clearTooth(kidId, selected.id);
        }}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 16,
    color: INK,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13.5,
    color: STONE,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 270,
  },
  emptyBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 16 },
  emptyBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  emptyBtnText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 14 },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: PLUM,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  bannerText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12.5,
    color: '#4c1d95',
    flex: 1,
    lineHeight: 18,
  },

  tapHint: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: STONE,
    textAlign: 'center',
    marginBottom: 6,
  },

  askBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 14 },
  askBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  askBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 14 },

  refHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAFB',
    borderWidth: 1,
    borderColor: MIST,
    borderRadius: 12,
    marginTop: 14,
  },
  refHeaderText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: INK,
    flex: 1,
  },
  refList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MIST,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
    paddingHorizontal: 4,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EEFA',
  },
  refDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D9D2EA',
  },
  refName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: INK,
  },
  refMeta: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: STONE,
    marginTop: 1,
  },
  refFdi: {
    fontFamily: Fonts.sansBold,
    fontSize: 10.5,
    color: PLUM,
    backgroundColor: 'rgba(124,58,237,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(124,58,237,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  disclaimerText: {
    fontFamily: Fonts.sansRegular,
    flex: 1,
    fontSize: 12,
    color: STONE,
    lineHeight: 17,
  },
});
