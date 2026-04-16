import React, { useEffect, useState } from 'react';
import {
  Linking,
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
import { useProfileStore } from '../../store/useProfileStore';
import Card from '../../components/ui/Card';
import VaccineCardComponent from '../../components/health/VaccineCard';
import { TabIcon } from '../../components/ui/AppIcon';
import { Fonts } from '../../constants/theme';

type SubTab = 'vaccines' | 'schemes' | 'myhealth';

// ─── Sub-tab selector ──────────────────────────────────────────────────────────

function SubTabSelector({
  active,
  onChange,
}: {
  active: SubTab;
  onChange: (t: SubTab) => void;
}) {
  const tabs: { key: SubTab; label: string; icon: string }[] = [
    { key: 'vaccines', label: 'Vaccines',  icon: 'shield-checkmark-outline' },
    { key: 'schemes',  label: 'Schemes',   icon: 'ribbon-outline' },
    { key: 'myhealth', label: 'My Health', icon: 'heart-outline' },
  ];

  return (
    <View style={subTabStyles.row}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        if (isActive) {
          return (
            <TouchableOpacity key={t.key} onPress={() => onChange(t.key)} activeOpacity={0.8} style={{ flex: 1 }}>
              <LinearGradient
                colors={['#E8487A', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={subTabStyles.activeBtn}
              >
                <TabIcon name={t.icon} active />
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
            <TabIcon name={t.icon} active={false} />
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
    backgroundColor: '#FFF8FC',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9F6',
  },
  activeBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  activeBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 12.5 },
  inactiveBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
  },
  inactiveBtnText: { fontFamily: Fonts.sansMedium, color: '#A78BCA', fontSize: 12.5 },
});

// ─── VaccineCard — uses shared component with mark-as-done ────────────────────

// ─── SchemeCard ────────────────────────────────────────────────────────────────

function buildPersonalMessage(scheme: (typeof GOVERNMENT_SCHEMES)[0], kid: any, motherName: string): string | null {
  const name = kid?.name ?? 'your baby';
  const isExpecting = kid?.isExpecting ?? false;
  const isGirl = kid?.gender === 'girl';
  const ageMonths = kid?.ageInMonths ?? 0;

  switch (scheme.id) {
    case 'gs01':
      return isExpecting
        ? `You're expecting — register at your nearest PHC now to claim ₹1,400 at delivery. Don't miss this!`
        : null;
    case 'gs02':
      return isExpecting
        ? `As an expecting mother, you may be eligible for ₹5,000 across 3 instalments. Register in your first trimester.`
        : ageMonths <= 6
        ? `${motherName}, if you haven't claimed PMMVY for ${name}'s birth, check with your Anganwadi — you may still be eligible.`
        : null;
    case 'gs03':
      return ageMonths <= 72
        ? `${name} (${ageMonths}mo) qualifies for free developmental screening at your nearest Anganwadi centre.`
        : null;
    case 'gs04':
      return isExpecting
        ? `You're pregnant — visit your Anganwadi centre to get free Iron & Folic Acid supplements and nutritional support now.`
        : ageMonths < 72
        ? `${name} is under 6 — register at your Anganwadi for free nutritional meals, growth monitoring, and supplements.`
        : null;
    case 'gs05':
      return isGirl
        ? `You have a daughter! Open an SSY account for her now and earn 8.2% interest tax-free until she turns 21.`
        : null;
    case 'gs06':
      return isExpecting
        ? `Free IFA tablets during pregnancy are available at every government hospital. Ask your doctor or ASHA worker.`
        : `Free Iron & Folic Acid supplements for ${name} are available at your nearest PHC or Anganwadi — no paperwork needed.`;
    default:
      return null;
  }
}

function isRelevant(scheme: (typeof GOVERNMENT_SCHEMES)[0], kid: any): boolean {
  if (!kid) return true;
  const { tags } = scheme;
  if (tags.includes('all')) return true;
  if (tags.includes('pregnant') && kid.isExpecting) return true;
  if (tags.includes('newborn') && !kid.isExpecting) return true;
  if (tags.includes('all-kids') && !kid.isExpecting) return true;
  if (tags.includes('girl') && kid.gender === 'girl') return true;
  return false;
}

function SchemeCard({ scheme, kid, motherName }: { scheme: (typeof GOVERNMENT_SCHEMES)[0]; kid: any; motherName: string }) {
  const [expanded, setExpanded] = useState(false);
  const relevant = isRelevant(scheme, kid);
  const personalMsg = buildPersonalMessage(scheme, kid, motherName);

  return (
    <View style={[scStyles.card, relevant && scStyles.cardRelevant]}>
      {relevant && (
        <View style={scStyles.relevantBadge}>
          <Ionicons name="sparkles" size={11} color="#8b5cf6" />
          <Text style={scStyles.relevantBadgeText}>Relevant for you</Text>
        </View>
      )}

      {/* Header — always visible */}
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8} style={scStyles.header}>
        <View style={scStyles.emojiWrap}>
          <Text style={scStyles.emoji}>{scheme.emoji}</Text>
        </View>
        <View style={scStyles.headerInfo}>
          <Text style={scStyles.name}>{scheme.name}</Text>
          <Text style={scStyles.shortDesc}>{scheme.shortDesc}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
      </TouchableOpacity>

      {/* Personalised callout — always visible if relevant */}
      {personalMsg && (
        <View style={scStyles.personalCallout}>
          <Ionicons name="person-circle-outline" size={15} color="#7c3aed" />
          <Text style={scStyles.personalText}>{personalMsg}</Text>
        </View>
      )}

      {/* Expanded details */}
      {expanded && (
        <View style={scStyles.details}>
          <Text style={scStyles.desc}>{scheme.description}</Text>

          <View style={scStyles.detailBlock}>
            <View style={scStyles.detailLabelRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
              <Text style={scStyles.detailLabel}>Who can apply</Text>
            </View>
            <Text style={scStyles.detailText}>{scheme.eligibility}</Text>
          </View>

          <View style={scStyles.detailBlock}>
            <View style={scStyles.detailLabelRow}>
              <Ionicons name="gift-outline" size={14} color="#ec4899" />
              <Text style={scStyles.detailLabel}>What you get</Text>
            </View>
            <Text style={scStyles.detailText}>{scheme.benefit}</Text>
          </View>

          <View style={scStyles.detailBlock}>
            <View style={scStyles.detailLabelRow}>
              <Ionicons name="navigate-outline" size={14} color="#8b5cf6" />
              <Text style={scStyles.detailLabel}>How to apply</Text>
            </View>
            <Text style={scStyles.detailText}>{scheme.howToApply}</Text>
          </View>
        </View>
      )}

      {/* Know More button — always visible */}
      <TouchableOpacity
        style={scStyles.linkBtn}
        onPress={() => Linking.openURL(scheme.url)}
        activeOpacity={0.8}
      >
        <Ionicons name="globe-outline" size={15} color="#8b5cf6" />
        <Text style={scStyles.linkBtnText}>Know More & Apply</Text>
        <Ionicons name="arrow-forward" size={13} color="#8b5cf6" />
      </TouchableOpacity>
    </View>
  );
}

const scStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(124,58,237,0.06)',
  } as any,
  cardRelevant: {
    borderColor: 'rgba(124,58,237,0.25)',
    backgroundColor: '#FFF8FC',
  },
  relevantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  relevantBadgeText: { fontFamily: Fonts.sansBold, fontSize: 11, color: '#7C3AED' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  emojiWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  headerInfo: { flex: 1 },
  name: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#1C1033', lineHeight: 19 },
  shortDesc: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  personalCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  personalText: { fontFamily: Fonts.sansMedium, flex: 1, fontSize: 13, color: '#4c1d95', lineHeight: 18 },
  details: { gap: 12, marginBottom: 12 },
  desc: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#374151', lineHeight: 20 },
  detailBlock: { gap: 4 },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailLabel: { fontFamily: Fonts.sansBold, fontSize: 11, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#4b5563', lineHeight: 19, paddingLeft: 19 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(124,58,237,0.04)',
  },
  linkBtnText: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#7C3AED' },
});

// ─── My Health recurring tracker ──────────────────────────────────────────────

const HEALTH_ITEMS = [
  { id: 'h01', label: 'Postpartum check-up', icon: 'person-outline',          freqDays: 30,  freqLabel: 'Every month' },
  { id: 'h02', label: 'Iron supplements',     icon: 'medical-outline',          freqDays: 1,   freqLabel: 'Daily' },
  { id: 'h03', label: 'Breast self-exam',     icon: 'hand-left-outline',        freqDays: 30,  freqLabel: 'Every month' },
  { id: 'h04', label: 'Blood pressure check', icon: 'pulse-outline',            freqDays: 30,  freqLabel: 'Every month' },
  { id: 'h05', label: 'Haemoglobin level',    icon: 'water-outline',            freqDays: 90,  freqLabel: 'Every 3 months' },
  { id: 'h06', label: 'BMI & weight check',   icon: 'scale-outline',            freqDays: 90,  freqLabel: 'Every 3 months' },
  { id: 'h07', label: 'Thyroid check',        icon: 'leaf-outline',             freqDays: 180, freqLabel: 'Every 6 months' },
  { id: 'h08', label: 'Pap smear test',       icon: 'search-outline',           freqDays: 365, freqLabel: 'Annually' },
  { id: 'h09', label: 'Dental check-up',      icon: 'happy-outline',            freqDays: 365, freqLabel: 'Annually' },
  { id: 'h10', label: 'Eye screening',        icon: 'eye-outline',              freqDays: 365, freqLabel: 'Annually' },
];

type HealthStatus = 'overdue' | 'due-soon' | 'up-to-date';

const HEALTH_STORAGE_KEY = 'maamitra-health-tracker';

function getStatus(lastDone: string | null, freqDays: number): HealthStatus {
  if (!lastDone) return 'overdue';
  const nextDue = new Date(new Date(lastDone).getTime() + freqDays * 864e5);
  const daysLeft = Math.floor((nextDue.getTime() - Date.now()) / 864e5);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 7) return 'due-soon';
  return 'up-to-date';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nextDueLabel(lastDone: string, freqDays: number) {
  const nextDue = new Date(new Date(lastDone).getTime() + freqDays * 864e5);
  const daysLeft = Math.floor((nextDue.getTime() - Date.now()) / 864e5);
  if (daysLeft <= 0) return 'Overdue';
  if (daysLeft === 1) return 'Due tomorrow';
  if (daysLeft < 30) return `Due in ${daysLeft} days`;
  if (daysLeft < 60) return 'Due next month';
  return `Due ${nextDue.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
}

function HealthCheckItem({
  item,
  lastDone,
  onMarkDone,
  onUndo,
}: {
  item: typeof HEALTH_ITEMS[0];
  lastDone: string | null;
  onMarkDone: () => void;
  onUndo: () => void;
}) {
  const status = getStatus(lastDone, item.freqDays);
  const statusColors: Record<HealthStatus, { bg: string; border: string; text: string; badge: string }> = {
    'overdue':    { bg: 'rgba(239,68,68,0.04)',   border: 'rgba(239,68,68,0.2)',   text: '#dc2626', badge: '#fef2f2' },
    'due-soon':   { bg: 'rgba(245,158,11,0.04)',  border: 'rgba(245,158,11,0.25)', text: '#d97706', badge: '#fffbeb' },
    'up-to-date': { bg: 'rgba(34,197,94,0.04)',   border: 'rgba(34,197,94,0.2)',   text: '#16a34a', badge: '#f0fdf4' },
  };
  const c = statusColors[status];
  const statusIcon  = status === 'up-to-date' ? 'checkmark-circle' : status === 'due-soon' ? 'time-outline' : 'alert-circle-outline';
  const statusLabel = status === 'up-to-date' ? 'Up to date' : status === 'due-soon' ? 'Due soon' : 'Overdue';

  return (
    <View style={[hStyles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={hStyles.cardHeader}>
        <View style={hStyles.iconBox}>
          <Ionicons name={item.icon as any} size={18} color="#E8487A" />
        </View>
        <View style={hStyles.headerInfo}>
          <Text style={hStyles.itemLabel}>{item.label}</Text>
          <Text style={hStyles.freqLabel}>{item.freqLabel}</Text>
        </View>
        <View style={[hStyles.statusBadge, { backgroundColor: c.badge }]}>
          <Ionicons name={statusIcon as any} size={12} color={c.text} />
          <Text style={[hStyles.statusText, { color: c.text }]}>{statusLabel}</Text>
        </View>
      </View>

      {lastDone ? (
        <View style={hStyles.doneRow}>
          <View style={hStyles.doneInfo}>
            <Text style={hStyles.doneLabel}>Last done: <Text style={hStyles.doneDate}>{formatDate(lastDone)}</Text></Text>
            {status !== 'overdue' && (
              <Text style={[hStyles.nextLabel, { color: c.text }]}>{nextDueLabel(lastDone, item.freqDays)}</Text>
            )}
            {status === 'overdue' && (
              <Text style={hStyles.overdueNote}>Overdue — tap to log it now</Text>
            )}
          </View>
          <TouchableOpacity style={hStyles.undoBtn} onPress={onUndo} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={13} color="#9ca3af" />
            <Text style={hStyles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={hStyles.neverDone}>Never logged — tap to record your first check</Text>
      )}

      {(status === 'overdue' || status === 'due-soon' || !lastDone) && (
        <TouchableOpacity style={hStyles.markBtn} onPress={onMarkDone} activeOpacity={0.85}>
          <LinearGradient
            colors={status === 'overdue' ? ['#ef4444', '#dc2626'] : ['#E8487A', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={hStyles.markBtnGrad}
          >
            <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
            <Text style={hStyles.markBtnText}>Mark as done today</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const hStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,72,122,0.09)', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  itemLabel: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#1C1033' },
  freqLabel: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusText: { fontFamily: Fonts.sansBold, fontSize: 11 },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  doneInfo: { flex: 1 },
  doneLabel: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF' },
  doneDate: { fontFamily: Fonts.sansBold, color: '#374151' },
  nextLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 12, marginTop: 2 },
  overdueNote: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#dc2626', marginTop: 2 },
  neverDone: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF', marginBottom: 8, fontStyle: 'italic' },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 4 },
  undoBtnText: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9CA3AF' },
  markBtn: { borderRadius: 10, overflow: 'hidden' },
  markBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  markBtnText: { fontFamily: Fonts.sansBold, color: '#fff', fontSize: 13 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [subTab, setSubTab] = useState<SubTab>('vaccines');
  const vaccines = useVaccineSchedule();
  const { activeKid } = useActiveKid();
  const motherName = useProfileStore((s) => s.motherName);
  // lastDone: { [itemId]: ISO date string }
  const [lastDone, setLastDone] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem(HEALTH_STORAGE_KEY).then((val) => {
      if (val) { try { setLastDone(JSON.parse(val)); } catch {} }
    });
  }, []);

  const markDone = (id: string) => {
    const updated = { ...lastDone, [id]: new Date().toISOString() };
    setLastDone(updated);
    AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(updated));
  };

  const undoDone = (id: string) => {
    const updated = { ...lastDone };
    delete updated[id];
    setLastDone(updated);
    AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(updated));
  };

  const upToDateCount = HEALTH_ITEMS.filter(
    (item) => getStatus(lastDone[item.id] ?? null, item.freqDays) === 'up-to-date'
  ).length;
  const progressPct = (upToDateCount / HEALTH_ITEMS.length) * 100;

  const kidSubtitle = activeKid
    ? activeKid.isExpecting
      ? `${activeKid.name} · Due soon`
      : `${activeKid.name} · ${(() => {
          const m = Math.max(0, Math.floor((Date.now() - new Date(activeKid.dob ?? '').getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
          return m < 24 ? `${m}mo` : `${Math.floor(m / 12)}y`;
        })()} · ${activeKid.isExpecting ? '0' : vaccines.filter(v => v.status === 'due').length} vaccines due`
    : 'IAP & FOGSI guidelines';

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#1C1033', '#3b1060', '#6d1a7a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />
        <Text style={styles.headerTitle}>Health</Text>
        <Text style={styles.headerSub}>{kidSubtitle}</Text>
      </LinearGradient>

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
              <SchemeCard key={s.id} scheme={s} kid={activeKid} motherName={motherName} />
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
                  {upToDateCount}/{HEALTH_ITEMS.length} up to date
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

            {HEALTH_ITEMS.map((item) => (
              <HealthCheckItem
                key={item.id}
                item={item}
                lastDone={lastDone[item.id] ?? null}
                onMarkDone={() => markDone(item.id)}
                onUndo={() => undoDone(item.id)}
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
  container: { flex: 1, backgroundColor: '#FFF8FC' },
  // Dark header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(232,72,122,0.22)', top: -60, right: -40,
  },
  glowBottomLeft: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(124,58,237,0.18)', bottom: -40, left: -20,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
  },
  infoBannerEmoji: { fontSize: 20 },
  infoBannerText: { fontFamily: Fonts.sansSemiBold, flex: 1, fontSize: 13, color: '#7C3AED' },
  noKidCard: { alignItems: 'center', paddingVertical: 32 },
  noKidEmoji: { fontSize: 40, marginBottom: 12 },
  noKidText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, maxWidth: 240 },
  schemesHeader: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: '#1C1033',
    marginBottom: 14,
  },
  progressCard: { marginBottom: 16 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#1C1033' },
  progressCount: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#E8487A' },
  progressBar: {
    height: 8,
    backgroundColor: '#EDE9F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  disclaimerCard: {
    marginTop: 8,
    backgroundColor: 'rgba(124,58,237,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  disclaimerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  disclaimerText: { fontFamily: Fonts.sansRegular, flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 19 },
});
