/**
 * AdminPanel — unified Library content admin (Books · Articles · Products)
 * Tap the + button in Library header to open.
 */
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

import { searchBooks, fetchBookByUrl, FetchedBook } from '../../services/bookFetch';
import { fetchUrlMeta, PageMeta } from '../../services/metaFetch';
import { useBookStore, DynamicBook } from '../../store/useBookStore';
import { useArticleStore, DynamicArticle } from '../../store/useArticleStore';
import { useProductStore, DynamicProduct } from '../../store/useProductStore';

// ─── Constants ────────────────────────────────────────────────────────────────

type AdminType = 'books' | 'articles' | 'products';
type PanelTab = 'add' | 'saved';
type AddStep = 'search' | 'edit';

const BOOK_TOPICS = ['Pregnancy', 'Newborn Care', 'Breastfeeding', 'Nutrition', 'Sleep', 'Development', 'Parenting', 'Yoga & Wellness', 'Self-Care', 'Mental Health'];
const ARTICLE_TOPICS = ['Feeding', 'Sleep', 'Development', 'Postpartum', 'Vaccination', 'Nutrition', 'Mental Health', 'Yoga', 'Baby Care'];
const PRODUCT_CATEGORIES = ['Feeding', 'Skincare', 'Sleep', 'Development', 'Mother'];

const AGE_PRESETS = [
  { label: 'Pregnancy', min: -9, max: 0 },
  { label: '0–3 mo', min: 0, max: 3 },
  { label: '3–6 mo', min: 3, max: 6 },
  { label: '6–12 mo', min: 6, max: 12 },
  { label: '1–3 yr', min: 12, max: 36 },
  { label: 'All ages', min: -9, max: 999 },
];

const TOPIC_EMOJIS: Record<string, string> = {
  Feeding: '🥣', Sleep: '😴', Development: '🌱', Postpartum: '🌸',
  Vaccination: '💉', Nutrition: '🥗', 'Mental Health': '💙', Yoga: '🧘', 'Baby Care': '👶',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  Feeding: '🍼', Skincare: '🧴', Sleep: '😴', Development: '🧸', Mother: '🤱',
};

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function CoverImg({ uri, title, size = 64 }: { uri?: string; title: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return <Image source={{ uri }} style={{ width: size, height: size * 1.3, borderRadius: 8 }} resizeMode="cover" onError={() => setErr(true)} />;
  }
  return (
    <LinearGradient colors={['#7C3AED', '#7C3AED']} style={{ width: size, height: size * 1.3, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.4, color: '#fff', fontWeight: '800' }}>{title.charAt(0)}</Text>
    </LinearGradient>
  );
}

function SquareCover({ uri, emoji, size = 52 }: { uri?: string; emoji: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 8 }} resizeMode="cover" onError={() => setErr(true)} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.55 }}>{emoji}</Text>
    </View>
  );
}

function ChipRow({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {options.map(o => (
        <TouchableOpacity key={o} style={[s.chip, o === selected && s.chipActive]} onPress={() => onSelect(o)} activeOpacity={0.75}>
          <Text style={[s.chipText, o === selected && s.chipTextActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function AgeChipRow({ selected, onSelect }: { selected: typeof AGE_PRESETS[0]; onSelect: (p: typeof AGE_PRESETS[0]) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {AGE_PRESETS.map(p => (
        <TouchableOpacity key={p.label} style={[s.chip, p.label === selected.label && s.chipActive]} onPress={() => onSelect(p)} activeOpacity={0.75}>
          <Text style={[s.chipText, p.label === selected.label && s.chipTextActive]}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={s.label}>{children}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={s.input} placeholderTextColor="#9ca3af" {...props} />;
}

function TextArea(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={[s.input, s.textArea]} placeholderTextColor="#9ca3af" multiline {...props} />;
}

function ErrorBox({ msg, onManual }: { msg: string; onManual?: () => void }) {
  return (
    <View style={s.errorBox}>
      <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={s.errorText}>{msg}</Text>
        {onManual && (
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={onManual}>
            <Ionicons name="create-outline" size={13} color="#7C3AED" />
            <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>Enter details manually →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SearchBox({ value, onChange, onSubmit, loading, placeholder }: { value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean; placeholder: string }) {
  return (
    <View style={s.searchBox}>
      <Text style={s.searchLabel}>Paste a URL or search by name</Text>
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput} value={value} onChangeText={onChange}
          placeholder={placeholder} placeholderTextColor="#9ca3af"
          autoCapitalize="none" returnKeyType="search" onSubmitEditing={onSubmit}
        />
        <TouchableOpacity style={[s.searchBtn, !value.trim() && s.searchBtnDim]} onPress={onSubmit} activeOpacity={0.8} disabled={!value.trim()}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SavedHeader({ count, onClear }: { count: number; onClear?: () => void }) {
  return <Text style={s.savedCount}>{count} item{count !== 1 ? 's' : ''} saved</Text>;
}

function SavedRow({ title, sub, imageUri, emoji, onDelete }: { title: string; sub: string; imageUri?: string; emoji: string; onDelete: () => void }) {
  return (
    <View style={s.savedRow}>
      <SquareCover uri={imageUri} emoji={emoji} />
      <View style={{ flex: 1 }}>
        <Text style={s.savedTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.savedMeta} numberOfLines={1}>{sub}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

function SaveCancelRow({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <View style={s.formActions}>
      <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
        <Text style={s.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.saveBtn, disabled && s.saveBtnDim]} onPress={onSave} activeOpacity={0.8} disabled={disabled}>
        <Ionicons name="checkmark" size={15} color="#fff" />
        <Text style={s.saveBtnText}>Add to Library</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── BOOKS SECTION ────────────────────────────────────────────────────────────

function BooksSection() {
  const { books, addBook, removeBook } = useBookStore();
  const [panelTab, setPanelTab] = useState<PanelTab>('add');
  const [step, setStep] = useState<AddStep>('search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FetchedBook[]>([]);
  const [selected, setSelected] = useState<FetchedBook | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [desc, setDesc] = useState('');
  const [rating, setRating] = useState('4.5');
  const [reviews, setReviews] = useState('0');
  const [topic, setTopic] = useState(BOOK_TOPICS[0]);
  const [age, setAge] = useState(AGE_PRESETS[5]);
  const [buyUrl, setBuyUrl] = useState('');
  const [sampleUrl, setSampleUrl] = useState('');

  const resetForm = useCallback((b: FetchedBook | null = null) => {
    setTitle(b?.title ?? ''); setAuthor(b?.author ?? ''); setDesc(b?.description ?? '');
    setRating(b?.rating ? b.rating.toFixed(1) : '4.5'); setReviews(String(b?.reviews ?? 0));
    setTopic(b?.categories?.[0] && BOOK_TOPICS.includes(b.categories[0]) ? b.categories[0] : BOOK_TOPICS[0]);
    setBuyUrl(''); setSampleUrl('');
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]);
    try {
      if (query.startsWith('http')) {
        const b = await fetchBookByUrl(query);
        setSelected(b); resetForm(b); setStep('edit');
        return;
      }
      const res = await searchBooks(query);
      res.length === 0 ? setError('No books found. Try a different title.') : setResults(res);
    } catch (e: any) {
      setError('Google Books unavailable. Enter details manually.');
    } finally { setLoading(false); }
  }, [query, resetForm]);

  const handleSelect = (b: FetchedBook) => { setSelected(b); resetForm(b); setStep('edit'); };

  const handleSave = () => {
    if (!title.trim() || !buyUrl.trim()) return;
    addBook({ title: title.trim(), author: author.trim() || 'Unknown', description: desc.trim(), rating: parseFloat(rating) || 0, reviews: parseInt(reviews) || 0, imageUrl: selected?.imageUrl, topic, url: buyUrl.trim(), sampleUrl: sampleUrl.trim() || undefined, ageMin: age.min, ageMax: age.max, googleBooksId: selected?.googleBooksId });
    setStep('search'); setSelected(null); setQuery(''); setResults([]); setPanelTab('saved');
  };

  return (
    <View style={s.sectionWrap}>
      <View style={s.subTabs}>
        {(['add', 'saved'] as PanelTab[]).map(t => (
          <TouchableOpacity key={t} style={[s.subTab, panelTab === t && s.subTabActive]} onPress={() => setPanelTab(t)}>
            <Text style={[s.subTabText, panelTab === t && s.subTabTextActive]}>
              {t === 'add' ? '➕ Add' : `📖 Saved (${books.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {panelTab === 'add' && (
        <View style={{ flex: 1 }}>
          {step === 'search' && (
            <>
              <SearchBox value={query} onChange={setQuery} onSubmit={handleSearch} loading={loading} placeholder="e.g. The Baby Book or amazon.in/dp/..." />
              {error !== '' && <ErrorBox msg={error} onManual={() => { setSelected(null); resetForm(null); setStep('edit'); }} />}
              {results.length > 0 && (
                <ScrollView style={s.resultsList} showsVerticalScrollIndicator={false}>
                  <Text style={s.resultsHdr}>{results.length} results — tap to select</Text>
                  {results.map((b, i) => (
                    <TouchableOpacity key={b.googleBooksId ?? i} style={s.resultItem} onPress={() => handleSelect(b)} activeOpacity={0.75}>
                      <CoverImg uri={b.imageUrl} title={b.title} size={52} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultTitle} numberOfLines={2}>{b.title}</Text>
                        <Text style={s.resultMeta}>{b.author}</Text>
                        {b.rating > 0 && <Text style={s.resultRating}>⭐ {b.rating.toFixed(1)}</Text>}
                      </View>
                      <Ionicons name="add-circle" size={22} color="#7C3AED" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {results.length === 0 && !loading && error === '' && (
                <View style={s.hint}><Text style={s.hintEmoji}>🔍</Text><Text style={s.hintText}>Search by title / author or paste an Amazon / Google Books URL</Text></View>
              )}
            </>
          )}
          {step === 'edit' && (
            <ScrollView style={s.editScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.formHead}>Book Details</Text>
              <View style={s.coverFormRow}>
                <CoverImg uri={selected?.imageUrl} title={title || '?'} size={64} />
                <View style={{ flex: 1 }}>
                  <FieldLabel>Title *</FieldLabel>
                  <Input value={title} onChangeText={setTitle} placeholder="Book title" />
                  <FieldLabel>Author</FieldLabel>
                  <Input value={author} onChangeText={setAuthor} placeholder="Author" />
                </View>
              </View>
              <FieldLabel>Description</FieldLabel>
              <TextArea value={desc} onChangeText={setDesc} placeholder="Brief description…" numberOfLines={3} />
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Rating (0–5)</FieldLabel>
                  <Input value={rating} onChangeText={setRating} keyboardType="decimal-pad" placeholder="4.5" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <FieldLabel>Reviews count</FieldLabel>
                  <Input value={reviews} onChangeText={setReviews} keyboardType="number-pad" placeholder="1200" />
                </View>
              </View>
              <FieldLabel>Topic</FieldLabel>
              <ChipRow options={BOOK_TOPICS} selected={topic} onSelect={setTopic} />
              <FieldLabel>Age range</FieldLabel>
              <AgeChipRow selected={age} onSelect={setAge} />
              <FieldLabel>Buy / Product URL *</FieldLabel>
              <Input value={buyUrl} onChangeText={setBuyUrl} placeholder="https://www.amazon.in/dp/..." autoCapitalize="none" keyboardType="url" />
              <FieldLabel>Sample URL (optional)</FieldLabel>
              <Input value={sampleUrl} onChangeText={setSampleUrl} placeholder="https://books.google.com/..." autoCapitalize="none" keyboardType="url" />
              <SaveCancelRow onSave={handleSave} onCancel={() => { setStep('search'); setResults([]); }} disabled={!title.trim() || !buyUrl.trim()} />
            </ScrollView>
          )}
        </View>
      )}

      {panelTab === 'saved' && (
        <ScrollView style={s.savedList} showsVerticalScrollIndicator={false}>
          {books.length === 0
            ? <View style={s.hint}><Text style={s.hintEmoji}>📚</Text><Text style={s.hintText}>No books added yet</Text></View>
            : books.map(b => <SavedRow key={b.id} title={b.title} sub={`${b.author} · ${b.topic}`} imageUri={b.imageUrl} emoji="📗" onDelete={() => removeBook(b.id)} />)
          }
        </ScrollView>
      )}
    </View>
  );
}

// ─── ARTICLES SECTION ─────────────────────────────────────────────────────────

function ArticlesSection() {
  const { articles, addArticle, removeArticle } = useArticleStore();
  const [panelTab, setPanelTab] = useState<PanelTab>('add');
  const [step, setStep] = useState<AddStep>('search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState(ARTICLE_TOPICS[0]);
  const [emoji, setEmoji] = useState('📰');
  const [readTime, setReadTime] = useState('5 min');
  const [age, setAge] = useState(AGE_PRESETS[5]);
  const [articleUrl, setArticleUrl] = useState('');

  const resetForm = useCallback((m: PageMeta | null = null, url = '') => {
    setTitle(m?.title ?? ''); setPreview(m?.description?.slice(0, 120) ?? ''); setBody('');
    setTopic(ARTICLE_TOPICS[0]); setEmoji('📰'); setReadTime('5 min');
    setAge(AGE_PRESETS[5]); setArticleUrl(m?.url ?? url);
  }, []);

  const handleFetch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setMeta(null);
    try {
      const m = await fetchUrlMeta(query);
      setMeta(m); resetForm(m, query); setStep('edit');
    } catch (e: any) {
      setError(e.message ?? 'Could not fetch URL metadata.');
    } finally { setLoading(false); }
  }, [query, resetForm]);

  // Auto-update emoji when topic changes
  const handleTopicChange = (t: string) => { setTopic(t); setEmoji(TOPIC_EMOJIS[t] ?? '📰'); };

  const handleSave = () => {
    if (!title.trim()) return;
    addArticle({
      title: title.trim(), preview: preview.trim() || title.trim(), body: body.trim() || preview.trim(),
      topic, readTime: readTime.trim() || '5 min', ageMin: age.min, ageMax: age.max,
      emoji, tag: topic, url: articleUrl.trim() || undefined, imageUrl: meta?.imageUrl,
    });
    setStep('search'); setMeta(null); setQuery(''); setPanelTab('saved');
  };

  return (
    <View style={s.sectionWrap}>
      <View style={s.subTabs}>
        {(['add', 'saved'] as PanelTab[]).map(t => (
          <TouchableOpacity key={t} style={[s.subTab, panelTab === t && s.subTabActive]} onPress={() => setPanelTab(t)}>
            <Text style={[s.subTabText, panelTab === t && s.subTabTextActive]}>
              {t === 'add' ? '➕ Add' : `📰 Saved (${articles.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {panelTab === 'add' && (
        <View style={{ flex: 1 }}>
          {step === 'search' && (
            <>
              <SearchBox value={query} onChange={setQuery} onSubmit={handleFetch} loading={loading} placeholder="Paste article URL (e.g. healthline.com/...)" />
              {error !== '' && <ErrorBox msg={error} onManual={() => { setMeta(null); resetForm(null, query); setStep('edit'); }} />}
              {results_placeholder()}
            </>
          )}
          {step === 'edit' && (
            <ScrollView style={s.editScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.formHead}>Article Details</Text>
              {meta?.imageUrl && (
                <Image source={{ uri: meta.imageUrl }} style={s.articleImg} resizeMode="cover" />
              )}
              <FieldLabel>Title *</FieldLabel>
              <Input value={title} onChangeText={setTitle} placeholder="Article title" />
              <FieldLabel>Preview (short description)</FieldLabel>
              <TextArea value={preview} onChangeText={setPreview} placeholder="1–2 sentence summary shown on card…" numberOfLines={2} />
              <FieldLabel>Body text (optional — shown when expanded)</FieldLabel>
              <TextArea value={body} onChangeText={setBody} placeholder="Paste or type the article content…" numberOfLines={5} />
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Emoji</FieldLabel>
                  <Input value={emoji} onChangeText={setEmoji} placeholder="📰" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <FieldLabel>Read time</FieldLabel>
                  <Input value={readTime} onChangeText={setReadTime} placeholder="5 min" />
                </View>
              </View>
              <FieldLabel>Topic</FieldLabel>
              <ChipRow options={ARTICLE_TOPICS} selected={topic} onSelect={handleTopicChange} />
              <FieldLabel>Age range</FieldLabel>
              <AgeChipRow selected={age} onSelect={setAge} />
              <FieldLabel>Source URL (optional)</FieldLabel>
              <Input value={articleUrl} onChangeText={setArticleUrl} placeholder="https://..." autoCapitalize="none" keyboardType="url" />
              <SaveCancelRow onSave={handleSave} onCancel={() => { setStep('search'); setMeta(null); }} disabled={!title.trim()} />
            </ScrollView>
          )}
        </View>
      )}

      {panelTab === 'saved' && (
        <ScrollView style={s.savedList} showsVerticalScrollIndicator={false}>
          {articles.length === 0
            ? <View style={s.hint}><Text style={s.hintEmoji}>📰</Text><Text style={s.hintText}>No articles added yet</Text></View>
            : articles.map(a => <SavedRow key={a.id} title={a.title} sub={`${a.topic} · ${a.readTime}`} imageUri={a.imageUrl} emoji={a.emoji} onDelete={() => removeArticle(a.id)} />)
          }
        </ScrollView>
      )}
    </View>
  );
}

function results_placeholder() {
  return (
    <View style={s.hint}>
      <Text style={s.hintEmoji}>🔗</Text>
      <Text style={s.hintText}>Paste any article URL — title, description and cover image are auto-fetched</Text>
    </View>
  );
}

// ─── PRODUCTS SECTION ─────────────────────────────────────────────────────────

function ProductsSection() {
  const { products, addProduct, removeProduct } = useProductStore();
  const [panelTab, setPanelTab] = useState<PanelTab>('add');
  const [step, setStep] = useState<AddStep>('search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🛍️');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [rating, setRating] = useState('4.0');
  const [reviews, setReviews] = useState('0');
  const [badge, setBadge] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [productUrl, setProductUrl] = useState('');

  const resetForm = useCallback((m: PageMeta | null = null, url = '') => {
    setName(m?.title?.slice(0, 80) ?? ''); setEmoji(CATEGORY_EMOJIS[PRODUCT_CATEGORIES[0]] ?? '🛍️');
    setPrice(''); setOriginalPrice(''); setRating('4.0'); setReviews('0');
    setBadge(''); setDesc(m?.description?.slice(0, 120) ?? '');
    setCategory(PRODUCT_CATEGORIES[0]); setProductUrl(m?.url ?? url);
  }, []);

  const handleFetch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setMeta(null);
    try {
      const m = await fetchUrlMeta(query);
      setMeta(m); resetForm(m, query); setStep('edit');
    } catch (e: any) {
      setError(e.message ?? 'Could not fetch URL metadata.');
    } finally { setLoading(false); }
  }, [query, resetForm]);

  const handleCategoryChange = (c: string) => { setCategory(c); setEmoji(CATEGORY_EMOJIS[c] ?? '🛍️'); };

  const handleSave = () => {
    if (!name.trim() || !productUrl.trim()) return;
    const p = parseFloat(price) || 0;
    const op = parseFloat(originalPrice) || p;
    addProduct({
      name: name.trim(), emoji, price: p, originalPrice: op,
      rating: parseFloat(rating) || 0, reviews: parseInt(reviews) || 0,
      badge: badge.trim() || undefined, description: desc.trim(),
      category, url: productUrl.trim(), imageUrl: meta?.imageUrl,
    });
    setStep('search'); setMeta(null); setQuery(''); setPanelTab('saved');
  };

  return (
    <View style={s.sectionWrap}>
      <View style={s.subTabs}>
        {(['add', 'saved'] as PanelTab[]).map(t => (
          <TouchableOpacity key={t} style={[s.subTab, panelTab === t && s.subTabActive]} onPress={() => setPanelTab(t)}>
            <Text style={[s.subTabText, panelTab === t && s.subTabTextActive]}>
              {t === 'add' ? '➕ Add' : `🛍️ Saved (${products.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {panelTab === 'add' && (
        <View style={{ flex: 1 }}>
          {step === 'search' && (
            <>
              <SearchBox value={query} onChange={setQuery} onSubmit={handleFetch} loading={loading} placeholder="Paste Amazon/Flipkart product URL" />
              {error !== '' && <ErrorBox msg={error} onManual={() => { setMeta(null); resetForm(null, query); setStep('edit'); }} />}
              <View style={s.hint}>
                <Text style={s.hintEmoji}>🛍️</Text>
                <Text style={s.hintText}>Paste any product URL — name and image are auto-fetched. You'll set price and details next.</Text>
              </View>
            </>
          )}
          {step === 'edit' && (
            <ScrollView style={s.editScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.formHead}>Product Details</Text>
              <View style={s.coverFormRow}>
                <SquareCover uri={meta?.imageUrl} emoji={emoji} size={72} />
                <View style={{ flex: 1 }}>
                  <FieldLabel>Name *</FieldLabel>
                  <Input value={name} onChangeText={setName} placeholder="Product name" />
                  <FieldLabel>Emoji</FieldLabel>
                  <Input value={emoji} onChangeText={setEmoji} placeholder="🍼" />
                </View>
              </View>
              <FieldLabel>Description</FieldLabel>
              <TextArea value={desc} onChangeText={setDesc} placeholder="Short product description…" numberOfLines={2} />
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Price (₹) *</FieldLabel>
                  <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="499" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <FieldLabel>Original price (₹)</FieldLabel>
                  <Input value={originalPrice} onChangeText={setOriginalPrice} keyboardType="decimal-pad" placeholder="699" />
                </View>
              </View>
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Rating (0–5)</FieldLabel>
                  <Input value={rating} onChangeText={setRating} keyboardType="decimal-pad" placeholder="4.2" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <FieldLabel>Reviews</FieldLabel>
                  <Input value={reviews} onChangeText={setReviews} keyboardType="number-pad" placeholder="320" />
                </View>
              </View>
              <FieldLabel>Badge (optional)</FieldLabel>
              <Input value={badge} onChangeText={setBadge} placeholder="Bestseller, New, etc." />
              <FieldLabel>Category</FieldLabel>
              <ChipRow options={PRODUCT_CATEGORIES} selected={category} onSelect={handleCategoryChange} />
              <FieldLabel>Product URL *</FieldLabel>
              <Input value={productUrl} onChangeText={setProductUrl} placeholder="https://www.amazon.in/..." autoCapitalize="none" keyboardType="url" />
              <SaveCancelRow onSave={handleSave} onCancel={() => { setStep('search'); setMeta(null); }} disabled={!name.trim() || !productUrl.trim()} />
            </ScrollView>
          )}
        </View>
      )}

      {panelTab === 'saved' && (
        <ScrollView style={s.savedList} showsVerticalScrollIndicator={false}>
          {products.length === 0
            ? <View style={s.hint}><Text style={s.hintEmoji}>🛍️</Text><Text style={s.hintText}>No products added yet</Text></View>
            : products.map(p => <SavedRow key={p.id} title={p.name} sub={`${p.category} · ₹${p.price}`} imageUri={p.imageUrl} emoji={p.emoji} onDelete={() => removeProduct(p.id)} />)
          }
        </ScrollView>
      )}
    </View>
  );
}

// ─── Main AdminPanel Modal ────────────────────────────────────────────────────

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
}

const TYPE_TABS: { key: AdminType; icon: string; label: string }[] = [
  { key: 'books', icon: '📚', label: 'Books' },
  { key: 'articles', icon: '📰', label: 'Articles' },
  { key: 'products', icon: '🛍️', label: 'Products' },
];

export default function AdminPanel({ visible, onClose }: AdminPanelProps) {
  const [adminType, setAdminType] = useState<AdminType>('books');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modal}>
        {/* Header */}
        <View style={s.header}>
          <LinearGradient colors={['#7C3AED', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>⚙️ Library Admin</Text>
              <Text style={s.headerSub}>Add and manage content</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Type tabs */}
        <View style={s.typeTabs}>
          {TYPE_TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeTab, adminType === t.key && s.typeTabActive]}
              onPress={() => setAdminType(t.key)}
              activeOpacity={0.75}
            >
              <Text style={s.typeTabIcon}>{t.icon}</Text>
              <Text style={[s.typeTabLabel, adminType === t.key && s.typeTabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section content */}
        {adminType === 'books' && <BooksSection />}
        {adminType === 'articles' && <ArticlesSection />}
        {adminType === 'products' && <ProductsSection />}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#f9fafb' },

  header: { paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingBottom: 16, paddingHorizontal: 20, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },

  typeTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F5F0FF' },
  typeTab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  typeTabActive: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  typeTabIcon: { fontSize: 20 },
  typeTabLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  typeTabLabelActive: { color: '#7C3AED' },

  sectionWrap: { flex: 1, flexDirection: 'column' },

  subTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F5F0FF' },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  subTabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  subTabTextActive: { color: '#7C3AED' },

  searchBox: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F5F0FF' },
  searchLabel: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, height: 44, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#1a1a2e' },
  searchBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  searchBtnDim: { backgroundColor: '#f3a8d0' },

  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, margin: 16, padding: 12, backgroundColor: '#fef2f2', borderRadius: 10 },
  errorText: { fontSize: 13, color: '#ef4444' },

  resultsList: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  resultsHdr: { fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: '600' },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    boxShadow: '0px 1px 4px rgba(0,0,0,0.06)',
  } as any,
  resultTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e', lineHeight: 18 },
  resultMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  resultRating: { fontSize: 12, color: '#f59e0b', marginTop: 2 },

  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  hintEmoji: { fontSize: 44 },
  hintText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 21 },

  editScroll: { flex: 1, padding: 16 },
  formHead: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginBottom: 14 },
  coverFormRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  articleImg: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, marginTop: 10 },
  input: { height: 42, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#1a1a2e' },
  textArea: { height: 76, paddingTop: 10, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row' },
  chip: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', marginRight: 6 },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 32 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EDF5', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  saveBtn: { flex: 2, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: '#7C3AED' },
  saveBtnDim: { backgroundColor: '#f3a8d0' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  savedList: { flex: 1, padding: 16 },
  savedCount: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 8, paddingHorizontal: 16, paddingTop: 12 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    boxShadow: '0px 1px 4px rgba(0,0,0,0.06)',
  } as any,
  savedTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  savedMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
