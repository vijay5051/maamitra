/**
 * Admin command palette (cmd/ctrl-K).
 *
 * Web-only floating search that pulls users, support tickets, recent posts,
 * and admin nav targets into one fuzzy list. Keyboard-driven on desktop,
 * tappable on mobile (we still mount it so the search button on the dashboard
 * works there too).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors } from '../../constants/theme';
import { getUsers } from '../../services/firebase';
import { listSupportTickets } from '../../services/admin';

interface PaletteItem {
  kind: 'user' | 'ticket' | 'nav';
  title: string;
  sub?: string;
  href: string;
  score?: number;
}

const NAV_ITEMS: PaletteItem[] = [
  { kind: 'nav', title: 'Dashboard',         sub: 'Overview · funnel · activity', href: '/admin' },
  { kind: 'nav', title: 'Users',             sub: 'Search & 360 view',           href: '/admin/users' },
  { kind: 'nav', title: 'Community posts',   sub: 'Bulk approve / hide',          href: '/admin/community' },
  { kind: 'nav', title: 'Comments',          sub: 'Moderate latest comments',     href: '/admin/comments' },
  { kind: 'nav', title: 'Support inbox',     sub: 'Reply, close, reopen',         href: '/admin/support' },
  { kind: 'nav', title: 'Notifications',     sub: 'Compose · Outbox · Schedule',  href: '/admin/notifications' },
  { kind: 'nav', title: 'Vaccines',          sub: 'IAP / NIS schedule editor',    href: '/admin/vaccines' },
  { kind: 'nav', title: 'Vaccine overdue',   sub: 'Find & nudge',                 href: '/admin/vaccine-overdue' },
  { kind: 'nav', title: 'Chat usage',        sub: 'Per-user intensity & heavy users', href: '/admin/chat-usage' },
  { kind: 'nav', title: 'Content library',   sub: 'Articles · books · schemes',   href: '/admin/content' },
  { kind: 'nav', title: 'In-app banner',     sub: 'Manage live banner',           href: '/admin/banner' },
  { kind: 'nav', title: 'Audit log',         sub: 'Who did what, when',           href: '/admin/audit' },
  { kind: 'nav', title: 'Tester feedback',   sub: 'Pricing & loved/frustrated',   href: '/admin/feedback' },
  { kind: 'nav', title: 'App settings',      sub: 'Flags · % rollout · admin team', href: '/admin/settings' },
];

function score(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  if (h.includes(n)) return 60;
  // very loose subsequence
  let hi = 0;
  for (let i = 0; i < n.length; i++) {
    const idx = h.indexOf(n[i], hi);
    if (idx === -1) return 0;
    hi = idx + 1;
  }
  return 30;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [users, setUsers] = useState<PaletteItem[]>([]);
  const [tickets, setTickets] = useState<PaletteItem[]>([]);
  const inputRef = useRef<TextInput>(null);

  // Web keyboard listener — Cmd/Ctrl+K opens, Esc closes.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    function onKey(e: KeyboardEvent) {
      const isOpen = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      if (isOpen) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape' && open) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lazy-load lookup data when first opened. Cheap enough at admin scale.
  useEffect(() => {
    if (!open || users.length > 0 || tickets.length > 0) return;
    (async () => {
      try {
        const [u, t] = await Promise.all([getUsers(), listSupportTickets({ status: 'all' })]);
        setUsers(u.map((x) => ({
          kind: 'user' as const,
          title: x.name || x.email || x.uid,
          sub: x.email || x.uid,
          href: `/admin/users/${x.uid}`,
        })));
        setTickets(t.map((x) => ({
          kind: 'ticket' as const,
          title: x.subject,
          sub: `${x.name || ''}${x.email ? ` · ${x.email}` : ''} · ${x.status}`,
          href: `/admin/support`,
        })));
      } catch {/* */}
    })();
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setHighlight(0); }
  }, [open]);

  const ranked = useMemo(() => {
    const all = [...NAV_ITEMS, ...users, ...tickets];
    if (!query.trim()) return NAV_ITEMS.slice(0, 12);
    const scored = all
      .map((it) => ({ ...it, score: Math.max(score(it.title, query), score(it.sub ?? '', query) - 5) }))
      .filter((it) => it.score > 0)
      .sort((a, b) => (b.score! - a.score!));
    return scored.slice(0, 30);
  }, [query, users, tickets]);

  function go(it: PaletteItem) {
    setOpen(false);
    router.push(it.href as any);
  }

  // Keyboard arrow navigation while open
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(ranked.length - 1, h + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const sel = ranked[highlight];
        if (sel) go(sel);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, ranked, highlight]);

  return (
    <>
      {/* Floating dashboard trigger — visible on every admin page */}
      <Pressable style={[styles.fab, Platform.OS !== 'web' && { right: 16, bottom: 24 }]} onPress={() => setOpen(true)}>
        <Ionicons name="search" size={18} color="#fff" />
        {Platform.OS === 'web' ? <Text style={styles.fabKbd}>⌘K</Text> : null}
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdropTouch} onPress={() => setOpen(false)} />
          <View style={styles.palette}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Jump to user, ticket, or page…"
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={(t) => { setQuery(t); setHighlight(0); }}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={styles.escHint}>Esc</Text>
            </View>
            <View style={styles.results}>
              {ranked.length === 0 ? (
                <Text style={styles.empty}>No matches.</Text>
              ) : ranked.map((it, i) => (
                <Pressable
                  key={`${it.kind}_${it.href}_${i}`}
                  style={[styles.row, i === highlight && styles.rowActive]}
                  onPress={() => go(it)}
                  onHoverIn={() => setHighlight(i)}
                >
                  <View style={[styles.kindBadge, kindTint(it.kind)]}>
                    <Ionicons name={kindIcon(it.kind) as any} size={11} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{it.title}</Text>
                    {it.sub ? <Text style={styles.rowSub} numberOfLines={1}>{it.sub}</Text> : null}
                  </View>
                  {i === highlight ? <Ionicons name="return-down-back-outline" size={13} color="#9CA3AF" /> : null}
                </Pressable>
              ))}
            </View>
            <View style={styles.foot}>
              <Text style={styles.footText}>↑↓ to navigate · ↵ to open · Esc to dismiss</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function kindIcon(k: PaletteItem['kind']) {
  if (k === 'user') return 'person-outline';
  if (k === 'ticket') return 'help-buoy-outline';
  return 'navigate-outline';
}
function kindTint(k: PaletteItem['kind']) {
  if (k === 'user') return { backgroundColor: '#8B5CF6' };
  if (k === 'ticket') return { backgroundColor: '#3B82F6' };
  return { backgroundColor: '#10B981' };
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 24, bottom: 24, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  fabKbd: { color: '#fff', fontWeight: '800', fontSize: 11 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'flex-start' },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  palette: {
    width: '92%', maxWidth: 600, marginTop: 80,
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  escHint: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },

  results: { maxHeight: 360 },
  empty: { padding: 20, fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  rowActive: { backgroundColor: '#F5F0FF' },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  rowSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  kindBadge: { width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },

  foot: { paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  footText: { fontSize: 10, color: '#9CA3AF', textAlign: 'center' },
});
