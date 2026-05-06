import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '../../../constants/theme';

import { useAdminDrawer } from './AdminShell';
import EmptyState from './EmptyState';

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  /** Right-aligned actions in the page header. */
  headerActions?: React.ReactNode;
  /** Sticky toolbar (search/filters) under the header. */
  toolbar?: React.ReactNode;
  /** Loading state — shows skeleton/empty in body. */
  loading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
  /** When true, hides the back button (e.g. for /admin index). */
  hideBack?: boolean;
}

export default function AdminPage({
  title,
  description,
  crumbs,
  headerActions,
  toolbar,
  loading,
  error,
  children,
  hideBack,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 900;
  const isNarrow = !isWide;
  const drawer = useAdminDrawer();

  // Hamburger: only on narrow widths AND only when the shell exposes it
  // (wide-web has the persistent sidebar — no opener needed).
  const showHamburger = isNarrow && drawer.available;

  const crumbRow = crumbs && crumbs.length > 0 ? (
    <View style={styles.crumbRow}>
      {crumbs.map((c, i) => (
        <View key={i} style={styles.crumbRow}>
          {c.href ? (
            <Pressable onPress={() => router.push(c.href as any)}>
              <Text style={styles.crumbLink}>{c.label}</Text>
            </Pressable>
          ) : (
            <Text style={styles.crumbText}>{c.label}</Text>
          )}
          {i < crumbs.length - 1 ? (
            <Ionicons name="chevron-forward" size={12} color={Colors.textMuted} style={{ marginHorizontal: 4 }} />
          ) : null}
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      {isNarrow ? (
        <View style={styles.headerNarrow}>
          {/* Top bar: nav controls + actions, never wraps */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
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
              {!hideBack ? (
                <Pressable
                  onPress={() => router.back()}
                  style={styles.iconBtn}
                  hitSlop={8}
                  accessibilityLabel="Back"
                >
                  <Ionicons name="chevron-back" size={22} color={Colors.textDark} />
                </Pressable>
              ) : null}
            </View>
            {headerActions ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.headerActions}
              >
                {headerActions}
              </ScrollView>
            ) : null}
          </View>
          {/* Title block: full-width below the top bar */}
          <View style={styles.titleBlockNarrow}>
            {crumbRow}
            <Text style={styles.titleNarrow}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
        </View>
      ) : (
        <View style={[styles.header, styles.headerWide]}>
          {!hideBack ? (
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={8}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={20} color={Colors.textDark} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, gap: 4 }}>
            {crumbRow}
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          {headerActions ? <View style={styles.headerActions}>{headerActions}</View> : null}
        </View>
      )}
      {toolbar ? <View style={[styles.toolbarSlot, isNarrow && styles.toolbarSlotNarrow]}>{toolbar}</View> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, isWide ? styles.bodyWide : styles.bodyNarrow]}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <EmptyState kind="error" title="Something went wrong" body={error} />
        ) : loading ? (
          <EmptyState kind="loading" title="Loading…" />
        ) : (
          children
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  rootWide: { paddingHorizontal: 0 },

  // Wide-web header (single row).
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  headerWide: { paddingHorizontal: Spacing.xxxl, paddingTop: Spacing.xxl },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },

  // Narrow / mobile header (two rows: top bar + title block).
  headerNarrow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bgLight,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 40,
  },
  topBarLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  titleBlockNarrow: {
    paddingTop: Spacing.xs,
    gap: 4,
  },
  titleNarrow: {
    fontSize: FontSize.xl, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.4,
  },

  crumbRow: { flexDirection: 'row', alignItems: 'center' },
  crumbLink: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  crumbText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.5 },
  description: { fontSize: FontSize.sm, color: Colors.textLight, maxWidth: 600, lineHeight: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },

  toolbarSlot: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  toolbarSlotNarrow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  body: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 80 },
  bodyWide: { paddingHorizontal: Spacing.xxxl },
  bodyNarrow: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
});
