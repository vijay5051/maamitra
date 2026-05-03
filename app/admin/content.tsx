/**
 * Admin — Content Manager.
 *
 * Wave 3 rebuild. Full CRUD for: Books · Articles · Products · Schemes · Yoga.
 * AdminPage shell + FilterBar tabs + DataTable + ConfirmDialog +
 * SlideOver-based form. Schema-driven so adding a new content type
 * is a one-line change to TAB_META + SCHEMAS.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  Column,
  ConfirmDialog,
  DataTable,
  FilterBar,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { createContent, deleteContent, getContent, updateContent } from '../../services/firebase';

type ContentTab = 'books' | 'articles' | 'products' | 'schemes' | 'yoga';
interface ContentItem { id?: string; [key: string]: any; }

interface FieldSpec {
  key: string;
  label: string;
  multiline?: boolean;
  numeric?: boolean;
  hint?: string;
}

const SCHEMAS: Record<ContentTab, FieldSpec[]> = {
  books: [
    { key: 'title', label: 'Title *' },
    { key: 'author', label: 'Author *' },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'topic', label: 'Topic', hint: 'e.g. Pregnancy, Sleep' },
    { key: 'rating', label: 'Rating (1–5)', numeric: true },
    { key: 'reviews', label: 'Review count', numeric: true },
    { key: 'url', label: 'Buy URL' },
    { key: 'sampleUrl', label: 'Sample / preview URL' },
    { key: 'imageUrl', label: 'Cover image URL' },
    { key: 'ageMin', label: 'Age min (months)', numeric: true, hint: '-9 = pregnancy' },
    { key: 'ageMax', label: 'Age max (months)', numeric: true, hint: '999 = all ages' },
  ],
  articles: [
    { key: 'title', label: 'Title *' },
    { key: 'preview', label: 'Preview *', multiline: true },
    { key: 'body', label: 'Full body', multiline: true },
    { key: 'topic', label: 'Topic', hint: 'Feeding, Sleep, Nutrition…' },
    { key: 'readTime', label: 'Read time', hint: 'e.g. "4 min read"' },
    { key: 'emoji', label: 'Emoji icon' },
    { key: 'tag', label: 'Tag', hint: 'e.g. Breastfeeding' },
    { key: 'url', label: 'External URL' },
    { key: 'imageUrl', label: 'Header image URL' },
    { key: 'ageMin', label: 'Age min (months)', numeric: true },
    { key: 'ageMax', label: 'Age max (months)', numeric: true },
  ],
  products: [
    { key: 'name', label: 'Product name *' },
    { key: 'category', label: 'Category', hint: 'Feeding, Sleep, Skincare…' },
    { key: 'emoji', label: 'Emoji' },
    { key: 'price', label: 'Price (₹)', numeric: true },
    { key: 'originalPrice', label: 'Original price (₹)', numeric: true },
    { key: 'rating', label: 'Rating (1–5)', numeric: true },
    { key: 'reviews', label: 'Review count', numeric: true },
    { key: 'badge', label: 'Badge', hint: 'e.g. Best Seller' },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'url', label: 'Affiliate / buy URL' },
    { key: 'imageUrl', label: 'Image URL' },
  ],
  schemes: [
    { key: 'name', label: 'Scheme name *' },
    { key: 'shortName', label: 'Short name / abbreviation' },
    { key: 'emoji', label: 'Emoji' },
    { key: 'shortDesc', label: 'Short description *' },
    { key: 'description', label: 'Full description', multiline: true },
    { key: 'eligibility', label: 'Eligibility', multiline: true },
    { key: 'benefit', label: 'What they get', multiline: true },
    { key: 'howToApply', label: 'How to apply', multiline: true },
    { key: 'url', label: 'Official URL' },
    { key: 'tags', label: 'Tags', hint: 'comma-separated: pregnant,newborn,girl' },
  ],
  yoga: [
    { key: 'name', label: 'Session name *' },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'duration', label: 'Duration', hint: 'e.g. 20 min' },
    { key: 'level', label: 'Level', hint: 'Beginner / Intermediate / Advanced' },
    { key: 'poses', label: 'Poses', hint: 'comma-separated' },
    { key: 'trimester', label: 'Trimester', hint: '1, 2, 3 or All' },
    { key: 'emoji', label: 'Emoji' },
  ],
};

const TAB_META: Record<ContentTab, { label: string; icon: keyof typeof Ionicons.glyphMap; collection: string; primaryKey: string }> = {
  books:    { label: 'Books',    icon: 'book-outline',           collection: 'books',    primaryKey: 'title' },
  articles: { label: 'Articles', icon: 'newspaper-outline',      collection: 'articles', primaryKey: 'title' },
  products: { label: 'Products', icon: 'bag-handle-outline',     collection: 'products', primaryKey: 'name'  },
  schemes:  { label: 'Schemes',  icon: 'ribbon-outline',         collection: 'schemes',  primaryKey: 'name'  },
  yoga:     { label: 'Yoga',     icon: 'body-outline',           collection: 'yoga',     primaryKey: 'name'  },
};

function getTitle(item: ContentItem, tab: ContentTab): string {
  return item[TAB_META[tab].primaryKey] ?? item.title ?? item.name ?? '(Untitled)';
}

function getSub(item: ContentItem, tab: ContentTab): string {
  switch (tab) {
    case 'books':    return [item.author, item.topic].filter(Boolean).join(' · ');
    case 'articles': return [item.topic, item.readTime].filter(Boolean).join(' · ');
    case 'products': return [item.category, item.price ? `₹${item.price}` : null].filter(Boolean).join(' · ');
    case 'schemes':  return item.shortDesc ?? '';
    case 'yoga':     return [item.level, item.duration].filter(Boolean).join(' · ');
  }
}

function blankItem(tab: ContentTab): ContentItem {
  const item: ContentItem = {};
  SCHEMAS[tab].forEach((f) => { item[f.key] = ''; });
  return item;
}

export default function ContentScreen() {
  const [tab, setTab] = useState<ContentTab>('books');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [confirmDel, setConfirmDel] = useState<ContentItem | null>(null);
  const [counts, setCounts] = useState<Record<ContentTab, number>>({
    books: 0, articles: 0, products: 0, schemes: 0, yoga: 0,
  });

  useEffect(() => { void load(); }, [tab]);
  useEffect(() => { void loadCounts(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getContent(TAB_META[tab].collection);
      setItems(data);
      setCounts((prev) => ({ ...prev, [tab]: data.length }));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    const tabs = Object.keys(TAB_META) as ContentTab[];
    const next: Record<ContentTab, number> = { books: 0, articles: 0, products: 0, schemes: 0, yoga: 0 };
    for (const t of tabs) {
      try {
        const data = await getContent(TAB_META[t].collection);
        next[t] = data.length;
      } catch { /* swallow */ }
    }
    setCounts(next);
  }

  async function handleSave(data: ContentItem) {
    const col = TAB_META[tab].collection;
    const schema = SCHEMAS[tab];
    const cleaned: ContentItem = { ...data };
    schema.forEach((f) => {
      if (f.numeric && cleaned[f.key] !== '') {
        cleaned[f.key] = parseFloat(cleaned[f.key]) || 0;
      }
      if (tab === 'schemes' && f.key === 'tags' && typeof cleaned.tags === 'string') {
        cleaned.tags = cleaned.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    });

    try {
      if (editing?.id) {
        await updateContent(col, editing.id, cleaned);
        setItems((prev) => prev.map((i) => i.id === editing.id ? { ...i, ...cleaned } : i));
      } else {
        const newId = await createContent(col, cleaned);
        setItems((prev) => [{ ...cleaned, id: newId ?? Date.now().toString() }, ...prev]);
      }
      setModalOpen(false);
      setEditing(null);
      void loadCounts();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleDelete(item: ContentItem) {
    if (!item.id) return;
    try {
      await deleteContent(TAB_META[tab].collection, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      void loadCounts();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setConfirmDel(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    const pk = TAB_META[tab].primaryKey;
    return items.filter((i) =>
      String(i[pk] ?? i.title ?? i.name ?? '').toLowerCase().includes(q),
    );
  }, [items, search, tab]);

  const filterChips = (Object.keys(TAB_META) as ContentTab[]).map((t) => ({
    key: t,
    label: TAB_META[t].label,
    count: counts[t],
  }));

  const columns: Column<ContentItem>[] = [
    {
      key: 'item',
      header: TAB_META[tab].label,
      render: (i) => (
        <View style={styles.cellRow}>
          <View style={styles.itemEmoji}>
            <Text style={{ fontSize: 18 }}>{i.emoji ?? '·'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cellTitle} numberOfLines={1}>{getTitle(i, tab)}</Text>
            {getSub(i, tab) ? (
              <Text style={styles.cellSub} numberOfLines={1}>{getSub(i, tab)}</Text>
            ) : null}
          </View>
        </View>
      ),
      sort: (i) => getTitle(i, tab).toLowerCase(),
    },
    ...(tab === 'books' || tab === 'products' ? [{
      key: 'rating',
      header: 'Rating',
      width: 100,
      align: 'right' as const,
      render: (i: ContentItem) => i.rating ? <StatusBadge label={`★ ${i.rating}`} color={Colors.warning} /> : <Text style={styles.muted}>—</Text>,
      sort: (i: ContentItem) => Number(i.rating ?? 0),
    }] : []),
    ...(tab === 'products' ? [{
      key: 'price',
      header: 'Price',
      width: 100,
      align: 'right' as const,
      render: (i: ContentItem) => <Text style={styles.cellNumber}>{i.price ? `₹${i.price}` : '—'}</Text>,
      sort: (i: ContentItem) => Number(i.price ?? 0),
    }] : []),
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Content library' }} />
      <AdminPage
        title="Content library"
        description="Books · Articles · Products · Schemes · Yoga. Edits sync to every signed-in user immediately."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Content' }]}
        headerActions={
          <>
            <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
            <ToolbarButton
              label={`Add ${TAB_META[tab].label.toLowerCase()}`}
              icon="add"
              variant="primary"
              onPress={() => { setEditing(null); setModalOpen(true); }}
            />
          </>
        }
        toolbar={
          <View style={{ gap: 10 }}>
            <Toolbar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: `Search ${TAB_META[tab].label.toLowerCase()}…`,
              }}
              leading={<Text style={styles.countText}>{filtered.length} of {items.length}</Text>}
            />
            <FilterBar chips={filterChips} active={tab} onChange={(k) => { setTab(k as ContentTab); setSearch(''); }} />
          </View>
        }
        error={error}
      >
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(i) => i.id ?? getTitle(i, tab)}
          loading={loading}
          onRowPress={(i) => { setEditing(i); setModalOpen(true); }}
          emptyTitle={search ? 'No items match' : `No ${TAB_META[tab].label.toLowerCase()} yet`}
          emptyBody={search ? 'Try a different search.' : `Add your first ${TAB_META[tab].label.toLowerCase().replace(/s$/, '')} with the "Add" button up top.`}
        />
      </AdminPage>

      <FormModal
        visible={modalOpen}
        tab={tab}
        item={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        onDelete={editing?.id ? () => { setConfirmDel(editing); setModalOpen(false); } : undefined}
      />

      <ConfirmDialog
        visible={!!confirmDel}
        title="Delete item?"
        body={confirmDel ? `Remove "${getTitle(confirmDel, tab)}"? This hides it from all users immediately.` : ''}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) await handleDelete(confirmDel); }}
      />
    </>
  );
}

// ─── Form modal (full-screen on narrow, modal on wide) ─────────────────────
function FormModal({ visible, tab, item, onClose, onSave, onDelete }: {
  visible: boolean;
  tab: ContentTab;
  item: ContentItem | null;
  onClose: () => void;
  onSave: (data: ContentItem) => Promise<void>;
  onDelete?: () => void;
}) {
  const isEdit = !!(item?.id);
  const [form, setForm] = useState<ContentItem>(item ?? blankItem(tab));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(item ?? blankItem(tab)); }, [item, tab, visible]);

  const schema = SCHEMAS[tab];
  const primaryField = schema[0];
  const isValid = !!(form[primaryField.key]?.toString().trim());

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEdit ? `Edit ${TAB_META[tab].label.replace(/s$/, '').toLowerCase()}` : `Add ${TAB_META[tab].label.replace(/s$/, '').toLowerCase()}`}
            </Text>
            <Pressable onPress={onClose} style={styles.modalClose} hitSlop={6}>
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {schema.map((field) => (
              <View key={field.key} style={{ marginBottom: Spacing.md }}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                {field.hint ? <Text style={styles.fieldHint}>{field.hint}</Text> : null}
                <TextInput
                  style={[styles.fieldInput, field.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
                  value={String(form[field.key] ?? '')}
                  onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                  multiline={field.multiline}
                  keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                  autoCapitalize={
                    field.key === 'url' || field.key === 'imageUrl' || field.key === 'sampleUrl'
                      ? 'none' : 'sentences'
                  }
                  placeholderTextColor={Colors.textMuted}
                  placeholder={field.label.replace(' *', '')}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.modalFooter}>
            {onDelete ? (
              <ToolbarButton label="Delete" icon="trash-outline" variant="danger" onPress={onDelete} />
            ) : null}
            <View style={{ flex: 1 }} />
            <ToolbarButton label="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
            <ToolbarButton
              label={saving ? 'Saving…' : (isEdit ? 'Update' : 'Add')}
              variant="primary"
              icon="save-outline"
              onPress={handleSave}
              disabled={!isValid || saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.4 },
  muted: { fontSize: FontSize.xs, color: Colors.textMuted },

  cellRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cellTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cellSub: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  cellNumber: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, fontVariant: ['tabular-nums'] },
  itemEmoji: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSoft,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(28,16,51,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 640,
    maxHeight: '92%',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  modalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgLight,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: Spacing.xl, gap: 4 },
  modalFooter: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
  },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  fieldInput: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },
});
