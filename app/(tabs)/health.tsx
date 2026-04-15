import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { GOVERNMENT_SCHEMES } from '../../data/schemes';
import { useActiveKid } from '../../hooks/useActiveKid';
import GradientHeader from '../../components/ui/GradientHeader';
import Card from '../../components/ui/Card';
import TagPill from '../../components/ui/TagPill';
import VaccineCardComponent from '../../components/health/VaccineCard';

type SubTab = 'vaccines' | 'schemes' | 'myhealth';

// ─── Sub-tab selector ──────────────────────────────────────────────────────────

function SubTabSelector({
  active,
  onChange,
}: {
  active: SubTab;
  onChange: (t: SubTab) => void;
}) {
  const tabs: { key: SubTab; label: string }[] = [
    { key: 'vaccines', label: '💉 Vaccines' },
    { key: 'schemes', label: '🇮🇳 Schemes' },
    { key: 'myhealth', label: '❤️ My Health' },
  ];

  return (
    <View style={subTabStyles.row}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        if (isActive) {
          return (
            <TouchableOpacity key={t.key} onPress={() => onChange(t.key)} activeOpacity={0.8} style={{ flex: 1 }}>
              <LinearGradient
                colors={['#ec4899', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={subTabStyles.activeBtn}
              >
                <Text style={subTabStyles.activeBtnText}>{t.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={subTabStyles.inactiveBtn}
            activeOpacity={0.75}
          >
            <Text style={subTabStyles.inactiveBtnText}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const subTabStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
  },
  activeBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  inactiveBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inactiveBtnText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
});

// ─── VaccineCard — uses shared component with mark-as-done ────────────────────

// ─── SchemeCard ────────────────────────────────────────────────────────────────

function SchemeCard({ scheme }: { scheme: (typeof GOVERNMENT_SCHEMES)[0] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={schemeStyles.card} shadow="sm">
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={schemeStyles.row}>
          <Text style={schemeStyles.emoji}>{scheme.emoji}</Text>
          <View style={schemeStyles.info}>
            <Text style={schemeStyles.name}>{scheme.name}</Text>
            <Text style={schemeStyles.shortDesc}>{scheme.shortDesc}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#9ca3af"
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={schemeStyles.expanded}>
          <Text style={schemeStyles.expandedLabel}>Eligibility</Text>
          <Text style={schemeStyles.expandedText}>{scheme.eligibility}</Text>
          <Text style={schemeStyles.expandedLabel}>Benefit</Text>
          <Text style={schemeStyles.expandedText}>{scheme.benefit}</Text>
        </View>
      )}
    </Card>
  );
}

const schemeStyles = StyleSheet.create({
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 28, width: 36, textAlign: 'center' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  shortDesc: { fontSize: 12, color: '#6b7280' },
  expanded: { marginTop: 14, gap: 6 },
  expandedLabel: { fontSize: 12, fontWeight: '700', color: '#8b5cf6', marginBottom: 2 },
  expandedText: { fontSize: 13, color: '#374151', lineHeight: 19 },
});

// ─── My Health checklist ───────────────────────────────────────────────────────

const HEALTH_ITEMS = [
  { label: 'Postpartum check-up 👩‍⚕️', frequency: 'Monthly' },
  { label: 'Iron supplements 💊', frequency: 'Daily' },
  { label: 'Breast self-exam 🩺', frequency: 'Monthly' },
  { label: 'Pap smear test 🔬', frequency: 'Annually' },
  { label: 'Thyroid check 🦋', frequency: '6-monthly' },
  { label: 'Haemoglobin level 🩸', frequency: '3-monthly' },
  { label: 'Blood pressure check 💓', frequency: 'Monthly' },
  { label: 'BMI & weight check ⚖️', frequency: '3-monthly' },
  { label: 'Dental check-up 🦷', frequency: 'Annually' },
  { label: 'Eye screening 👁️', frequency: 'Annually' },
];

const HEALTH_STORAGE_KEY = 'maamitra-health-checklist';

function HealthCheckItem({
  item,
  checked,
  onToggle,
}: {
  item: (typeof HEALTH_ITEMS)[0];
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.75}
      style={[healthStyles.item, checked && healthStyles.itemChecked]}
    >
      <View style={[healthStyles.checkbox, checked && healthStyles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={14} color="#ffffff" />}
      </View>
      <View style={healthStyles.itemInfo}>
        <Text style={[healthStyles.itemLabel, checked && healthStyles.itemLabelChecked]}>
          {item.label}
        </Text>
        <Text style={healthStyles.itemFreq}>{item.frequency}</Text>
      </View>
    </TouchableOpacity>
  );
}

const healthStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  itemChecked: {
    backgroundColor: 'rgba(34,197,94,0.05)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  itemInfo: { flex: 1 },
  itemLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  itemLabelChecked: { color: '#6b7280', textDecorationLine: 'line-through' },
  itemFreq: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [subTab, setSubTab] = useState<SubTab>('vaccines');
  const vaccines = useVaccineSchedule();
  const { activeKid } = useActiveKid();
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    new Array(HEALTH_ITEMS.length).fill(false)
  );

  useEffect(() => {
    AsyncStorage.getItem(HEALTH_STORAGE_KEY).then((val) => {
      if (val) {
        try { setCheckedItems(JSON.parse(val)); } catch {}
      }
    });
  }, []);

  const toggleItem = (index: number) => {
    const updated = [...checkedItems];
    updated[index] = !updated[index];
    setCheckedItems(updated);
    AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(updated));
  };

  const checkedCount = checkedItems.filter(Boolean).length;
  const progressPct = (checkedCount / HEALTH_ITEMS.length) * 100;

  return (
    <View style={styles.container}>
      <GradientHeader title="Health 🏥" subtitle="IAP & FOGSI guidelines" />
      <SubTabSelector active={subTab} onChange={setSubTab} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── VACCINES ── */}
        {subTab === 'vaccines' && (
          <>
            {/* Info banner */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerEmoji}>💉</Text>
              <Text style={styles.infoBannerText}>
                Based on IAP 2024 immunisation schedule
              </Text>
            </View>

            {!activeKid || activeKid.isExpecting ? (
              <Card style={styles.noKidCard} shadow="sm">
                <Text style={styles.noKidEmoji}>🤱</Text>
                <Text style={styles.noKidText}>
                  Your vaccine schedule will appear here after your baby arrives.
                </Text>
              </Card>
            ) : (
              vaccines.map((v, i) => (
                <VaccineCardComponent key={v.id} vaccine={v} isLast={i === vaccines.length - 1} />
              ))
            )}
          </>
        )}

        {/* ── SCHEMES ── */}
        {subTab === 'schemes' && (
          <>
            <Text style={styles.schemesHeader}>Government Benefits for You 🇮🇳</Text>
            {GOVERNMENT_SCHEMES.map((s) => (
              <SchemeCard key={s.id} scheme={s} />
            ))}
          </>
        )}

        {/* ── MY HEALTH ── */}
        {subTab === 'myhealth' && (
          <>
            {/* Progress bar */}
            <Card style={styles.progressCard} shadow="sm">
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>FOGSI Health Checklist</Text>
                <Text style={styles.progressCount}>
                  {checkedCount}/{HEALTH_ITEMS.length}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#ec4899', '#8b5cf6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>
            </Card>

            {HEALTH_ITEMS.map((item, i) => (
              <HealthCheckItem
                key={item.label}
                item={item}
                checked={checkedItems[i]}
                onToggle={() => toggleItem(i)}
              />
            ))}

            {/* Disclaimer */}
            <Card style={styles.disclaimerCard} shadow="sm">
              <View style={styles.disclaimerRow}>
                <Ionicons name="information-circle-outline" size={20} color="#8b5cf6" />
                <Text style={styles.disclaimerText}>
                  Follows FOGSI guidelines. Always consult your doctor for personalised medical advice.
                </Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
  },
  infoBannerEmoji: { fontSize: 20 },
  infoBannerText: { flex: 1, fontSize: 13, color: '#8b5cf6', fontWeight: '600' },
  noKidCard: { alignItems: 'center', paddingVertical: 32 },
  noKidEmoji: { fontSize: 40, marginBottom: 12 },
  noKidText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, maxWidth: 240 },
  schemesHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 14,
  },
  progressCard: { marginBottom: 16 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  progressCount: { fontSize: 14, fontWeight: '700', color: '#ec4899' },
  progressBar: {
    height: 8,
    backgroundColor: '#f3e8ff',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  disclaimerCard: {
    marginTop: 8,
    backgroundColor: 'rgba(139,92,246,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
  },
  disclaimerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  disclaimerText: { flex: 1, fontSize: 13, color: '#6b7280', lineHeight: 19 },
});
