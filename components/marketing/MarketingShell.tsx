/**
 * MarketingShell — chrome wrapping every /admin/marketing/* screen.
 *
 * Studio v2 redesign: replaces the 9-route admin-y layout with a calm
 * pill-tab nav matched to non-techie mental models (Home / Posts /
 * Content Planner / Inbox / Settings). Greeting on the left, system-health
 * chip on the right. Sub-screens render in the body slot.
 *
 * Active tab detection uses pathname matching, which keeps existing
 * deep links working — the inbox / analytics screens still live at
 * their original URLs but appear as "Replies" / "Insights" in the nav.
 */

import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { useAdminDrawer } from '../admin/ui/AdminShell';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
// Mother's name lives at the top-level store (not on Profile).

export interface HealthStatus {
  igConnected: boolean;
  fbConnected: boolean;
  cronEnabled: boolean;
  crisisPaused: boolean;
  /** Display handle from the latest probe (e.g. "@maamitra.official"). */
  igHandle?: string | null;
  fbHandle?: string | null;
  /** Plain-English error from the latest probe — surfaced on hover/long-press. */
  igError?: string | null;
  fbError?: string | null;
  /** True before the first probe lands. Renders as muted "?" rather than red. */
  healthUnknown?: boolean;
}

interface Tab {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  /** Routes that should activate this tab (besides href). */
  match?: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  {
    key: 'today',
    label: 'Home',
    icon: 'sunny-outline',
    href: '/admin/marketing',
    match: (p) => p === '/admin/marketing' || p === '/admin/marketing/' || p === '/admin/marketing/today',
  },
  {
    key: 'posts',
    label: 'Posts',
    icon: 'images-outline',
    href: '/admin/marketing/posts',
    match: (p) =>
      p.startsWith('/admin/marketing/posts') ||
      p.startsWith('/admin/marketing/drafts') ||
      p.startsWith('/admin/marketing/ugc') ||
      p.startsWith('/admin/marketing/create'),
  },
  {
    key: 'planner',
    label: 'Content Planner',
    icon: 'calendar-clear-outline',
    href: '/admin/marketing/calendar',
    match: (p) =>
      p.startsWith('/admin/marketing/planner') ||
      p.startsWith('/admin/marketing/calendar'),
  },
  {
    key: 'inbox',
    label: 'Inbox',
    icon: 'chatbubbles-outline',
    href: '/admin/marketing/inbox',
    match: (p) => p.startsWith('/admin/marketing/inbox') || p.startsWith('/admin/marketing/replies'),
  },
];

const SETTINGS_TAB: Tab = {
  key: 'settings',
  label: 'Settings',
  icon: 'settings-outline',
  href: '/admin/marketing/settings',
  match: (p) =>
    p.startsWith('/admin/marketing/settings') ||
    p.startsWith('/admin/marketing/brand-kit') ||
    p.startsWith('/admin/marketing/strategy') ||
    p.startsWith('/admin/marketing/preview') ||
    p.startsWith('/admin/marketing/analytics'),
};

interface Props {
  children: React.ReactNode;
  /** Health status pill — shown top-right. Pass null to hide (e.g. on onboarding). */
  health?: HealthStatus | null;
  /** When true, no greeting/tabs/health chip — body fills the screen. Used for
   *  the onboarding wizard so it feels modal-like. */
  bare?: boolean;
}

export default function MarketingShell({ children, health, bare }: Props) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 900;
  const drawer = useAdminDrawer();
  const showHamburger = !isWide && drawer.available;

  const user = useAuthStore((s) => s.user);
  const motherName = useProfileStore((s) => s.motherName);
  const firstName = useMemo(() => deriveFirstName(motherName, user?.email), [motherName, user?.email]);

  const allTabs = [...TABS, SETTINGS_TAB];
  const activeKey = useMemo(() => {
    const match = allTabs.find((t) => (t.match ?? ((p) => p === t.href))(pathname ?? ''));
    return match?.key ?? 'today';
  }, [pathname]);

  if (bare) {
    return <View style={styles.root}>{children}</View>;
  }

  return (
    <View style={styles.root}>
      {/* Header row: hamburger + greeting + health chip */}
      <View style={[styles.headerRow, isWide ? styles.headerRowWide : styles.headerRowNarrow]}>
        <View style={styles.greetingBlock}>
          {showHamburger ? (
            <Pressable
              onPress={drawer.open}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityLabel="Open admin menu"
            >
              <Ionicons name="menu" size={22} color={Colors.textDark} />
            </Pressable>
          ) : null}
          <Text style={styles.greeting} numberOfLines={1}>
            Hi {firstName} <Text style={styles.wave}>👋</Text>
          </Text>
        </View>
        {health ? <HealthChip health={health} /> : null}
      </View>

      {/* Pill tab strip — tabs scroll horizontally; settings gear is pinned to the right */}
      <View style={styles.tabBarRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.tabStrip, isWide ? styles.tabStripWide : styles.tabStripNarrow]}
        >
          {TABS.map((t) => (
            <TabPill key={t.key} tab={t} active={activeKey === t.key} />
          ))}
        </ScrollView>
        {/* Settings gear is always visible — outside the ScrollView so it never scrolls away */}
        <View style={[styles.settingsPill, isWide ? styles.settingsPillWide : null]}>
          <TabPill tab={SETTINGS_TAB} active={activeKey === SETTINGS_TAB.key} compact />
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function TabPill({ tab, active, compact }: { tab: Tab; active: boolean; compact?: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(tab.href as any)}
      accessibilityLabel={tab.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[
        styles.pill,
        active && styles.pillActive,
        compact && styles.pillCompact,
      ]}
    >
      <Ionicons name={tab.icon} size={16} color={active ? Colors.primary : Colors.textLight} />
      {!compact ? (
        <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{tab.label}</Text>
      ) : null}
    </Pressable>
  );
}

function HealthChip({ health }: { health: HealthStatus }) {
  const router = useRouter();
  const {
    igConnected, fbConnected, cronEnabled, crisisPaused,
    igHandle, fbHandle, igError, fbError, healthUnknown,
  } = health;
  // "warn" covers both unknown (pre-first-probe) and any real failure so
  // the user sees a visual cue rather than a green-on-broken lie.
  const channelsOk = igConnected && fbConnected;
  const channelsKnown = !healthUnknown;
  const tone = crisisPaused
    ? 'paused'
    : (channelsOk && channelsKnown && cronEnabled) ? 'ok'
    : 'warn';

  // Native title attribute on web shows the error reason on hover.
  const igHint = healthUnknown
    ? 'Instagram: checking…'
    : `Instagram: ${igConnected ? igHandle ?? 'connected' : igError ?? 'not connected'}`;
  const fbHint = healthUnknown
    ? 'Facebook: checking…'
    : `Facebook: ${fbConnected ? fbHandle ?? 'connected' : fbError ?? 'not connected'}`;
  const accessibilityHint = `${igHint} • ${fbHint}`;

  return (
    <Pressable
      onPress={() => router.push('/admin/marketing/settings' as any)}
      style={[styles.healthChip, tone === 'paused' && styles.healthChipPaused, tone === 'warn' && styles.healthChipWarn]}
      accessibilityLabel={`System health — ${accessibilityHint}. Open Settings.`}
    >
      <Dot state={dotState(igConnected, healthUnknown)} />
      <Text style={styles.healthLabel}>IG</Text>
      <Dot state={dotState(fbConnected, healthUnknown)} />
      <Text style={styles.healthLabel}>FB</Text>
      <View style={styles.healthDivider} />
      <Text style={styles.healthLabel}>
        {crisisPaused ? 'Paused' : cronEnabled ? 'Auto on' : 'Auto off'}
      </Text>
    </Pressable>
  );
}

type DotState = 'ok' | 'fail' | 'unknown';
function dotState(ok: boolean, unknown: boolean | undefined): DotState {
  if (unknown) return 'unknown';
  return ok ? 'ok' : 'fail';
}

function Dot({ state }: { state: DotState }) {
  const color =
    state === 'ok' ? Colors.success :
    state === 'fail' ? Colors.error :
    Colors.textMuted;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function deriveFirstName(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) {
    const first = name.trim().split(/\s+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  }
  if (email) {
    const local = email.split('@')[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return 'there';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerRowWide: { paddingHorizontal: Spacing.xxxl, paddingTop: Spacing.xxl },
  headerRowNarrow: {},

  greetingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textDark,
    letterSpacing: -0.5,
    flex: 1,
    minWidth: 0,
  },
  wave: { fontSize: FontSize.xl },

  // ── Pill tabs ─────────────────────────────────────────────────────────
  // Outer row: tabs scroll, settings gear pinned right
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
  },
  // Wrapper for the pinned settings gear (always-visible right side)
  settingsPill: {
    paddingRight: Spacing.md,
    paddingBottom: Spacing.md,
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: Colors.borderSoft,
  },
  settingsPillWide: {
    paddingRight: Spacing.xxxl,
  },
  tabStrip: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  tabStripWide: { paddingHorizontal: Spacing.xxxl, paddingBottom: Spacing.lg },
  tabStripNarrow: {},

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  pillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  pillCompact: {
    paddingHorizontal: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    gap: 0,
  },
  pillLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textLight,
  },
  pillLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // ── Health chip ───────────────────────────────────────────────────────
  healthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  healthChipWarn: {
    borderColor: Colors.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  healthChipPaused: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  healthLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDark,
    letterSpacing: 0.2,
  },
  healthDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
