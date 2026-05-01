import React, { useState, useEffect } from 'react';
import {
  Image,
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
import { filterByAudience, parentGenderToAudience } from '../../data/audience';
import GradientButton from '../../components/ui/GradientButton';
import DatePickerField from '../../components/ui/DatePickerField';
import Card from '../../components/ui/Card';
import TagPill from '../../components/ui/TagPill';
import SettingsModal from '../../components/ui/SettingsModal';
import NotificationsSheet from '../../components/community/NotificationsSheet';
import ConversationsSheet from '../../components/community/ConversationsSheet';
import ContextualAskChip from '../../components/ui/ContextualAskChip';
import { Illustration } from '../../components/ui/Illustration';
import { AppIcon } from '../../components/ui/AppIcon';
import { useSocialStore } from '../../store/useSocialStore';
import { useDMStore } from '../../store/useDMStore';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

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

  // Single brand accent for every child card — previously rotated through
  // three gender-coded gradients which read as rainbow noise next to the
  // rest of the refreshed UI.
  const accent = Colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[childCardStyles.card, isActive && childCardStyles.cardActive]}
    >
      <View style={[childCardStyles.inner, isActive && childCardStyles.innerActive]}>
        {kid.photoUrl ? (
          <Image source={{ uri: kid.photoUrl }} style={childCardStyles.photoAvatar} />
        ) : (
          <View style={[childCardStyles.iconBox, isActive && { backgroundColor: '#F5F0FF' }]}>
            <AppIcon
              name={
                isActuallyExpecting
                  ? 'object.heart'
                  : kid.gender === 'boy'
                  ? 'object.gender-boy'
                  : kid.gender === 'girl'
                  ? 'object.gender-girl'
                  : 'object.gender-other'
              }
              size={20}
              color={isActive ? accent : '#6b7280'}
            />
          </View>
        )}
        <Text style={[childCardStyles.name, isActive && childCardStyles.nameActive]}>
          {kid.name}
        </Text>
        <Text style={[childCardStyles.age, isActive && { color: accent }]}>
          {ageText}
        </Text>
        {isActive && (
          <View style={[childCardStyles.activeDot, { backgroundColor: accent }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const childCardStyles = StyleSheet.create({
  card: {
    width: 100,
    marginRight: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E1EE',
    backgroundColor: Colors.cardBg,
  } as any,
  cardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
  },
  innerActive: { backgroundColor: '#FAF7FF' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#F5F0FF',
  },
  photoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  name: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: '#1C1033', textAlign: 'center' },
  nameActive: { fontFamily: Fonts.sansBold, color: '#1C1033' },
  age: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#9ca3af', marginTop: 2 },
  activeDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
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
            colors={[Colors.primary, Colors.primary]}
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
            <AppIcon name="object.star" size={12} color={Colors.primary} />
          </View>
          <Text style={milestoneStyles.title}>{milestone.title}</Text>
          {reached && (
            <AppIcon name="status.success" size={16} color="#22c55e" style={{ marginLeft: 4 }} />
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
  dotPending: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#EDE9F6', backgroundColor: Colors.bgLight },
  connector: { width: 2, flex: 1, backgroundColor: '#EDE9F6', marginTop: 4, minHeight: 16 },
  info: { flex: 1, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  iconBox: { width: 22, height: 22, borderRadius: 6, backgroundColor: 'rgba(28, 16, 51, 0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  title: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#1C1033' },
  ageLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: Colors.primary, marginBottom: 4 },
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

  useEffect(() => {
    if (!visible) reset();
  }, [visible]);

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
      if (parsed <= new Date()) { setError('Due date must be in the future for an expecting baby'); return; }
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
              <AppIcon name="nav.close-circle-outline" size={26} />
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
    backgroundColor: Colors.bgLight,
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
    backgroundColor: Colors.cardBg,
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
    backgroundColor: Colors.cardBg,
  },
  stageBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(28, 16, 51, 0.036)' },
  stageBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#9CA3AF' },
  stageBtnTextActive: { color: Colors.primary, fontFamily: Fonts.sansBold },
  errorText: { fontFamily: Fonts.sansRegular, color: '#ef4444', fontSize: 12, marginTop: 8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { kids, activeKidId, setActiveKidId, addKid, motherName } = useProfileStore();
  const { activeKid } = useActiveKid();
  const { user } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [settingsView, setSettingsView] = useState<null | 'edit-profile' | 'edit-kid'>(null);
  const [editingKidId, setEditingKidId] = useState<string | null>(null);

  // Badges for the new global header icons (same store as Home & Community).
  const socialUnread = useSocialStore((s) => s.unreadCount);
  const loadNotifications = useSocialStore((s) => s.loadNotifications);
  const unreadDMs = useDMStore((s) => s.unreadTotal);
  const loadDMUnreadCount = useDMStore((s) => s.loadUnreadCount);
  useEffect(() => {
    if (user?.uid) {
      loadNotifications();
      loadDMUnreadCount();
    }
  }, [user?.uid]);

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
        photoUrl: updatedState.photoUrl || '',
        parentGender: updatedState.parentGender || '',
        bio: updatedState.bio || '',
        expertise: updatedState.expertise || [],
        visibilitySettings: updatedState.visibilitySettings,
      }).catch(console.error);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFFFFF']}
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
            {/* Family-specific: add child */}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
              accessibilityLabel="Add child"
            >
              <AppIcon name="action.add" size={20} color="#ffffff" />
            </TouchableOpacity>

            {/* Global: notifications → messages. Family owns child
                management; profile/privacy stay under Settings from the menu. */}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowNotifications(true)}
              activeOpacity={0.75}
              accessibilityLabel="Notifications"
            >
              <AppIcon name="nav.notifications" size={18} color="#6b7280" />
              {socialUnread > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{socialUnread > 9 ? '9+' : socialUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowMessages(true)}
              activeOpacity={0.75}
              accessibilityLabel="Messages"
            >
              <AppIcon name="nav.messages" size={18} color="#6b7280" />
              {unreadDMs > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadDMs > 9 ? '9+' : unreadDMs}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <SettingsModal
        visible={settingsView !== null}
        onClose={() => {
          setSettingsView(null);
          setEditingKidId(null);
        }}
        initialView={settingsView === 'edit-kid' ? 'edit-kid' : settingsView === 'edit-profile' ? 'edit-profile' : 'main'}
        initialKidId={editingKidId}
      />
      <NotificationsSheet
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onViewProfile={() => {
          // Family tab doesn't have its own UserProfileModal instance.
          // Route to the Community tab where a tap on any avatar opens it.
          setShowNotifications(false);
          router.push('/(tabs)/community');
        }}
      />
      <ConversationsSheet
        visible={showMessages}
        onClose={() => setShowMessages(false)}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Children</Text>
        <Text style={styles.sectionSub}>
          Add, switch, and update each child here. Milestones and routines now live inside Health.
        </Text>

        {kids.length === 0 ? (
          <Card style={styles.emptyCard} shadow="sm">
            <Illustration name="emptyFamily" style={styles.emptyIllus} contentFit="contain" />
            <Text style={styles.emptyText}>
              Add your child here to personalise Health, vaccines, milestones, and chat guidance.
            </Text>
            <GradientButton
              title="Add First Child"
              onPress={() => setShowAddModal(true)}
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : (
          <>
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
              <TouchableOpacity
                style={styles.addKidBtn}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.75}
              >
                <View style={styles.addKidInner}>
                  <AppIcon name="action.add" size={26} />
                  <Text style={styles.addKidText}>Add</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            {activeKid ? (
              <Card style={styles.manageCard} shadow="sm">
                <View style={styles.manageHeader}>
                  <View style={styles.manageIdentity}>
                    {activeKid.photoUrl ? (
                      <Image source={{ uri: activeKid.photoUrl }} style={styles.managePhoto} />
                    ) : (
                      <View style={styles.managePhotoFallback}>
                        <Text style={styles.managePhotoFallbackText}>
                          {(activeKid.name || 'B').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manageTitle}>{activeKid.name || 'Your child'}</Text>
                      <Text style={styles.manageMeta}>
                        {activeKid.isExpecting
                          ? 'Expecting'
                          : activeKid.dob
                          ? (() => {
                              const months = Math.max(
                                0,
                                Math.floor((Date.now() - new Date(activeKid.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
                              );
                              return months < 24 ? `${months} months old` : `${Math.floor(months / 12)} years old`;
                            })()
                          : 'Child profile'}
                        {' · '}
                        {activeKid.gender === 'surprise'
                          ? 'Surprise'
                          : activeKid.gender.charAt(0).toUpperCase() + activeKid.gender.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                </View>
                <Text style={styles.manageHint}>
                  Update photo, name, date of birth, gender, or remove this child from MaaMitra.
                </Text>
                <View style={styles.manageActions}>
                  <TouchableOpacity
                    style={styles.managePrimaryBtn}
                    activeOpacity={0.82}
                    onPress={() => {
                      setEditingKidId(activeKid.id);
                      setSettingsView('edit-kid');
                    }}
                  >
                    <Text style={styles.managePrimaryBtnText}>Edit child details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.manageSecondaryBtn}
                    activeOpacity={0.82}
                    onPress={() => setShowAddModal(true)}
                  >
                    <Text style={styles.manageSecondaryBtnText}>Add another child</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}
          </>
        )}

        <Text style={styles.sectionTitle}>You</Text>
        <Card style={styles.profileManageCard} shadow="sm">
          <Text style={styles.profileManageTitle}>Your profile and privacy</Text>
          <Text style={styles.profileManageText}>
            Update your name, photo, state, bio, and privacy controls from one place.
          </Text>
          <TouchableOpacity
            style={styles.profileManageBtn}
            activeOpacity={0.82}
            onPress={() => setSettingsView('edit-profile')}
          >
            <Text style={styles.profileManageBtnText}>Edit your profile</Text>
          </TouchableOpacity>
        </Card>

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
  container: { flex: 1, backgroundColor: Colors.bgLight },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  glowTopRight: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'transparent', top: -60, right: -50,
  },
  glowBottomLeft: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'transparent', bottom: -50, left: -30,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: '#1C1033',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: '#6b7280',
    marginTop: 3,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F5F0FF',
    borderWidth: 1, borderColor: '#E5E1EE',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#1C1033',
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },

  content: { paddingHorizontal: 16, paddingTop: 20 },

  // ── Section ──
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  milestoneHeaderMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  milestoneKidPhoto: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6' },
  milestoneKidFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(28, 16, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneKidFallbackText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.primary },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: '#1C1033',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionSub: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: -6,
    marginBottom: 14,
  },
  progressBadge: {
    backgroundColor: 'rgba(28, 16, 51, 0.06)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(28, 16, 51, 0.12)',
  },
  progressBadgeText: { fontFamily: Fonts.sansBold, fontSize: 11, color: Colors.primary },
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
    borderColor: 'rgba(28, 16, 51, 0.18)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  } as any,
  addKidInner: {
    flex: 1, minHeight: 115,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(28, 16, 51, 0.018)',
    gap: 4,
  },
  addKidText: { fontFamily: Fonts.sansSemiBold, color: Colors.primary, fontSize: 12 },
  manageCard: { marginBottom: 22 },
  manageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  manageIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  managePhoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F3F4F6' },
  managePhotoFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(28, 16, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managePhotoFallbackText: { fontFamily: Fonts.sansBold, fontSize: 18, color: Colors.primary },
  manageTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#1C1033' },
  manageMeta: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#8B93A6', marginTop: 3 },
  activeBadge: {
    borderRadius: 999,
    backgroundColor: Colors.primaryAlpha08,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeBadgeText: { fontFamily: Fonts.sansBold, fontSize: 11, color: Colors.primary },
  manageHint: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 14,
  },
  manageActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  managePrimaryBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  managePrimaryBtnText: { fontFamily: Fonts.sansBold, fontSize: 13, color: '#ffffff' },
  manageSecondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5DDF1',
    backgroundColor: '#ffffff',
  },
  manageSecondaryBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: '#1C1033' },
  profileManageCard: { marginBottom: 12 },
  profileManageTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#1C1033', marginBottom: 6 },
  profileManageText: { fontFamily: Fonts.sansRegular, fontSize: 13, color: '#6B7280', lineHeight: 20 },
  profileManageBtn: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5DDF1',
    backgroundColor: '#ffffff',
    paddingVertical: 13,
    alignItems: 'center',
  },
  profileManageBtnText: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary },

  // ── Empty / expecting ──
  emptyCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 20 },
  emptyIconBox: { width: 66, height: 66, borderRadius: 20, backgroundColor: 'rgba(28, 16, 51, 0.054)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, alignSelf: 'center' },
  emptyIllus: { width: 200, height: 160, marginBottom: 8 },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, maxWidth: 260 },
  milestonesCard: { marginBottom: 24, paddingTop: 20 },
  expectingCard: { alignItems: 'center', paddingVertical: 32, marginBottom: 20 },
  expectingEmoji: { fontSize: 40, marginBottom: 12 },
  expectingTitle: { fontFamily: Fonts.sansBold, fontSize: 16, color: '#1C1033', marginBottom: 8 },
  expectingText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },


  // ── Action card ──
  actionCard: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  actionCardGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1, borderColor: 'rgba(28, 16, 51, 0.072)', borderRadius: 16,
  },
  actionCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionCardEmoji: { fontSize: 28 },
  actionCardTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#1C1033', marginBottom: 2 },
  actionCardSub: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#9CA3AF' },
  actionCardArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(28, 16, 51, 0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
});
