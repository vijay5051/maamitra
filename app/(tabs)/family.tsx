import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore, Kid } from '../../store/useProfileStore';
import { useAuthStore } from '../../store/useAuthStore';
import { saveFullProfile } from '../../services/firebase';
import { useActiveKid } from '../../hooks/useActiveKid';
import { MILESTONES } from '../../data/milestones';
import GradientAvatar from '../../components/ui/GradientAvatar';
import GradientButton from '../../components/ui/GradientButton';
import DatePickerField from '../../components/ui/DatePickerField';
import Card from '../../components/ui/Card';
import TagPill from '../../components/ui/TagPill';
import SettingsModal from '../../components/ui/SettingsModal';
import { Fonts } from '../../constants/theme';

// ─── ChildCard ─────────────────────────────────────────────────────────────────

function ChildCard({
  kid,
  isActive,
  onPress,
  index,
}: {
  kid: Kid;
  isActive: boolean;
  onPress: () => void;
  index: number;
}) {
  const dobInFuture = kid.dob ? new Date(kid.dob) > new Date() : false;
  const isActuallyExpecting = kid.isExpecting && dobInFuture;
  const _diffMs = kid.dob ? Date.now() - new Date(kid.dob).getTime() : 0;
  const _months = Math.max(0, Math.floor(_diffMs / (1000 * 60 * 60 * 24 * 30.44)));
  const _weeks = Math.max(0, Math.floor(_diffMs / (1000 * 60 * 60 * 24 * 7)));
  const ageText = isActuallyExpecting
    ? 'Due soon'
    : _months < 1
    ? `${_weeks}w`
    : _months < 24
    ? `${_months}mo`
    : `${Math.floor(_months / 12)}y`;

  // Alternate accent colors per child
  const accentColors: [string, string][] = [
    ['#E8487A', '#7C3AED'],
    ['#7C3AED', '#60A5FA'],
    ['#34D399', '#60A5FA'],
  ];
  const accent = accentColors[index % accentColors.length];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[childCardStyles.card, isActive && childCardStyles.cardActive]}
    >
      {/* Top accent bar */}
      <LinearGradient
        colors={accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={childCardStyles.accentBar}
      />
      <View style={[childCardStyles.inner, isActive && childCardStyles.innerActive]}>
        <View style={[childCardStyles.iconBox, { backgroundColor: `${accent[0]}18` }]}>
          <Ionicons name={isActuallyExpecting ? 'flower-outline' : 'happy-outline'} size={22} color={accent[0]} />
        </View>
        <Text style={[childCardStyles.name, isActive && childCardStyles.nameActive]}>
          {kid.name}
        </Text>
        <Text style={[childCardStyles.age, isActive && { color: accent[0] }]}>
          {ageText}
        </Text>
        {isActive && (
          <View style={[childCardStyles.activeDot, { backgroundColor: accent[0] }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const childCardStyles = StyleSheet.create({
  card: {
    width: 100,
    marginRight: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    backgroundColor: '#ffffff',
    shadowColor: '#E8487A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(232, 72, 122, 0.08)',
  } as any,
  cardActive: {
    borderColor: 'rgba(232,72,122,0.3)',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  accentBar: { height: 3, width: '100%' },
  inner: {
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  innerActive: { backgroundColor: 'rgba(232,72,122,0.03)' },
  iconBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  name: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: '#1C1033', textAlign: 'center' },
  nameActive: { fontFamily: Fonts.sansBold, color: '#1C1033' },
  age: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
});

// ─── MilestoneRow ──────────────────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  reached,
}: {
  milestone: (typeof MILESTONES)[0];
  reached: boolean;
}) {
  return (
    <View style={milestoneStyles.row}>
      <View style={milestoneStyles.dotCol}>
        {reached ? (
          <LinearGradient
            colors={['#E8487A', '#7C3AED']}
            style={milestoneStyles.dotReached}
          />
        ) : (
          <View style={milestoneStyles.dotPending} />
        )}
        <View style={milestoneStyles.connector} />
      </View>
      <View style={milestoneStyles.info}>
        <View style={milestoneStyles.titleRow}>
          <View style={milestoneStyles.iconBox}>
            <Ionicons name="star" size={12} color="#E8487A" />
          </View>
          <Text style={milestoneStyles.title}>{milestone.title}</Text>
          {reached && (
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={milestoneStyles.ageLabel}>{milestone.ageLabel}</Text>
        <Text style={milestoneStyles.desc} numberOfLines={2}>{milestone.description}</Text>
      </View>
    </View>
  );
}

const milestoneStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  dotCol: { alignItems: 'center', paddingTop: 4 },
  dotReached: { width: 12, height: 12, borderRadius: 6 },
  dotPending: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#EDE9F6', backgroundColor: '#FFF8FC' },
  connector: { width: 2, flex: 1, backgroundColor: '#EDE9F6', marginTop: 4, minHeight: 16 },
  info: { flex: 1, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  iconBox: { width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(232,72,122,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  title: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#1C1033' },
  ageLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: '#E8487A', marginBottom: 4 },
  desc: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
});

// ─── AddChildModal ─────────────────────────────────────────────────────────────

function AddChildModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; dob: string; isExpecting: boolean; gender: 'girl' | 'boy' | 'surprise' }) => void;
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isExpecting, setIsExpecting] = useState(false);
  const [gender, setGender] = useState<'girl' | 'boy' | 'surprise'>('surprise');
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const reset = () => {
    setName(''); setDob(''); setDueDate(''); setIsExpecting(false);
    setGender('surprise'); setError('');
  };

  const handleAdd = () => {
    if (!name.trim()) { setError('Please enter a name'); return; }
    if (!isExpecting) {
      if (!dob) { setError('Please select a date of birth'); return; }
      const parsed = new Date(dob + 'T00:00:00');
      if (isNaN(parsed.getTime())) { setError('Invalid date — please tap the calendar to pick one'); return; }
    } else {
      if (!dueDate) { setError('Please select a due date'); return; }
      const parsed = new Date(dueDate + 'T00:00:00');
      if (isNaN(parsed.getTime())) { setError('Invalid due date — please tap the calendar to pick one'); return; }
    }
    const finalDob = isExpecting
      ? new Date(dueDate + 'T00:00:00').toISOString()
      : new Date(dob + 'T00:00:00').toISOString();
    onAdd({ name: name.trim(), dob: finalDob, isExpecting, gender });
    reset();
    onClose();
  };

  const GENDERS: { key: 'boy' | 'girl' | 'surprise'; label: string }[] = [
    { key: 'boy', label: 'Boy 👦' },
    { key: 'girl', label: 'Girl 👧' },
    { key: 'surprise', label: 'Surprise 🎁' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={addChildStyles.overlay}>
        <ScrollView style={addChildStyles.sheet} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={addChildStyles.handle} />
          <View style={addChildStyles.headerRow}>
            <Text style={addChildStyles.title}>Add a Child 👶</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close-circle-outline" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={addChildStyles.label}>NAME</Text>
          <TextInput
            style={addChildStyles.input}
            value={name}
            onChangeText={setName}
            placeholder="Child's name"
            placeholderTextColor="#C4B5D4"
          />

          <Text style={addChildStyles.label}>BORN OR EXPECTING?</Text>
          <View style={addChildStyles.stageRow}>
            <TouchableOpacity
              style={[addChildStyles.stageBtn, !isExpecting && addChildStyles.stageBtnActive]}
              onPress={() => setIsExpecting(false)}
            >
              <Text style={[addChildStyles.stageBtnText, !isExpecting && addChildStyles.stageBtnTextActive]}>
                Born 👶
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[addChildStyles.stageBtn, isExpecting && addChildStyles.stageBtnActive]}
              onPress={() => setIsExpecting(true)}
            >
              <Text style={[addChildStyles.stageBtnText, isExpecting && addChildStyles.stageBtnTextActive]}>
                Expecting 🤰
              </Text>
            </TouchableOpacity>
          </View>

          {!isExpecting ? (
            <>
              <Text style={addChildStyles.label}>DATE OF BIRTH</Text>
              <DatePickerField
                value={dob}
                onChange={setDob}
                placeholder="Tap to select date of birth"
                maxDate={todayStr}
              />
            </>
          ) : (
            <>
              <Text style={addChildStyles.label}>DUE DATE</Text>
              <DatePickerField
                value={dueDate}
                onChange={setDueDate}
                placeholder="Tap to select due date"
                minDate={todayStr}
              />
            </>
          )}

          <Text style={addChildStyles.label}>GENDER</Text>
          <View style={addChildStyles.genderRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[addChildStyles.stageBtn, gender === g.key && addChildStyles.stageBtnActive]}
                onPress={() => setGender(g.key)}
              >
                <Text style={[addChildStyles.stageBtnText, gender === g.key && addChildStyles.stageBtnTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={addChildStyles.errorText}>{error}</Text> : null}

          <GradientButton title="Add Child" onPress={handleAdd} style={{ marginTop: 8 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const addChildStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF8FC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: '#EDE9F6', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontFamily: Fonts.sansBold, fontSize: 20, color: '#1C1033' },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 10, color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    fontFamily: Fonts.sansRegular,
    fontSize: 15,
    color: '#1C1033',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
  },
  stageRow: { flexDirection: 'row', gap: 10 },
  genderRow: { flexDirection: 'row', gap: 8 },
  stageBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
    backgroundColor: '#ffffff',
  },
  stageBtnActive: { borderColor: '#E8487A', backgroundColor: 'rgba(232,72,122,0.06)' },
  stageBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#9CA3AF' },
  stageBtnTextActive: { color: '#E8487A', fontFamily: Fonts.sansBold },
  errorText: { fontFamily: Fonts.sansRegular, color: '#ef4444', fontSize: 12, marginTop: 8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { kids, activeKidId, setActiveKidId, addKid, motherName, profile, completedVaccines } = useProfileStore();
  const { activeKid } = useActiveKid();
  const { user } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const currentAgeMonths = activeKid && activeKid.dob && !activeKid.isExpecting
    ? Math.max(0, Math.floor((Date.now() - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
    : 0;

  const nearestMilestones = (() => {
    if (!activeKid || activeKid.isExpecting) return [];
    // Show milestones near current age (window: -3m to +12m)
    const inWindow = MILESTONES.filter(
      (m) => m.ageMonths >= currentAgeMonths - 3 && m.ageMonths <= currentAgeMonths + 12
    ).slice(0, 6);
    // Fallback: if no milestones in window (e.g. older child beyond data range),
    // show the 3 most recent milestones from the dataset
    if (inWindow.length === 0) {
      return [...MILESTONES]
        .filter((m) => m.ageMonths <= currentAgeMonths)
        .sort((a, b) => b.ageMonths - a.ageMonths)
        .slice(0, 3);
    }
    return inWindow;
  })();

  const milestonesReached = nearestMilestones.filter(m => activeKid && activeKid.ageInMonths >= m.ageMonths).length;
  const milestoneProgress = nearestMilestones.length > 0 ? milestonesReached / nearestMilestones.length : 0;

  const handleAddKid = ({
    name,
    dob,
    isExpecting,
    gender,
  }: {
    name: string;
    dob: string;
    isExpecting: boolean;
    gender: 'girl' | 'boy' | 'surprise';
  }) => {
    addKid({
      name,
      dob,
      stage: isExpecting ? 'pregnant' : 'newborn',
      gender,
      isExpecting,
    });
    if (user?.uid) {
      const updatedState = useProfileStore.getState();
      saveFullProfile(user.uid, {
        motherName: updatedState.motherName,
        profile: updatedState.profile,
        kids: updatedState.kids,
        completedVaccines: updatedState.completedVaccines,
        onboardingComplete: updatedState.onboardingComplete,
      }).catch(console.error);
    }
  };

  const dietLabel = (d?: string) => {
    const map: Record<string, string> = {
      vegetarian: 'Vegetarian 🥦',
      eggetarian: 'Eggetarian 🥚',
      'non-vegetarian': 'Non-Veg 🍗',
      vegan: 'Vegan 🌱',
    };
    return d ? (map[d] ?? d) : '—';
  };

  const familyLabel = (f?: string) => {
    const map: Record<string, string> = {
      nuclear: 'Nuclear Family',
      joint: 'Joint Family',
      'in-laws': 'With In-Laws',
      'single-parent': 'Single Parent',
    };
    return f ? (map[f] ?? f) : '—';
  };

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

        <View style={styles.headerInner}>
          <View>
            <Text style={styles.headerTitle}>My Family</Text>
            <Text style={styles.headerSub}>
              {kids.length === 0
                ? 'Add your first child'
                : `${kids.length} child${kids.length > 1 ? 'ren' : ''} · ${motherName || 'Mom'}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowSettings(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Mom Profile Card (dark gradient) ── */}
        <LinearGradient
          colors={['#1C1033', '#3b1060']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.momCard}
        >
          <View style={styles.momGlowBlob} pointerEvents="none" />
          <View style={styles.momRow}>
            <View style={styles.momAvatarWrap}>
              <GradientAvatar name={motherName || 'M'} size={60} />
              <View style={styles.momGlowRing} />
            </View>
            <View style={styles.momInfo}>
              <Text style={styles.momName}>{motherName || 'Mom'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.momDetail}>{profile?.state || 'India'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.momStatsRow}>
            <View style={styles.momStat}>
              <Text style={styles.momStatValue}>{kids.length}</Text>
              <Text style={styles.momStatLabel}>Children</Text>
            </View>
            <View style={styles.momStatDivider} />
            <View style={styles.momStat}>
              <Text style={styles.momStatValue}>{dietLabel(profile?.diet).split(' ')[0]}</Text>
              <Text style={styles.momStatLabel}>Diet</Text>
            </View>
            <View style={styles.momStatDivider} />
            <View style={styles.momStat}>
              <Text style={styles.momStatValue}>{familyLabel(profile?.familyType).split(' ')[0]}</Text>
              <Text style={styles.momStatLabel}>Family</Text>
            </View>
          </View>
          {(!profile?.diet || !profile?.state || !profile?.familyType) && (
            <TouchableOpacity style={styles.completeNudge} onPress={() => router.push('/(tabs)/community')} activeOpacity={0.8}>
              <Ionicons name="sparkles-outline" size={12} color="#F59E0B" />
              <Text style={styles.completeNudgeText}>Complete your profile</Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* ── Children Section ── */}
        <Text style={styles.sectionTitle}>Children</Text>

        {kids.length === 0 ? (
          <Card style={styles.emptyCard} shadow="sm">
            <View style={styles.emptyIconBox}>
              <Ionicons name="happy-outline" size={30} color="#E8487A" />
            </View>
            <Text style={styles.emptyText}>
              Add your child to get personalised milestones, vaccine schedules, and more!
            </Text>
            <GradientButton
              title="Add First Child"
              onPress={() => setShowAddModal(true)}
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kidsRow}
          >
            {kids.map((kid, index) => (
              <ChildCard
                key={kid.id}
                kid={kid}
                isActive={kid.id === activeKidId}
                onPress={() => setActiveKidId(kid.id)}
                index={index}
              />
            ))}
            {/* Dashed add button */}
            <TouchableOpacity
              style={styles.addKidBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.addKidInner}>
                <Ionicons name="add" size={26} color="#E8487A" />
                <Text style={styles.addKidText}>Add</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Milestones ── */}
        {activeKid && !activeKid.isExpecting && nearestMilestones.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Milestones · {activeKid.name}</Text>
              <View style={styles.progressBadge}>
                <Text style={styles.progressBadgeText}>
                  {milestonesReached}/{nearestMilestones.length}
                </Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.milestoneProgressBg}>
              <LinearGradient
                colors={['#E8487A', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.milestoneProgressFill, { width: `${milestoneProgress * 100}%` }]}
              />
            </View>
            <Card style={styles.milestonesCard} shadow="sm">
              {nearestMilestones.map((m) => (
                <MilestoneRow
                  key={m.id}
                  milestone={m}
                  reached={activeKid.ageInMonths >= m.ageMonths}
                />
              ))}
            </Card>
          </>
        )}

        {activeKid?.isExpecting && (
          <Card style={styles.expectingCard} shadow="sm">
            <Text style={styles.expectingEmoji}>🤰</Text>
            <Text style={styles.expectingTitle}>Milestones Coming Soon</Text>
            <Text style={styles.expectingText}>
              Milestones will appear after {activeKid.name} arrives!{'\n'}
              For now, explore the Health tab for your pregnancy schedule.
            </Text>
          </Card>
        )}

      </ScrollView>

      <AddChildModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddKid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8FC' },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  glowTopRight: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(232,72,122,0.22)', top: -60, right: -50,
  },
  glowBottomLeft: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(124,58,237,0.18)', bottom: -50, left: -30,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: 16, paddingTop: 20 },

  // ── Mom Card ──
  momCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#1C1033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    boxShadow: '0px 4px 16px rgba(28, 16, 51, 0.2)',
  } as any,
  momGlowBlob: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(232,72,122,0.15)', top: -40, right: -30,
  },
  momRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  momAvatarWrap: { position: 'relative' },
  momGlowRing: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: 33, borderWidth: 2, borderColor: 'rgba(232,72,122,0.5)',
  },
  momInfo: { flex: 1 },
  momName: { fontFamily: Fonts.serif, fontSize: 22, color: '#ffffff', marginBottom: 4 },
  momDetail: { fontFamily: Fonts.sansRegular, fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  momStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  momStat: { flex: 1, alignItems: 'center' },
  momStatValue: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#ffffff', marginBottom: 2 },
  momStatLabel: { fontFamily: Fonts.sansRegular, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  momStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 4 },

  // ── Section ──
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: '#1C1033',
    marginBottom: 12,
    marginTop: 4,
  },
  progressBadge: {
    backgroundColor: 'rgba(232,72,122,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(232,72,122,0.2)',
  },
  progressBadgeText: { fontFamily: Fonts.sansBold, fontSize: 11, color: '#E8487A' },
  milestoneProgressBg: {
    height: 4, backgroundColor: '#EDE9F6', borderRadius: 2, marginBottom: 12, overflow: 'hidden',
  },
  milestoneProgressFill: { height: '100%', borderRadius: 2 },

  // ── Children ──
  kidsRow: { paddingBottom: 20, paddingLeft: 2, paddingRight: 16 },
  addKidBtn: {
    width: 100,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(232,72,122,0.3)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  } as any,
  addKidInner: {
    flex: 1, minHeight: 115,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,72,122,0.03)',
    gap: 4,
  },
  addKidText: { fontFamily: Fonts.sansSemiBold, color: '#E8487A', fontSize: 12 },

  // ── Empty / expecting ──
  emptyCard: { alignItems: 'center', paddingVertical: 32, marginBottom: 20 },
  emptyIconBox: { width: 66, height: 66, borderRadius: 20, backgroundColor: 'rgba(232,72,122,0.09)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, alignSelf: 'center' },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  milestonesCard: { marginBottom: 24, paddingTop: 20 },
  expectingCard: { alignItems: 'center', paddingVertical: 32, marginBottom: 20 },
  expectingEmoji: { fontSize: 40, marginBottom: 12 },
  expectingTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#1C1033', marginBottom: 8 },
  expectingText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  // ── Profile completeness nudge ──
  completeNudge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  completeNudgeText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1 },

  // ── Action card ──
  actionCard: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  actionCardGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1, borderColor: 'rgba(232,72,122,0.12)', borderRadius: 16,
  },
  actionCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionCardEmoji: { fontSize: 28 },
  actionCardTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#1C1033', marginBottom: 2 },
  actionCardSub: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF' },
  actionCardArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(232,72,122,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
});
