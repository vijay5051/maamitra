// Admin panel shell: persistent sidebar on wide-web, hamburger drawer on
// everything else. Wraps the expo-router Stack so existing screens keep
// working unchanged — they just gain a nav frame around them.
//
// Visibility:
//   - Wide web (>= 1100px): sidebar always visible.
//   - Narrow web / native: sidebar hidden; floating hamburger opens it as
//     a slide-in panel. Existing Stack header still shows the screen title.
//
// Each nav item is gated by an admin capability so the support role doesn't
// see "Visibility" or "Roles" they can't use.

import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { AdminCapability, AdminRole, ADMIN_ROLE_LABELS, can } from '../../../lib/admin';

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  cap?: AdminCapability;
  /** Show a small "NEW" pill — used for newly added screens. */
  fresh?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin',       label: 'Dashboard',  icon: 'speedometer-outline', cap: 'view_dashboard' },
      { href: '/admin/audit', label: 'Audit log',  icon: 'document-text-outline', cap: 'view_audit_log' },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users', icon: 'people-outline', cap: 'view_users' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/community', label: 'Community',     icon: 'chatbubbles-outline', cap: 'moderate_posts' },
      { href: '/admin/comments',  label: 'Comments',      icon: 'chatbubble-ellipses-outline', cap: 'moderate_comments' },
      { href: '/admin/content',   label: 'Content library', icon: 'library-outline', cap: 'edit_content' },
      { href: '/admin/vaccines',  label: 'Vaccine schedule', icon: 'medkit-outline', cap: 'edit_vaccines' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { href: '/admin/notifications', label: 'Notifications', icon: 'notifications-outline', cap: 'send_broadcast_push' },
      { href: '/admin/banner',        label: 'In-app banner', icon: 'megaphone-outline', cap: 'manage_banner' },
      { href: '/admin/support',       label: 'Support inbox', icon: 'help-buoy-outline', cap: 'view_support' },
      { href: '/admin/feedback',      label: 'Tester feedback', icon: 'star-outline', cap: 'view_dashboard' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/chat-usage',      label: 'Chat usage',     icon: 'pulse-outline', cap: 'view_dashboard' },
      { href: '/admin/vaccine-overdue', label: 'Vaccine overdue', icon: 'time-outline', cap: 'send_personal_push' },
    ],
  },
  {
    label: 'Visibility',
    items: [
      { href: '/admin/visibility', label: 'Feature flags', icon: 'toggle-outline', cap: 'manage_feature_flags', fresh: true },
    ],
  },
  {
    label: 'Safety',
    items: [
      { href: '/admin/safety', label: 'Crisis queue', icon: 'shield-checkmark-outline', cap: 'moderate_posts', fresh: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/settings', label: 'App settings', icon: 'settings-outline', cap: 'edit_settings' },
    ],
  },
];

interface Props {
  role: AdminRole | null;
  email: string | null | undefined;
  children: React.ReactNode;
}

export default function AdminShell({ role, email, children }: Props) {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1100;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.cap || can(role, i.cap)),
      }))
      .filter((g) => g.items.length > 0);
  }, [role]);

  if (isWide) {
    return (
      <View style={styles.wideRoot}>
        <Sidebar groups={visibleGroups} role={role} email={email} />
        <View style={styles.contentWrap}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {children}
      <Pressable
        onPress={() => setDrawerOpen(true)}
        style={styles.fab}
        accessibilityLabel="Open admin menu"
      >
        <Ionicons name="menu" size={22} color={Colors.white} />
      </Pressable>
      <Modal
        visible={drawerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
            <Sidebar
              groups={visibleGroups}
              role={role}
              email={email}
              onNavigate={() => setDrawerOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

interface SidebarProps {
  groups: NavGroup[];
  role: AdminRole | null;
  email: string | null | undefined;
  onNavigate?: () => void;
}

function Sidebar({ groups, role, email, onNavigate }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  function go(href: string) {
    router.push(href as any);
    onNavigate?.();
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin' || pathname === '/admin/index';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandTitle}>MaaMitra</Text>
          <Text style={styles.brandSub}>Admin console</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.navScroll}>
        {groups.map((g) => (
          <View key={g.label} style={styles.navGroup}>
            <Text style={styles.navGroupLabel}>{g.label}</Text>
            {g.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Pressable
                  key={item.href}
                  onPress={() => go(item.href)}
                  style={[styles.navItem, active && styles.navItemActive]}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={active ? Colors.primary : Colors.textLight}
                  />
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  {item.fresh ? (
                    <View style={styles.freshPill}>
                      <Text style={styles.freshText}>NEW</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.identity}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityInitial}>
              {(email ?? 'A')[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityEmail} numberOfLines={1}>{email ?? 'Admin'}</Text>
            <Text style={styles.identityRole}>
              {role ? ADMIN_ROLE_LABELS[role] : '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 248;

const styles = StyleSheet.create({
  wideRoot: { flex: 1, flexDirection: 'row', backgroundColor: Colors.bgLight },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.cardBg,
    borderRightWidth: 1, borderRightColor: Colors.borderSoft,
    height: '100%',
  },
  contentWrap: { flex: 1, height: '100%' },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  brandMark: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  brandTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.3 },
  brandSub: { fontSize: 11, color: Colors.textLight, marginTop: 1 },

  navScroll: { paddingVertical: Spacing.md },
  navGroup: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.md },
  navGroupLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4,
  },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.sm,
    marginBottom: 2,
  },
  navItemActive: { backgroundColor: Colors.primarySoft },
  navLabel: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textDark, flex: 1 },
  navLabelActive: { fontWeight: '700', color: Colors.primary },
  freshPill: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  freshText: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },

  footer: {
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
    padding: Spacing.md,
  },
  identity: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgLight, padding: Spacing.sm, borderRadius: Radius.sm,
  },
  identityAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  identityInitial: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.white },
  identityEmail: { fontSize: 12, fontWeight: '700', color: Colors.textDark },
  identityRole: { fontSize: 10, color: Colors.textLight, marginTop: 1 },

  fab: {
    position: 'absolute', left: 16, bottom: 24,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.md,
  },
  drawerBackdrop: {
    flex: 1, backgroundColor: 'rgba(28,16,51,0.55)',
  },
  drawer: { width: 280, height: '100%', backgroundColor: Colors.cardBg, ...Shadow.lg },
});
