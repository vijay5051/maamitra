/**
 * Admin — Content Manager
 * Full CRUD for: Books · Articles · Products · Schemes · Yoga
 * All changes sync to Firestore so all users see updates immediately.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getContent, createContent, updateContent, deleteContent } from '../../services/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentTab = 'books' | 'articles' | 'products' | 'schemes' | 'yoga';

interface ContentItem {
  id?: string;
  [key: string]: any;
}

// ─── Field schemas per content type ──────────────────────────────────────────

const SCHEMAS: Record<ContentTab, { key: string; label: string; multiline?: boolean; numeric?: boolean; hint?: string }[]> = {
  books: [
    { key: 'title', label: 'Title *' },
    { key: 'author', label: 'Author *' },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'topic', label: 'Topic (e.g. Pregnancy, Sleep)' },
    { key: 'rating', label: 'Rating (1–5)', numeric: true },
    { key: 'reviews', label: 'Review Count', numeric: true },
    { key: 'url', label: 'Buy URL' },
    { key: 'sampleUrl', label: 'Sample/Preview URL' },
    { key: 'imageUrl', label: 'Cover Image URL' },
    { key: 'ageMin', label: 'Age Min (months; -9 = pregnancy)', numeric: true },
    { key: 'ageMax', label: 'Age Max (months; 999 = all ages)', numeric: true },
  ],
  articles: [
    { key: 'title', label: 'Title *' },
    { key: 'preview', label: 'Preview (short summary) *', multiline: true },
    { key: 'body', label: 'Full Body Text', multiline: true },
    { key: 'topic', label: 'Topic (Feeding, Sleep, Nutrition…)' },
    { key: 'readTime', label: 'Read Time (e.g. "4 min read")' },
    { key: 'emoji', label: 'Emoji icon' },
    { key: 'tag', label: 'Tag (e.g. Breastfeeding)' },
    { key: 'url', label: 'External URL (optional)' },
    { key: 'imageUrl', label: 'Header Image URL' },
    { key: 'ageMin', label: 'Age Min (months; -9 = pregnancy)', numeric: true },
    { key: 'ageMax', label: 'Age Max (months; 999 = all ages)', numeric: true },
  ],
  products: [
    { key: 'name', label: 'Product Name *' },
    { key: 'category', label: 'Category (Feeding, Sleep, Skincare…)' },
    { key: 'emoji', label: 'Emoji' },
    { key: 'price', label: 'Price (₹)', numeric: true },
    { key: 'originalPrice', label: 'Original Price (₹)', numeric: true },
    { key: 'rating', label: 'Rating (1–5)', numeric: true },
    { key: 'reviews', label: 'Review Count', numeric: true },
    { key: 'badge', label: 'Badge (e.g. Best Seller)' },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'url', label: 'Affiliate / Buy URL' },
    { key: 'imageUrl', label: 'Product Image URL' },
  ],
  schemes: [
    { key: 'name', label: 'Scheme Name *' },
    { key: 'shortName', label: 'Short Name / Abbreviation' },
    { key: 'emoji', label: 'Emoji' },
    { key: 'shortDesc', label: 'Short Description (one line) *' },
    { key: 'description', label: 'Full Description', multiline: true },
    { key: 'eligibility', label: 'Eligibility', multiline: true },
    { key: 'benefit', label: 'What They Get', multiline: true },
    { key: 'howToApply', label: 'How To Apply', multiline: true },
    { key: 'url', label: 'Official Government URL' },
    { key: 'tags', label: 'Tags (comma-separated: pregnant, newborn, girl, all-kids)', hint: 'e.g. pregnant,newborn' },
  ],
  yoga: [
    { key: 'name', label: 'Session Name *' },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'duration', label: 'Duration (e.g. 20 min)' },
    { key: 'level', label: 'Level (Beginner / Intermediate / Advanced)' },
    { key: 'poses', label: 'Poses (comma-separated)' },
    { key: 'trimester', label: 'Trimester (1, 2, 3 or All)' },
    { key: 'emoji', label: 'Emoji' },
  ],
};

const TAB_META: Record<ContentTab, { label: string; icon: string; collection: string; primaryKey: string }> = {
  books:    { label: '📗 Books',    icon: 'book-outline',          collection: 'books',           primaryKey: 'title' },
  articles: { label: '📰 Articles', icon: 'newspaper-outline',     collection: 'articles',        primaryKey: 'title' },
  products: { label: '🛍️ Products', icon: 'bag-handle-outline',    collection: 'products',        primaryKey: 'name'  },
  schemes:  { label: '🇮🇳 Schemes',  icon: 'ribbon-outline',        collection: 'schemes',         primaryKey: 'name'  },
  yoga:     { label: '🧘 Yoga',     icon: 'body-outline',          collection: 'yoga',            primaryKey: 'name'  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDisplayTitle(item: ContentItem, tab: ContentTab): string {
  return item[TAB_META[tab].primaryKey] ?? item.title ?? item.name ?? '(Untitled)';
}

function getDisplaySub(item: ContentItem, tab: ContentTab): string {
  switch (tab) {
    case 'books':    return `${item.author ?? ''} · ${item.topic ?? ''}`.trim().replace(/^·|·$/, '').trim();
    case 'articles': return `${item.topic ?? ''} · ${item.readTime ?? ''}`.trim().replace(/^·|·$/, '').trim();
    case 'products': return `${item.category ?? ''} · ₹${item.price ?? ''}`.trim().replace(/^·|·$/, '').trim();
    case 'schemes':  return item.shortDesc ?? '';
    case 'yoga':     return `${item.level ?? ''} · ${item.duration ?? ''}`.trim().replace(/^·|·$/, '').trim();
    default:         return '';
  }
}

function blankItem(tab: ContentTab): ContentItem {
  const item: ContentItem = {};
  SCHEMAS[tab].forEach((f) => { item[f.key] = ''; });
  return item;
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

function FormModal({
  visible,
  tab,
  item,
  onClose,
  onSave,
}: {
  visible: boolean;
  tab: ContentTab;
  item: ContentItem | null;
  onClose: () => void;
  onSave: (data: ContentItem) => Promise<void>;
}) {
  const isEdit = !!(item?.id);
  const [form, setForm] = useState<ContentItem>(item ?? blankItem(tab));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(item ?? blankItem(tab));
  }, [item, tab, visible]);

  const schema = SCHEMAS[tab];
  const primaryField = schema[0];
  const isValid = !!(form[primaryField.key]?.toString().trim());

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={fStyles.header}>
          <TouchableOpacity onPress={onClose} style={fStyles.headerBtn}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
          <Text style={fStyles.headerTitle}>{isEdit ? `Edit ${TAB_META[tab].label}` : `Add ${TAB_META[tab].label}`}</Text>
          <TouchableOpacity
            style={[fStyles.saveBtn, !isValid && fStyles.saveBtnDim]}
            onPress={handleSave}
            disabled={!isValid || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={fStyles.saveBtnText}>{isEdit ? 'Update' : 'Add'}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={fStyles.body} keyboardShouldPersistTaps="handled">
          {schema.map((field) => (
            <View key={field.key} style={fStyles.fieldWrap}>
              <Text style={fStyles.label}>{field.label}</Text>
              {field.hint && <Text style={fStyles.hint}>{field.hint}</Text>}
              <TextInput
                style={[fStyles.input, field.multiline && fStyles.textArea]}
                value={String(form[field.key] ?? '')}
                onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: field.numeric ? v : v }))}
                multiline={field.multiline}
                keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                autoCapitalize={field.key === 'url' || field.key === 'imageUrl' || field.key === 'sampleUrl' ? 'none' : 'sentences'}
                placeholderTextColor="#9ca3af"
                placeholder={field.label.replace(' *', '')}
              />
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  saveBtn: {
    backgroundColor: '#ec4899', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  saveBtnDim: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { padding: 16, gap: 4 },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  hint: { fontSize: 11, color: '#9ca3af', marginBottom: 4 },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#e5e7eb',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
});

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  tab,
  onEdit,
  onDelete,
}: {
  item: ContentItem;
  tab: ContentTab;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const title = getDisplayTitle(item, tab);
  const sub   = getDisplaySub(item, tab);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemEmoji}>
        <Text style={{ fontSize: 22 }}>{item.emoji ?? TAB_META[tab].icon.charAt(0)}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={styles.itemSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.7}>
        <Ionicons name="pencil-outline" size={16} color="#8b5cf6" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: ContentTab; onChange: (t: ContentTab) => void }) {
  const tabs = Object.keys(TAB_META) as ContentTab[];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t}
          style={[styles.tab, t === active && styles.tabActive]}
          onPress={() => onChange(t)}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, t === active && styles.tabTextActive]}>
            {TAB_META[t].label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContentScreen() {
  const [tab, setTab] = useState<ContentTab>('books');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { loadContent(); }, [tab]);

  async function loadContent() {
    setLoading(true);
    const data = await getContent(TAB_META[tab].collection);
    setItems(data);
    setLoading(false);
  }

  async function doRefresh() {
    setRefreshing(true);
    const data = await getContent(TAB_META[tab].collection);
    setItems(data);
    setRefreshing(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function openAdd() {
    setEditingItem(null);
    setModalVisible(true);
  }

  function openEdit(item: ContentItem) {
    setEditingItem(item);
    setModalVisible(true);
  }

  async function handleSave(data: ContentItem) {
    const col = TAB_META[tab].collection;

    // Convert numeric fields
    const schema = SCHEMAS[tab];
    const cleaned: ContentItem = { ...data };
    schema.forEach((f) => {
      if (f.numeric && cleaned[f.key] !== '') {
        cleaned[f.key] = parseFloat(cleaned[f.key]) || 0;
      }
      // Tags field: convert comma string to array for schemes
      if (tab === 'schemes' && f.key === 'tags' && typeof cleaned.tags === 'string') {
        cleaned.tags = cleaned.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    });

    if (editingItem?.id) {
      await updateContent(col, editingItem.id, cleaned);
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? { ...i, ...cleaned } : i)));
      showToast('✅ Updated successfully');
    } else {
      const newId = await createContent(col, cleaned);
      setItems((prev) => [{ ...cleaned, id: newId ?? Date.now().toString() }, ...prev]);
      showToast('✅ Added to library');
    }
    setModalVisible(false);
  }

  function confirmDelete(item: ContentItem) {
    const title = getDisplayTitle(item, tab);
    Alert.alert('Delete', `Remove "${title}"?\n\nThis will hide it from all users immediately.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!item.id) return;
          await deleteContent(TAB_META[tab].collection, item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          showToast('🗑️ Deleted');
        },
      },
    ]);
  }

  const primaryKey = TAB_META[tab].primaryKey;
  const filtered = items.filter((i) =>
    (i[primaryKey] ?? i.title ?? i.name ?? '')
      .toString().toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <TabBar active={tab} onChange={(t) => { setTab(t); setSearch(''); }} />

      {/* Search + Add Row */}
      <View style={styles.actionRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={15} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <LinearGradient colors={['#ec4899', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGrad}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Count */}
      <Text style={styles.countText}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={doRefresh} tintColor="#ec4899" />}
      >
        {loading ? (
          <ActivityIndicator color="#ec4899" style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={TAB_META[tab].icon as any} size={36} color="#d1d5db" />
            <Text style={styles.emptyText}>No {TAB_META[tab].label} yet</Text>
            <TouchableOpacity style={styles.emptyAdd} onPress={openAdd}>
              <Text style={styles.emptyAddText}>+ Add the first one</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((item) => (
            <ItemCard
              key={item.id ?? item.title}
              item={item}
              tab={tab}
              onEdit={() => openEdit(item)}
              onDelete={() => confirmDelete(item)}
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Form Modal */}
      <FormModal
        visible={modalVisible}
        tab={tab}
        item={editingItem}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },

  tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  tabActive: { backgroundColor: '#fdf2f8', borderWidth: 1, borderColor: '#ec4899' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#ec4899' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  addBtn: { borderRadius: 10, overflow: 'hidden' },
  addBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  countText: { fontSize: 12, color: '#9ca3af', paddingHorizontal: 16, marginBottom: 4, fontWeight: '600' },

  list: { paddingHorizontal: 16 },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  itemEmoji: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#fdf2f8',
    alignItems: 'center', justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  itemSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  editBtn: { padding: 8 },
  deleteBtn: { padding: 8 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 15, color: '#9ca3af' },
  emptyAdd: { marginTop: 6 },
  emptyAddText: { fontSize: 14, color: '#ec4899', fontWeight: '700' },

  toast: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: '#1a1a2e', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
