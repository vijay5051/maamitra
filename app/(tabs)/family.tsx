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
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore, Kid, calculateAgeInMonths, calculateAgeInWeeks } from '../../store/useProfileStore';
import { useActiveKid } from '../../hooks/useActiveKid';
import { MILESTONES } from '../../data/milestones';
import GradientHeader from '../../components/ui/GradientHeader';
import GradientAvatar from '../../components/ui/GradientAvatar';
import GradientButton from '../../components/ui/GradientButton';
import Card from '../../components/ui/Card';
import TagPill from '../../components/ui/TagPill';

// ─── ChildCard ─────────────────────────────────────────────────────────────────

function ChildCard({
  kid,
  isActive,
  onPress,
}: {
  kid: Kid;
  isActive: boolean;
  onPress: () => void;
}) {
  // Safety guard: if DOB is in the past, never show "Due soon"
  const dobInFuture = kid.dob ? new Date(kid.dob) > new Date() : false;
  const isActuallyExpecting = kid.isExpecting && dobInFuture;
  const ageText = isActuallyExpecting
    ? 'Due soon'
    : kid.ageInMonths < 1
    ? `${kid.ageInWeeks}w`
    : kid.ageInMonths < 24
    ? `${kid.ageInMonths}mo`
    : `${Math.floor(kid.ageInMonths / 12)}y`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        childCardStyles.card,
        isActive && childCardStyles.cardActive,
      ]}
    >
      {isActive ? (
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={childCardStyles.gradient}
        >
          <Text style={childCardStyles.emoji}>
            {isActuallyExpecting ? '🤰' : '👶'}
          </Text>
          <Text style={childCardStyles.nameActive}>{kid.name}</Text>
          <Text style={childCardStyles.ageActive}>{ageText}</Text>
        </LinearGradient>
      ) : (
        <View style={childCardStyles.inner}>
          <Text style={childCardStyles.emoji}>
            {isActuallyExpecting ? '🤰' : '👶'}
          </Text>
          <Text style={childCardStyles.name}>{kid.name}</Text>
          <Text style={childCardStyles.age}>{ageText}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const childCardStyles = StyleSheet.create({
  card: {
    width: 100,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.08)',
  },
  cardActive: {
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  gradient: {
    padding: 16,
    alignItems: 'center',
  },
  inner: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  emoji: { fontSize: 28, marginBottom: 6 },
  name: { fontSize: 13, fontWeight: '600', color: '#1a1a2e', textAlign: 'center' },
  nameActive: { fontSize: 13, fontWeight: '700', color: '#ffffff', textAlign: 'center' },
  age: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  ageActive: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
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
      <View style={[milestoneStyles.dot, reached ? milestoneStyles.dotReached : milestoneStyles.dotPending]} />
      <View style={milestoneStyles.info}>
        <View style={milestoneStyles.titleRow}>
          <Text style={milestoneStyles.emoji}>{milestone.emoji}</Text>
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
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    flexShrink: 0,
  },
  dotReached: { backgroundColor: '#22c55e' },
  dotPending: { backgroundColor: '#e5e7eb', borderWidth: 2, borderColor: '#d1d5db' },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  emoji: { fontSize: 16, marginRight: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  ageLabel: { fontSize: 12, color: '#ec4899', fontWeight: '600', marginBottom: 4 },
  desc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
});

// ─── AddChildModal ─────────────────────────────────────────────────────────────

function AddChildModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; dob: string; isExpecting: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [isExpecting, setIsExpecting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setName(''); setDob(''); setIsExpecting(false); setError(''); };

  const handleAdd = () => {
    if (!name.trim()) { setError('Please enter a name'); return; }
    if (!isExpecting && !dob.trim()) { setError('Please enter a date of birth'); return; }
    onAdd({ name: name.trim(), dob: isExpecting ? new Date().toISOString() : new Date(dob).toISOString(), isExpecting });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={addChildStyles.overlay}>
        <View style={addChildStyles.sheet}>
          <View style={addChildStyles.headerRow}>
            <Text style={addChildStyles.title}>Add a Child 👶</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close-circle-outline" size={26} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <Text style={addChildStyles.label}>Name</Text>
          <TextInput
            style={addChildStyles.input}
            value={name}
            onChangeText={setName}
            placeholder="Child's name"
            placeholderTextColor="#9ca3af"
          />

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

          {!isExpecting && (
            <>
              <Text style={addChildStyles.label}>Date of Birth</Text>
              <TextInput
                style={addChildStyles.input}
                value={dob}
                onChangeText={setDob}
                placeholder="e.g. 2024-06-15"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}

          {error ? <Text style={addChildStyles.errorText}>{error}</Text> : null}

          <GradientButton title="Add Child" onPress={handleAdd} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
  );
}

const addChildStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e' },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  stageRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stageBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  stageBtnActive: { borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.08)' },
  stageBtnText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  stageBtnTextActive: { color: '#ec4899' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const { kids, activeKidId, setActiveKidId, addKid, motherName, profile } = useProfileStore();
  const { activeKid } = useActiveKid();
  const [showAddModal, setShowAddModal] = useState(false);

  const nearestMilestones = activeKid && !activeKid.isExpecting
    ? MILESTONES.filter(
        (m) =>
          m.ageMonths >= activeKid.ageInMonths - 2 &&
          m.ageMonths <= activeKid.ageInMonths + 8
      ).slice(0, 6)
    : [];

  const handleAddKid = ({
    name,
    dob,
    isExpecting,
  }: {
    name: string;
    dob: string;
    isExpecting: boolean;
  }) => {
    addKid({
      name,
      dob,
      stage: isExpecting ? 'pregnant' : 'newborn',
      gender: 'surprise',
      isExpecting,
    });
  };

  const dietLabel = (d?: string) => {
    const map: Record<string, string> = {
      vegetarian: 'Vegetarian 🥦',
      eggetarian: 'Eggetarian 🥚',
      'non-vegetarian': 'Non-Vegetarian 🍗',
      vegan: 'Vegan 🌱',
    };
    return d ? (map[d] ?? d) : 'Not set';
  };

  const familyLabel = (f?: string) => {
    const map: Record<string, string> = {
      nuclear: 'Nuclear Family',
      joint: 'Joint Family',
      'in-laws': 'Living with In-Laws',
      'single-parent': 'Single Parent',
    };
    return f ? (map[f] ?? f) : 'Not set';
  };

  return (
    <View style={styles.container}>
      <GradientHeader title="My Family 👨‍👩‍👧" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Children section */}
        <Text style={styles.sectionTitle}>Children</Text>

        {kids.length === 0 ? (
          <Card style={styles.emptyCard} shadow="sm">
            <Text style={styles.emptyEmoji}>👶</Text>
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
            {kids.map((kid) => (
              <ChildCard
                key={kid.id}
                kid={kid}
                isActive={kid.id === activeKidId}
                onPress={() => setActiveKidId(kid.id)}
              />
            ))}
            {/* Add another button */}
            <TouchableOpacity
              style={styles.addKidBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={28} color="#ec4899" />
              <Text style={styles.addKidText}>Add</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Milestones section */}
        {activeKid && !activeKid.isExpecting && nearestMilestones.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Milestones for {activeKid.name}
            </Text>
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
            <Text style={styles.expectingText}>
              Milestones will appear after {activeKid.name} arrives!{'\n'}
              For now, explore the Health tab for your pregnancy schedule.
            </Text>
          </Card>
        )}

        {/* Mother profile card */}
        <Text style={styles.sectionTitle}>My Profile</Text>
        <LinearGradient
          colors={['#fdf2f8', '#ede9fe']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileCard}
        >
          <View style={styles.profileRow}>
            <GradientAvatar name={motherName || 'M'} size={56} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{motherName || 'Mom'}</Text>
              <Text style={styles.profileDetail}>📍 {profile?.state || 'Location not set'}</Text>
            </View>
          </View>
          <View style={styles.profileTags}>
            <TagPill label={dietLabel(profile?.diet)} color="#22c55e" style={{ marginRight: 6 }} />
            <TagPill label={familyLabel(profile?.familyType)} color="#8b5cf6" />
          </View>
        </LinearGradient>
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
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
    marginTop: 4,
  },
  kidsRow: {
    paddingBottom: 20,
    paddingLeft: 2,
    paddingRight: 16,
  },
  addKidBtn: {
    width: 100,
    height: '100%',
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ec4899',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,72,153,0.04)',
    gap: 4,
  },
  addKidText: { color: '#ec4899', fontSize: 12, fontWeight: '600' },
  emptyCard: { alignItems: 'center', paddingVertical: 32, marginBottom: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  milestonesCard: { marginBottom: 24, paddingTop: 20 },
  expectingCard: { alignItems: 'center', paddingVertical: 32, marginBottom: 20 },
  expectingEmoji: { fontSize: 40, marginBottom: 12 },
  expectingText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  profileCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    boxShadow: '0px 2px 12px rgba(236, 72, 153, 0.08)',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  profileInfo: {},
  profileName: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  profileDetail: { fontSize: 14, color: '#6b7280' },
  profileTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
