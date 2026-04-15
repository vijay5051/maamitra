import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentTab = 'articles' | 'products' | 'yoga' | 'schemes';

interface Article {
  id?: string;
  title: string;
  preview: string;
  topic: string;
  readTime: string;
  ageMin: string;
  ageMax: string;
  emoji: string;
}

interface Product {
  id?: string;
  name: string;
  category: string;
  price: string;
  originalPrice: string;
  rating: string;
  emoji: string;
  badge: string;
}

interface Yoga {
  id?: string;
  name: string;
  description: string;
  duration: string;
  level: string;
  poses: string;
}

interface Scheme {
  id?: string;
  name: string;
  shortDesc: string;
  eligibility: string;
  url: string;
  emoji: string;
}

type ContentItem = Article | Product | Yoga | Scheme;

const ARTICLE_TOPICS = ['Pregnancy', 'Newborn', 'Toddler', 'Nutrition', 'Mental Health', 'Wellness'];
const YOGA_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <View style={[styles.toast, type === 'error' ? styles.toastError : styles.toastSuccess]}>
      <Ionicons
        name={type === 'success' ? 'checkmark-circle' : 'close-circle'}
        size={16}
        color="#fff"
      />
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor="#d1d5db"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.fieldInput} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <Text style={{ color: value ? '#1a1a2e' : '#d1d5db', fontSize: 14 }}>
          {value || `Select ${label}`}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.dropdownItem, value === opt && styles.dropdownItemActive]}
              onPress={() => { onChange(opt); setOpen(false); }}
            >
              <Text style={[styles.dropdownItemText, value === opt && { color: '#ec4899' }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Firebase not configured banner ──────────────────────────────────────────

function FirebaseBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons name="warning-outline" size={16} color="#92400e" />
      <Text style={styles.bannerText}>Connect Firebase to edit content</Text>
    </View>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  title,
  subtitle,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.itemSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
          <Ionicons name="pencil" size={14} color="#ec4899" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash" size={14} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Article Form ─────────────────────────────────────────────────────────────

function ArticleForm({ data, onChange }: { data: Article; onChange: (d: Article) => void }) {
  return (
    <>
      <Field label="Title" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <Field label="Preview" value={data.preview} onChange={(v) => onChange({ ...data, preview: v })} multiline />
      <Dropdown
        label="Topic"
        value={data.topic}
        options={ARTICLE_TOPICS}
        onChange={(v) => onChange({ ...data, topic: v })}
      />
      <Field label="Read Time (e.g. 5 min)" value={data.readTime} onChange={(v) => onChange({ ...data, readTime: v })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Age Min" value={data.ageMin} onChange={(v) => onChange({ ...data, ageMin: v })} placeholder="0" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Age Max" value={data.ageMax} onChange={(v) => onChange({ ...data, ageMax: v })} placeholder="12" />
        </View>
      </View>
      <Field label="Emoji" value={data.emoji} onChange={(v) => onChange({ ...data, emoji: v })} placeholder="📖" />
    </>
  );
}

// ─── Product Form ─────────────────────────────────────────────────────────────

function ProductForm({ data, onChange }: { data: Product; onChange: (d: Product) => void }) {
  return (
    <>
      <Field label="Name" value={data.name} onChange={(v) => onChange({ ...data, name: v })} />
      <Field label="Category" value={data.category} onChange={(v) => onChange({ ...data, category: v })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Price" value={data.price} onChange={(v) => onChange({ ...data, price: v })} placeholder="499" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Original Price" value={data.originalPrice} onChange={(v) => onChange({ ...data, originalPrice: v })} placeholder="799" />
        </View>
      </View>
      <Field label="Rating (1-5)" value={data.rating} onChange={(v) => onChange({ ...data, rating: v })} placeholder="4.5" />
      <Field label="Emoji" value={data.emoji} onChange={(v) => onChange({ ...data, emoji: v })} placeholder="🛍️" />
      <Field label="Badge (e.g. Bestseller)" value={data.badge} onChange={(v) => onChange({ ...data, badge: v })} />
    </>
  );
}

// ─── Yoga Form ────────────────────────────────────────────────────────────────

function YogaForm({ data, onChange }: { data: Yoga; onChange: (d: Yoga) => void }) {
  return (
    <>
      <Field label="Name" value={data.name} onChange={(v) => onChange({ ...data, name: v })} />
      <Field label="Description" value={data.description} onChange={(v) => onChange({ ...data, description: v })} multiline />
      <Field label="Duration (e.g. 30 min)" value={data.duration} onChange={(v) => onChange({ ...data, duration: v })} />
      <Dropdown
        label="Level"
        value={data.level}
        options={YOGA_LEVELS}
        onChange={(v) => onChange({ ...data, level: v })}
      />
      <Field
        label="Poses (comma-separated)"
        value={data.poses}
        onChange={(v) => onChange({ ...data, poses: v })}
        multiline
        placeholder="Cat Pose, Cow Pose, Child's Pose"
      />
    </>
  );
}

// ─── Scheme Form ──────────────────────────────────────────────────────────────

function SchemeForm({ data, onChange }: { data: Scheme; onChange: (d: Scheme) => void }) {
  return (
    <>
      <Field label="Name" value={data.name} onChange={(v) => onChange({ ...data, name: v })} />
      <Field label="Short Description" value={data.shortDesc} onChange={(v) => onChange({ ...data, shortDesc: v })} multiline />
      <Field label="Eligibility" value={data.eligibility} onChange={(v) => onChange({ ...data, eligibility: v })} multiline />
      <Field label="URL" value={data.url} onChange={(v) => onChange({ ...data, url: v })} placeholder="https://" />
      <Field label="Emoji" value={data.emoji} onChange={(v) => onChange({ ...data, emoji: v })} placeholder="🏛️" />
    </>
  );
}

// ─── Blank Forms ──────────────────────────────────────────────────────────────

const blankArticle = (): Article => ({ title: '', preview: '', topic: '', readTime: '', ageMin: '', ageMax: '', emoji: '' });
const blankProduct = (): Product => ({ name: '', category: '', price: '', originalPrice: '', rating: '', emoji: '', badge: '' });
const blankYoga = (): Yoga => ({ name: '', description: '', duration: '', level: '', poses: '' });
const blankScheme = (): Scheme => ({ name: '', shortDesc: '', eligibility: '', url: '', emoji: '' });

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminContent() {
  const [activeTab, setActiveTab] = useState<ContentTab>('articles');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const TABS: { key: ContentTab; label: string }[] = [
    { key: 'articles', label: 'Articles' },
    { key: 'products', label: 'Products' },
    { key: 'yoga', label: 'Yoga' },
    { key: 'schemes', label: 'Schemes' },
  ];

  useEffect(() => {
    loadItems();
  }, [activeTab]);

  async function loadItems() {
    setLoading(true);
    try {
      const { getContent } = await import('../../services/firebase');
      const data = await getContent(activeTab);
      setItems(data as ContentItem[]);
      setFirebaseReady(true);
    } catch {
      setFirebaseReady(false);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function openModal(item: ContentItem | null) {
    setEditingItem(item ?? getBlank());
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }

  function closeModal() {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setEditingItem(null);
    });
  }

  function getBlank(): ContentItem {
    if (activeTab === 'articles') return blankArticle();
    if (activeTab === 'products') return blankProduct();
    if (activeTab === 'yoga') return blankYoga();
    return blankScheme();
  }

  function getItemTitle(item: ContentItem): string {
    if ('title' in item) return (item as Article).title;
    if ('name' in item) return (item as Product | Yoga | Scheme).name;
    return 'Untitled';
  }

  function getItemSubtitle(item: ContentItem): string {
    if (activeTab === 'articles') return (item as Article).topic;
    if (activeTab === 'products') return (item as Product).category;
    if (activeTab === 'yoga') return (item as Yoga).level;
    return (item as Scheme).shortDesc;
  }

  async function handleSave() {
    if (!editingItem) return;
    try {
      const { createContent, updateContent } = await import('../../services/firebase');
      if ((editingItem as any).id) {
        await updateContent(activeTab, (editingItem as any).id, editingItem);
        showToast('Updated successfully!', 'success');
      } else {
        await createContent(activeTab, editingItem);
        showToast('Created successfully!', 'success');
      }
      closeModal();
      loadItems();
    } catch {
      showToast('Save failed. Check Firebase connection.', 'error');
    }
  }

  function handleDelete(item: ContentItem) {
    Alert.alert(
      'Delete',
      `Are you sure you want to delete "${getItemTitle(item)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { deleteContent } = await import('../../services/firebase');
              await deleteContent(activeTab, (item as any).id);
              showToast('Deleted successfully!', 'success');
              loadItems();
            } catch {
              showToast('Delete failed.', 'error');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {!firebaseReady && <FirebaseBanner />}

      {/* Tab Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add New Button */}
      <View style={styles.addRow}>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal(null)} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add New</Text>
        </TouchableOpacity>
      </View>

      {/* Items List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={40} color="#d1d5db" />
            <Text style={styles.emptyText}>No items yet. Add your first one!</Text>
          </View>
        ) : (
          items.map((item, index) => (
            <ItemCard
              key={(item as any).id ?? index}
              title={getItemTitle(item)}
              subtitle={getItemSubtitle(item)}
              onEdit={() => openModal(item)}
              onDelete={() => handleDelete(item)}
            />
          ))
        )}
      </ScrollView>

      {/* Toast */}
      {toast && (
        <View style={styles.toastContainer}>
          <Toast message={toast.message} type={toast.type} />
        </View>
      )}

      {/* Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingItem && (editingItem as any).id ? 'Edit' : 'Add'}{' '}
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {activeTab === 'articles' && editingItem && (
                <ArticleForm data={editingItem as Article} onChange={setEditingItem} />
              )}
              {activeTab === 'products' && editingItem && (
                <ProductForm data={editingItem as Product} onChange={setEditingItem} />
              )}
              {activeTab === 'yoga' && editingItem && (
                <YogaForm data={editingItem as Yoga} onChange={setEditingItem} />
              )}
              {activeTab === 'schemes' && editingItem && (
                <SchemeForm data={editingItem as Scheme} onChange={setEditingItem} />
              )}
              <View style={{ height: 16 }} />
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  bannerText: { fontSize: 13, color: '#92400e', fontWeight: '600' },

  tabBar: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6', maxHeight: 50 },
  tabBarContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tabBtnActive: { backgroundColor: '#fce7f3' },
  tabBtnText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  tabBtnTextActive: { color: '#ec4899' },

  addRow: { paddingHorizontal: 16, paddingVertical: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ec4899',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  list: { flex: 1 },
  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  loadingText: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf6ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0e6ff',
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  itemSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toastContainer: { position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  toastSuccess: { backgroundColor: '#10b981' },
  toastError: { backgroundColor: '#ef4444' },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  sheetScroll: { paddingHorizontal: 20, paddingTop: 8 },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a2e',
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  dropdownList: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownItemActive: { backgroundColor: '#fdf6ff' },
  dropdownItemText: { fontSize: 14, color: '#1a1a2e' },

  saveBtn: {
    margin: 16,
    backgroundColor: '#ec4899',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
