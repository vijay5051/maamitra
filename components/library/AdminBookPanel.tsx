import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchBookByUrl, searchBooks, FetchedBook } from '../../services/bookFetch';
import { useBookStore, DynamicBook } from '../../store/useBookStore';

// ─── Topic options ─────────────────────────────────────────────────────────────
const TOPICS = [
  'Pregnancy', 'Newborn Care', 'Breastfeeding', 'Nutrition', 'Sleep',
  'Development', 'Parenting', 'Yoga & Wellness', 'Self-Care', 'Mental Health',
];

// ─── Age range presets ────────────────────────────────────────────────────────
const AGE_PRESETS = [
  { label: 'Pregnancy', min: -9, max: 0 },
  { label: '0–3 mo', min: 0, max: 3 },
  { label: '3–6 mo', min: 3, max: 6 },
  { label: '6–12 mo', min: 6, max: 12 },
  { label: '1–3 yr', min: 12, max: 36 },
  { label: 'All ages', min: -9, max: 999 },
];

// ─── Cover preview ─────────────────────────────────────────────────────────────
function CoverPreview({ imageUrl, title }: { imageUrl?: string; title: string }) {
  const [err, setErr] = useState(false);
  if (imageUrl && !err) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={s.coverImg}
        resizeMode="cover"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <LinearGradient colors={['#7C3AED', '#8b5cf6']} style={s.coverFallback}>
      <Text style={s.coverFallbackText}>{title.charAt(0)}</Text>
    </LinearGradient>
  );
}

// ─── Search result item ────────────────────────────────────────────────────────
function ResultItem({
  book,
  onSelect,
}: {
  book: FetchedBook;
  onSelect: (b: FetchedBook) => void;
}) {
  return (
    <TouchableOpacity style={s.resultItem} activeOpacity={0.75} onPress={() => onSelect(book)}>
      <CoverPreview imageUrl={book.imageUrl} title={book.title} />
      <View style={s.resultInfo}>
        <Text style={s.resultTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={s.resultAuthor} numberOfLines={1}>{book.author}</Text>
        {book.rating > 0 && (
          <Text style={s.resultRating}>⭐ {book.rating.toFixed(1)}</Text>
        )}
        {book.categories[0] && (
          <Text style={s.resultCat}>{book.categories[0]}</Text>
        )}
      </View>
      <Ionicons name="add-circle" size={22} color="#7C3AED" />
    </TouchableOpacity>
  );
}

// ─── Edit form ─────────────────────────────────────────────────────────────────
interface EditFormProps {
  initial: FetchedBook | null;
  onSave: (data: Omit<DynamicBook, 'id' | 'addedAt'>) => void;
  onCancel: () => void;
}

function EditForm({ initial, onSave, onCancel }: EditFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [rating, setRating] = useState(String(initial?.rating?.toFixed(1) ?? '4.5'));
  const [reviews, setReviews] = useState(String(initial?.reviews ?? '0'));
  const [topic, setTopic] = useState(initial?.categories?.[0] ?? TOPICS[0]);
  const [buyUrl, setBuyUrl] = useState('');
  const [sampleUrl, setSampleUrl] = useState('');
  const [agePreset, setAgePreset] = useState(AGE_PRESETS[5]); // All ages default

  const handleSave = () => {
    if (!title.trim() || !buyUrl.trim()) return;
    onSave({
      title: title.trim(),
      author: author.trim() || 'Unknown Author',
      description: description.trim(),
      rating: parseFloat(rating) || 0,
      reviews: parseInt(reviews) || 0,
      imageUrl: initial?.imageUrl,
      topic: TOPICS.includes(topic) ? topic : TOPICS[0],
      url: buyUrl.trim(),
      sampleUrl: sampleUrl.trim() || undefined,
      ageMin: agePreset.min,
      ageMax: agePreset.max,
      googleBooksId: initial?.googleBooksId,
    });
  };

  return (
    <ScrollView style={s.editScroll} showsVerticalScrollIndicator={false}>
      <Text style={s.formSection}>Book Details</Text>

      {/* Cover preview */}
      <View style={s.coverRow}>
        <CoverPreview imageUrl={initial?.imageUrl} title={title} />
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Book title" placeholderTextColor="#9ca3af" />
          <Text style={s.label}>Author</Text>
          <TextInput style={s.input} value={author} onChangeText={setAuthor} placeholder="Author name" placeholderTextColor="#9ca3af" />
        </View>
      </View>

      <Text style={s.label}>Description</Text>
      <TextInput
        style={[s.input, s.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Brief description…"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={3}
      />

      {/* Rating + Reviews */}
      <View style={s.ratingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Rating (0–5)</Text>
          <TextInput style={s.input} value={rating} onChangeText={setRating} keyboardType="decimal-pad" placeholder="4.5" placeholderTextColor="#9ca3af" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.label}>Reviews count</Text>
          <TextInput style={s.input} value={reviews} onChangeText={setReviews} keyboardType="number-pad" placeholder="1200" placeholderTextColor="#9ca3af" />
        </View>
      </View>

      {/* Topic */}
      <Text style={s.label}>Topic</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll}>
        {TOPICS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.chip, t === topic && s.chipActive]}
            onPress={() => setTopic(t)}
            activeOpacity={0.75}
          >
            <Text style={[s.chipText, t === topic && s.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Age range */}
      <Text style={s.label}>Age range</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll}>
        {AGE_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.label}
            style={[s.chip, p.label === agePreset.label && s.chipActive]}
            onPress={() => setAgePreset(p)}
            activeOpacity={0.75}
          >
            <Text style={[s.chipText, p.label === agePreset.label && s.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* URLs */}
      <Text style={s.label}>Buy / Product URL *</Text>
      <TextInput
        style={s.input}
        value={buyUrl}
        onChangeText={setBuyUrl}
        placeholder="https://www.amazon.in/dp/..."
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text style={s.label}>Sample / Preview URL (optional)</Text>
      <TextInput
        style={s.input}
        value={sampleUrl}
        onChangeText={setSampleUrl}
        placeholder="https://books.google.com/..."
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        keyboardType="url"
      />

      {/* Buttons */}
      <View style={s.formActions}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, (!title.trim() || !buyUrl.trim()) && s.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={15} color="#fff" />
          <Text style={s.saveBtnText}>Add to Library</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Saved book row ────────────────────────────────────────────────────────────
function SavedBookRow({
  book,
  onDelete,
}: {
  book: DynamicBook;
  onDelete: () => void;
}) {
  return (
    <View style={s.savedRow}>
      <CoverPreview imageUrl={book.imageUrl} title={book.title} />
      <View style={s.savedInfo}>
        <Text style={s.savedTitle} numberOfLines={1}>{book.title}</Text>
        <Text style={s.savedMeta}>{book.author} · {book.topic}</Text>
        {book.rating > 0 && <Text style={s.savedRating}>⭐ {book.rating.toFixed(1)}</Text>}
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface AdminBookPanelProps {
  visible: boolean;
  onClose: () => void;
}

type PanelTab = 'add' | 'saved';
type AddStep = 'search' | 'edit';

export default function AdminBookPanel({ visible, onClose }: AdminBookPanelProps) {
  const { books, addBook, removeBook } = useBookStore();

  const [panelTab, setPanelTab] = useState<PanelTab>('add');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FetchedBook[]>([]);
  const [step, setStep] = useState<AddStep>('search');
  const [selected, setSelected] = useState<FetchedBook | null>(null);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);

    try {
      // Try URL fetch first
      if (query.startsWith('http')) {
        const book = await fetchBookByUrl(query);
        if (book) {
          setSelected(book);
          setStep('edit');
          setLoading(false);
          return;
        }
        // URL fetch failed — open manual form with URL pre-filled
        setSelected(null);
        setStep('edit');
        setLoading(false);
        return;
      }
      // Title/author search
      const res = await searchBooks(query);
      if (res.length === 0) setError('No books found. Try a different title or author.');
      setResults(res);
    } catch (e: any) {
      // API error (503, network) → offer manual entry instead
      setError(`Google Books is unavailable right now. Enter details manually below.`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSelectResult = (book: FetchedBook) => {
    setSelected(book);
    setStep('edit');
  };

  const handleSave = (data: Omit<DynamicBook, 'id' | 'addedAt'>) => {
    addBook(data);
    // Reset state
    setStep('search');
    setSelected(null);
    setQuery('');
    setResults([]);
    setPanelTab('saved');
  };

  const handleCancel = () => {
    setStep('search');
    setSelected(null);
    setResults([]);
  };

  const reset = () => {
    setStep('search');
    setSelected(null);
    setQuery('');
    setResults([]);
    setError('');
    setPanelTab('add');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.modal}>
        {/* Header */}
        <View style={s.header}>
          <LinearGradient colors={['#7C3AED', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={s.headerContent}>
            <View>
              <Text style={s.headerTitle}>📚 Book Admin</Text>
              <Text style={s.headerSub}>Add & manage library books</Text>
            </View>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['add', 'saved'] as PanelTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.tab, panelTab === t && s.tabActive]}
              onPress={() => setPanelTab(t)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, panelTab === t && s.tabTextActive]}>
                {t === 'add' ? '➕ Add Book' : `📖 Saved (${books.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── ADD TAB ── */}
        {panelTab === 'add' && (
          <View style={s.flex}>
            {step === 'search' && (
              <>
                {/* Search input */}
                <View style={s.searchBox}>
                  <Text style={s.searchLabel}>Paste Amazon/Google Books URL or search by title</Text>
                  <View style={s.searchRow}>
                    <TextInput
                      style={s.searchInput}
                      value={query}
                      onChangeText={setQuery}
                      placeholder="e.g. The Baby Book or amazon.in/dp/..."
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="none"
                      returnKeyType="search"
                      onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity
                      style={[s.searchBtn, !query.trim() && s.searchBtnDisabled]}
                      onPress={handleSearch}
                      activeOpacity={0.8}
                      disabled={!query.trim()}
                    >
                      {loading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="search" size={18} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Error + manual fallback */}
                {error !== '' && (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={s.errorText}>{error}</Text>
                      <TouchableOpacity
                        style={s.manualBtn}
                        onPress={() => { setSelected(null); setStep('edit'); }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="create-outline" size={13} color="#8b5cf6" />
                        <Text style={s.manualBtnText}>Enter details manually →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Results */}
                {results.length > 0 && (
                  <ScrollView style={s.resultsList} showsVerticalScrollIndicator={false}>
                    <Text style={s.resultsHeader}>
                      {results.length} result{results.length !== 1 ? 's' : ''} — tap to add
                    </Text>
                    {results.map((b, i) => (
                      <ResultItem key={b.googleBooksId ?? i} book={b} onSelect={handleSelectResult} />
                    ))}
                  </ScrollView>
                )}

                {/* Hint when empty */}
                {results.length === 0 && !loading && error === '' && (
                  <View style={s.hint}>
                    <Text style={s.hintEmoji}>🔍</Text>
                    <Text style={s.hintText}>Search for a book by title, author, or paste a URL to auto-fill details</Text>
                  </View>
                )}
              </>
            )}

            {step === 'edit' && (
              <EditForm initial={selected} onSave={handleSave} onCancel={handleCancel} />
            )}
          </View>
        )}

        {/* ── SAVED TAB ── */}
        {panelTab === 'saved' && (
          <ScrollView style={s.savedList} showsVerticalScrollIndicator={false}>
            {books.length === 0 ? (
              <View style={s.hint}>
                <Text style={s.hintEmoji}>📚</Text>
                <Text style={s.hintText}>No books added yet. Use the Add tab to add books to the library.</Text>
              </View>
            ) : (
              books.map((b) => (
                <SavedBookRow key={b.id} book={b} onDelete={() => removeBook(b.id)} />
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#f9fafb' },
  flex: { flex: 1 },

  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },

  tabs: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3e8ff' },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#7C3AED' },

  // Search box
  searchBox: { padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3e8ff' },
  searchLabel: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, height: 44, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#1a1a2e',
  },
  searchBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnDisabled: { backgroundColor: '#f3a8d0' },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, margin: 16, padding: 12, backgroundColor: '#fef2f2', borderRadius: 10 },
  errorText: { fontSize: 13, color: '#ef4444' },
  manualBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  manualBtnText: { fontSize: 12, color: '#8b5cf6', fontWeight: '700' },

  resultsList: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  resultsHeader: { fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: '600' },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff',
    borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    boxShadow: '0px 1px 4px rgba(0,0,0,0.06)',
  } as any,
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', lineHeight: 19 },
  resultAuthor: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  resultRating: { fontSize: 12, color: '#f59e0b', marginTop: 3 },
  resultCat: { fontSize: 11, color: '#8b5cf6', marginTop: 2, fontWeight: '600' },

  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  hintEmoji: { fontSize: 48 },
  hintText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 21 },

  // Edit form
  editScroll: { flex: 1, padding: 16 },
  formSection: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginBottom: 14 },
  coverRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, marginTop: 8 },
  input: {
    height: 42, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#1a1a2e',
  },
  textArea: { height: 72, paddingTop: 10, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', gap: 10 },

  chipsScroll: { marginBottom: 4 },
  chip: {
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', marginRight: 6,
  },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  chipTextActive: { color: '#ffffff' },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 32 },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  saveBtn: {
    flex: 2, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6, backgroundColor: '#7C3AED',
  },
  saveBtnDisabled: { backgroundColor: '#f3a8d0' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  // Cover
  coverImg: { width: 64, height: 88, borderRadius: 8 },
  coverFallback: {
    width: 64, height: 88, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  coverFallbackText: { fontSize: 28, color: '#ffffff', fontWeight: '800' },

  // Saved
  savedList: { flex: 1, padding: 16 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff',
    borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    boxShadow: '0px 1px 4px rgba(0,0,0,0.06)',
  } as any,
  savedInfo: { flex: 1 },
  savedTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  savedMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  savedRating: { fontSize: 11, color: '#f59e0b', marginTop: 2 },
});
