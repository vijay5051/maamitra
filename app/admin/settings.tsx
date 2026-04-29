import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppSettingsStore } from '../../store/useAppSettingsStore';
import { useEffect } from 'react';
import { updateAppSettings, getAppSettings } from '../../services/firebase';
import { listAdminMembers, setUserAdminRole, AdminMember } from '../../services/admin';
import { ADMIN_ROLE_LABELS, AdminRole, ADMIN_ROLES } from '../../lib/admin';
import { useAdminRole } from '../../lib/useAdminRole';
import { logAdminAction } from '../../services/audit';
import { confirmAction, infoAlert } from '../../lib/cross-platform-alerts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TabConfig {
  key: string;
  label: string;
  icon: string;
  visible: boolean;
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        <View style={styles.toggleIcon}>
          <Ionicons name={icon as any} size={16} color={Colors.primary} />
        </View>
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#e5e7eb', true: '#fbcfe8' }}
        thumbColor={value ? Colors.primary : '#9ca3af'}
        ios_backgroundColor="#e5e7eb"
      />
    </View>
  );
}

// ─── Color Row ────────────────────────────────────────────────────────────────

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.colorRow}>
      <Text style={styles.colorLabel}>{label}</Text>
      <View style={styles.colorRight}>
        <View style={[styles.colorCircle, { backgroundColor: value || Colors.primary }]} />
        <TextInput
          style={styles.colorInput}
          value={value}
          onChangeText={onChange}
          placeholder={Colors.primary}
          placeholderTextColor="#d1d5db"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
        />
      </View>
    </View>
  );
}

// ─── Tab Config Row ───────────────────────────────────────────────────────────

function TabConfigRow({
  tab,
  index,
  total,
  onLabelChange,
  onVisibleChange,
  onMoveUp,
  onMoveDown,
}: {
  tab: TabConfig;
  index: number;
  total: number;
  onLabelChange: (v: string) => void;
  onVisibleChange: (v: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <View style={styles.tabConfigRow}>
      <View style={styles.tabConfigOrder}>
        <TouchableOpacity onPress={onMoveUp} disabled={index === 0} style={styles.arrowBtn}>
          <Ionicons name="chevron-up" size={14} color={index === 0 ? '#d1d5db' : Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.tabConfigIndex}>{index + 1}</Text>
        <TouchableOpacity onPress={onMoveDown} disabled={index === total - 1} style={styles.arrowBtn}>
          <Ionicons name="chevron-down" size={14} color={index === total - 1 ? '#d1d5db' : Colors.primary} />
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.tabConfigLabel}
        value={tab.label}
        onChangeText={onLabelChange}
        placeholder="Tab label"
        placeholderTextColor="#d1d5db"
      />
      <Switch
        value={tab.visible}
        onValueChange={onVisibleChange}
        trackColor={{ false: '#e5e7eb', true: '#fbcfe8' }}
        thumbColor={tab.visible ? Colors.primary : '#9ca3af'}
        ios_backgroundColor="#e5e7eb"
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
    </View>
  );
}

// ─── Notification Text Row ────────────────────────────────────────────────────

function NotifRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.notifRow}>
      <Text style={styles.notifLabel}>{label}</Text>
      <TextInput
        style={styles.notifInput}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor="#d1d5db"
        multiline
        numberOfLines={2}
      />
    </View>
  );
}

// ─── Default Settings ─────────────────────────────────────────────────────────

const DEFAULT_FEATURES = {
  community: true,
  library: true,
  wellness: true,
  health: true,
  family: true,
};

const DEFAULT_TABS: TabConfig[] = [
  { key: 'chat', label: 'Chat', icon: 'chatbubble-outline', visible: true },
  { key: 'community', label: 'Community', icon: 'people-outline', visible: true },
  { key: 'library', label: 'Library', icon: 'book-outline', visible: true },
  { key: 'wellness', label: 'Wellness', icon: 'heart-outline', visible: true },
  { key: 'health', label: 'Health', icon: 'medical-outline', visible: true },
];

const DEFAULT_NOTIFS = {
  welcome: 'Welcome to MaaMitra! Your pregnancy companion is here. 🤱',
  vaccine: "Your baby's vaccine is due soon. Stay on track with the health schedule!",
  mood: 'How are you feeling today? Take a moment to check in with yourself. 💕',
};

// ─── Releases ────────────────────────────────────────────────────────────────
// All deploys live in GitHub Actions: pushing to main auto-ships web + OTA;
// native builds are a 1-click "Run workflow" in the GH Actions UI. These rows
// are deep-link shortcuts so you don't need to dig through GitHub's nav.

const GH_REPO = 'https://github.com/vijay5051/maamitra';
const RELEASE_LINKS = [
  {
    key: 'deploy',
    label: 'Push OTA + redeploy web',
    sub: 'Re-runs the latest deploy workflow against main.',
    icon: 'cloud-upload-outline',
    url: `${GH_REPO}/actions/workflows/deploy-web.yml`,
  },
  {
    key: 'ota-only',
    label: 'OTA-only update',
    sub: 'Ship a JS update without redeploying the web bundle.',
    icon: 'flash-outline',
    url: `${GH_REPO}/actions/workflows/ota-update.yml`,
  },
  {
    key: 'native',
    label: 'Build native app (Android / iOS)',
    sub: 'Pick a platform → produces a new AAB / IPA on EAS.',
    icon: 'phone-portrait-outline',
    url: `${GH_REPO}/actions/workflows/build-mobile.yml`,
  },
  {
    key: 'eas-builds',
    label: 'EAS build dashboard',
    sub: 'Watch in-flight builds, download artifacts.',
    icon: 'bar-chart-outline',
    url: 'https://expo.dev/accounts/rockingvsr/projects/maamitra/builds',
  },
  {
    key: 'eas-updates',
    label: 'OTA update history',
    sub: 'Roll back, inspect runtime versions.',
    icon: 'time-outline',
    url: 'https://expo.dev/accounts/rockingvsr/projects/maamitra/updates',
  },
] as const;

function ReleaseRow({
  label,
  sub,
  icon,
  url,
}: {
  label: string;
  sub: string;
  icon: string;
  url: string;
}) {
  return (
    <TouchableOpacity
      style={styles.releaseRow}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
    >
      <View style={styles.releaseIcon}>
        <Ionicons name={icon as any} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.releaseLabel}>{label}</Text>
        <Text style={styles.releaseSub}>{sub}</Text>
      </View>
      <Ionicons name="open-outline" size={14} color="#9ca3af" />
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminSettings() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const settingsStore = useAppSettingsStore();

  // Feature Flags
  const [features, setFeatures] = useState<Record<string, boolean>>(
    (settingsStore as any).features ?? DEFAULT_FEATURES
  );

  // Theme
  const [primaryColor, setPrimaryColor] = useState<string>(
    (settingsStore as any).primaryColor ?? Colors.primary
  );
  const [secondaryColor, setSecondaryColor] = useState<string>(
    (settingsStore as any).secondaryColor ?? '#8b5cf6'
  );

  // Tabs
  const [tabs, setTabs] = useState<TabConfig[]>(
    (settingsStore as any).tabs ?? DEFAULT_TABS
  );

  // Notifications
  const [notifs, setNotifs] = useState<Record<string, string>>(
    (settingsStore as any).notificationTexts ?? DEFAULT_NOTIFS
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL;

  function moveTab(index: number, direction: 'up' | 'down') {
    const newTabs = [...tabs];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newTabs[index], newTabs[swapIndex]] = [newTabs[swapIndex], newTabs[index]];
    setTabs(newTabs);
  }

  function updateTabLabel(index: number, label: string) {
    const newTabs = [...tabs];
    newTabs[index] = { ...newTabs[index], label };
    setTabs(newTabs);
  }

  function updateTabVisible(index: number, visible: boolean) {
    const newTabs = [...tabs];
    newTabs[index] = { ...newTabs[index], visible };
    setTabs(newTabs);
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      if (typeof (settingsStore as any).updateSettings === 'function') {
        await (settingsStore as any).updateSettings({
          features,
          primaryColor,
          secondaryColor,
          tabs,
          notificationTexts: notifs,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      Alert.alert('Error', 'Failed to save settings. Check your Firebase connection.');
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Sign out of admin?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(tabs)/chat');
        },
      },
    ]);
  }

  const featureRows: { key: string; label: string; icon: string }[] = [
    { key: 'community', label: 'Community Tab', icon: 'people-outline' },
    { key: 'library', label: 'Library Tab', icon: 'book-outline' },
    { key: 'wellness', label: 'Wellness Tab', icon: 'heart-outline' },
    { key: 'health', label: 'Health Tab', icon: 'medical-outline' },
    { key: 'family', label: 'Family Tab', icon: 'home-outline' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Section 1: Feature Flags */}
      <Section title="Feature Flags">
        {featureRows.map((row, i) => (
          <View key={row.key}>
            <ToggleRow
              label={row.label}
              icon={row.icon}
              value={features[row.key] ?? true}
              onChange={(v) => setFeatures({ ...features, [row.key]: v })}
            />
            {i < featureRows.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Section>

      {/* Section 1b: % Rollout — gradual feature exposure by uid bucket */}
      <RolloutSection featureRows={featureRows} />

      {/* Section 1c: Admin team — RBAC */}
      <AdminTeamSection />

      {/* Section 2: App Theme */}
      <Section title="App Theme">
        <ColorRow label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
        <View style={styles.divider} />
        <ColorRow label="Secondary Color" value={secondaryColor} onChange={setSecondaryColor} />
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => { setPrimaryColor(Colors.primary); setSecondaryColor('#8b5cf6'); }}
        >
          <Ionicons name="refresh" size={14} color="#9ca3af" />
          <Text style={styles.resetBtnText}>Reset to Defaults</Text>
        </TouchableOpacity>
      </Section>

      {/* Section 3: Tab Configuration */}
      <Section title="Tab Configuration">
        {tabs.map((tab, index) => (
          <View key={tab.key}>
            <TabConfigRow
              tab={tab}
              index={index}
              total={tabs.length}
              onLabelChange={(v) => updateTabLabel(index, v)}
              onVisibleChange={(v) => updateTabVisible(index, v)}
              onMoveUp={() => moveTab(index, 'up')}
              onMoveDown={() => moveTab(index, 'down')}
            />
            {index < tabs.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Section>

      {/* Section 4: Notification Texts */}
      <Section title="Notification Texts">
        <NotifRow
          label="Welcome Message"
          value={notifs.welcome}
          onChange={(v) => setNotifs({ ...notifs, welcome: v })}
        />
        <View style={styles.divider} />
        <NotifRow
          label="Vaccine Reminder"
          value={notifs.vaccine}
          onChange={(v) => setNotifs({ ...notifs, vaccine: v })}
        />
        <View style={styles.divider} />
        <NotifRow
          label="Mood Reminder"
          value={notifs.mood}
          onChange={(v) => setNotifs({ ...notifs, mood: v })}
        />
      </Section>

      {/* Section 5: Releases */}
      <Section title="Releases">
        {RELEASE_LINKS.map((row, i) => (
          <View key={row.key}>
            <ReleaseRow label={row.label} sub={row.sub} icon={row.icon} url={row.url} />
            {i < RELEASE_LINKS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Section>

      {/* Section 6: Admin Account */}
      <Section title="Admin Account">
        <View style={styles.adminEmailRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
          <Text style={styles.adminEmail}>{user?.email ?? adminEmail ?? 'admin'}</Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.signOutRowBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={16} color="#ef4444" />
          <Text style={styles.signOutRowText}>Sign out of admin</Text>
        </TouchableOpacity>
      </Section>

      {/* Save All Button */}
      <TouchableOpacity
        style={[styles.saveAllBtn, saving && { opacity: 0.7 }]}
        onPress={handleSaveAll}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saved ? (
          <>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.saveAllText}>Saved!</Text>
          </>
        ) : (
          <Text style={styles.saveAllText}>{saving ? 'Saving...' : 'Save All Settings'}</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Rollout % Section ───────────────────────────────────────────────────────

function RolloutSection({ featureRows }: { featureRows: { key: string; label: string; icon: string }[] }) {
  const { user: actor } = useAuthStore();
  const [rollouts, setRollouts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg: any = await getAppSettings();
      setRollouts((cfg?.flagRollouts ?? {}) as Record<string, number>);
      setLoaded(true);
    })();
  }, []);

  async function save(key: string, pct: number) {
    if (!actor) return;
    const next = { ...rollouts, [key]: Math.min(100, Math.max(0, Math.round(pct))) };
    setRollouts(next);
    setBusy(true);
    try {
      await updateAppSettings({ flagRollouts: next } as any);
      await logAdminAction(actor, 'flag.update', { label: key }, { pct: next[key] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Rollout % per feature">
      {featureRows.map((row, i) => {
        const pct = rollouts[row.key] ?? 100;
        return (
          <View key={row.key}>
            <View style={localStyles.rolloutRow}>
              <Text style={localStyles.rolloutLabel}>{row.label}</Text>
              <View style={{ flex: 1 }} />
              {[0, 25, 50, 75, 100].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[localStyles.rolloutChip, pct === p && localStyles.rolloutChipActive]}
                  disabled={busy}
                  onPress={() => save(row.key, p)}
                >
                  <Text style={[localStyles.rolloutChipText, pct === p && { color: '#fff' }]}>{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            {i < featureRows.length - 1 && <View style={styles.divider} />}
          </View>
        );
      })}
      {!loaded ? <Text style={localStyles.rolloutHint}>Loading current rollout…</Text> : (
        <Text style={localStyles.rolloutHint}>Each user is bucketed by a stable hash of their uid. Rollout changes save instantly.</Text>
      )}
    </Section>
  );
}

// ─── Admin Team Section ──────────────────────────────────────────────────────

function AdminTeamSection() {
  const { user: actor } = useAuthStore();
  const role = useAdminRole();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const isSuper = role === 'super';

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    setMembers(await listAdminMembers());
    setLoading(false);
  }

  async function changeRole(member: AdminMember, next: AdminRole | null) {
    if (!actor || !isSuper) return;
    const ok = await confirmAction(
      'Change role',
      next ? `Set ${member.email} to ${ADMIN_ROLE_LABELS[next]}?` : `Remove admin access from ${member.email}?`,
    );
    if (!ok) return;
    try {
      await setUserAdminRole(actor, member.uid, next);
      await load();
    } catch (e: any) {
      infoAlert('Failed', e?.message ?? '');
    }
  }

  return (
    <Section title="Admin team">
      {loading ? (
        <Text style={localStyles.rolloutHint}>Loading…</Text>
      ) : members.length === 0 ? (
        <Text style={localStyles.rolloutHint}>No admin roles assigned. The email allow-list still grants super to founders.</Text>
      ) : members.map((m, i) => (
        <View key={m.uid}>
          <View style={localStyles.memberRow}>
            <View style={{ flex: 1 }}>
              <Text style={localStyles.memberName}>{m.name}</Text>
              <Text style={localStyles.memberEmail}>{m.email}</Text>
            </View>
            {ADMIN_ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[localStyles.memberChip, m.role === r && localStyles.memberChipActive]}
                disabled={!isSuper || m.role === r}
                onPress={() => changeRole(m, r)}
              >
                <Text style={[localStyles.memberChipText, m.role === r && { color: '#fff' }]}>{ADMIN_ROLE_LABELS[r].split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[localStyles.memberChip, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
              disabled={!isSuper}
              onPress={() => changeRole(m, null)}
            >
              <Text style={[localStyles.memberChipText, { color: '#EF4444' }]}>×</Text>
            </TouchableOpacity>
          </View>
          {i < members.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
      {!isSuper ? <Text style={[localStyles.rolloutHint, { marginTop: 6 }]}>Only super admins can change roles.</Text> : null}
      <Text style={[localStyles.rolloutHint, { marginTop: 6 }]}>Grant roles from any user 360 page (admin role button). They appear here once set.</Text>
    </Section>
  );
}

const localStyles = StyleSheet.create({
  rolloutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  rolloutLabel: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  rolloutChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  rolloutChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rolloutChipText: { fontSize: 10, fontWeight: '700', color: '#1a1a2e' },
  rolloutHint: { fontSize: 11, color: '#9CA3AF', paddingHorizontal: 12, paddingVertical: 8 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, flexWrap: 'wrap' as any },
  memberName: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  memberEmail: { fontSize: 11, color: '#6B7280' },
  memberChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  memberChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  memberChipText: { fontSize: 10, fontWeight: '700', color: '#1a1a2e' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' },

  divider: { height: 1, backgroundColor: '#f3f4f6' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDE9F6', alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },

  colorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  colorLabel: { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  colorRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#f3f4f6' },
  colorInput: {
    width: 90,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1a1a2e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 14, justifyContent: 'center' },
  resetBtnText: { fontSize: 13, color: '#9ca3af' },

  tabConfigRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  tabConfigOrder: { alignItems: 'center', width: 36 },
  tabConfigIndex: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  arrowBtn: { padding: 2 },
  tabConfigLabel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    color: '#1a1a2e',
  },

  notifRow: { paddingHorizontal: 16, paddingVertical: 12 },
  notifLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  notifInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1a1a2e',
    textAlignVertical: 'top',
    minHeight: 56,
  },

  releaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  releaseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  releaseLabel: { fontSize: 14, color: '#1a1a2e', fontWeight: '600' },
  releaseSub: { fontSize: 12, color: '#9ca3af', marginTop: 2, lineHeight: 16 },

  adminEmailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  adminEmail: { fontSize: 14, color: '#1a1a2e', fontWeight: '500' },
  signOutRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  signOutRowText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },

  saveAllBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    boxShadow: '0px 4px 8px rgba(28, 16, 51, 0.18)',
  },
  saveAllText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// Platform import for fontFamily
import { Platform } from 'react-native';
import { Colors } from '../../constants/theme';
