import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFilteredArticles } from '../../hooks/useFilteredContent';
import { useVaccineSchedule } from '../../hooks/useVaccineSchedule';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useChatStore } from '../../store/useChatStore';
import { PRODUCTS, Product } from '../../data/products';
import Card from '../../components/ui/Card';
import TagPill from '../../components/ui/TagPill';

type SubTab = 'read' | 'products' | 'saved' | 'journey';
type SortMode = 'Featured' | 'Price ↑' | 'Price ↓' | 'Top Rated';

const PRODUCT_CATEGORIES = ['All', 'Feeding', 'Skincare', 'Sleep', 'Development', 'Mother'];
const SORT_OPTIONS: SortMode[] = ['Featured', 'Price ↑', 'Price ↓', 'Top Rated'];

const BOOKS = [
  { emoji: '📖', title: 'What to Expect When You\'re Expecting', author: 'Heidi Murkoff', rating: 4.7, topic: 'Pregnancy', url: 'https://www.amazon.in/dp/0761187480' },
  { emoji: '📗', title: 'The Baby Book', author: 'Dr. William Sears', rating: 4.6, topic: 'Parenting', url: 'https://www.amazon.in/dp/0316779415' },
  { emoji: '📙', title: 'Nurturing the Soul of Your Family', author: 'Renée Peterson Trudeau', rating: 4.3, topic: 'Wellness', url: 'https://www.amazon.in/s?k=Nurturing+Soul+Family+Trudeau' },
  { emoji: '📘', title: 'Indian Baby Food and Recipes', author: 'Tarla Dalal', rating: 4.8, topic: 'Nutrition', url: 'https://www.amazon.in/s?k=Indian+Baby+Food+Recipes+Tarla+Dalal' },
  { emoji: '📕', title: 'Yoga for Pregnancy and Birth', author: 'Uma Dinsmore-Tuli', rating: 4.5, topic: 'Yoga', url: 'https://www.amazon.in/s?k=Yoga+Pregnancy+Birth+Uma+Dinsmore-Tuli' },
  { emoji: '📔', title: 'The Womanly Art of Breastfeeding', author: 'La Leche League', rating: 4.7, topic: 'Feeding', url: 'https://www.amazon.in/dp/0345518446' },
];

// ─── Sub-tab selector ──────────────────────────────────────────────────────────

function SubTabSelector({ active, onChange }: { active: SubTab; onChange: (t: SubTab) => void }) {
  const tabs: { key: SubTab; label: string }[] = [
    { key: 'read', label: '📚 Read' },
    { key: 'products', label: '🛍️ Products' },
    { key: 'saved', label: '🔖 Saved' },
    { key: 'journey', label: '🗓️ Journey' },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={subTabStyles.row}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        if (isActive) {
          return (
            <TouchableOpacity key={t.key} onPress={() => onChange(t.key)} activeOpacity={0.8}>
              <LinearGradient
                colors={['#ec4899', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={subTabStyles.activeBtn}
              >
                <Text style={subTabStyles.activeBtnText}>{t.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={subTabStyles.inactiveBtn}
            activeOpacity={0.75}
          >
            <Text style={subTabStyles.inactiveBtnText}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const subTabStyles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
  },
  activeBtn: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  activeBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  inactiveBtn: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inactiveBtnText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
});

// ─── Article Card ──────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: ReturnType<typeof useFilteredArticles>[0] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={articleStyles.card} shadow="sm">
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={articleStyles.row}>
          <Text style={articleStyles.emoji}>{article.emoji}</Text>
          <View style={articleStyles.info}>
            <Text style={articleStyles.title}>{article.title}</Text>
            <View style={articleStyles.meta}>
              <TagPill label={article.tag} color="#8b5cf6" />
              <Text style={articleStyles.readTime}>⏱ {article.readTime}</Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
        </View>
        {!expanded && (
          <Text style={articleStyles.preview} numberOfLines={2}>{article.preview}</Text>
        )}
      </TouchableOpacity>
      {expanded && (
        <Text style={articleStyles.body}>{article.body}</Text>
      )}
    </Card>
  );
}

const articleStyles = StyleSheet.create({
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  emoji: { fontSize: 28, width: 36, textAlign: 'center', marginTop: 2 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readTime: { fontSize: 11, color: '#9ca3af' },
  preview: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginTop: 2 },
  body: { fontSize: 14, color: '#374151', lineHeight: 22, marginTop: 10 },
});

// ─── Book Card ─────────────────────────────────────────────────────────────────

function BookCard({ book }: { book: (typeof BOOKS)[0] }) {
  return (
    <Card style={bookStyles.card} shadow="sm">
      <View style={bookStyles.row}>
        <Text style={bookStyles.emoji}>{book.emoji}</Text>
        <View style={bookStyles.info}>
          <Text style={bookStyles.title}>{book.title}</Text>
          <Text style={bookStyles.author}>{book.author}</Text>
          <View style={bookStyles.metaRow}>
            <Text style={bookStyles.rating}>⭐{book.rating}</Text>
            <TagPill label={book.topic} color="#ec4899" />
          </View>
          <TouchableOpacity
            style={bookStyles.buyBtn}
            activeOpacity={0.8}
            onPress={() => Linking.openURL(book.url)}
          >
            <Text style={bookStyles.buyBtnText}>View & Buy →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const bookStyles = StyleSheet.create({
  card: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  emoji: { fontSize: 32, width: 40, textAlign: 'center' },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', marginBottom: 3 },
  author: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rating: { fontSize: 12, color: '#f59e0b', fontWeight: '700' },
  buyBtn: { alignSelf: 'flex-start', backgroundColor: '#fdf2f8', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: '#f9a8d4' },
  buyBtnText: { fontSize: 12, fontWeight: '700', color: '#ec4899' },
});

// ─── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const discountPct = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  return (
    <View style={productCardStyles.card}>
      <View style={productCardStyles.emojiBox}>
        <Text style={productCardStyles.emoji}>{product.emoji}</Text>
      </View>
      {product.badge ? (
        <View style={productCardStyles.badge}>
          <Text style={productCardStyles.badgeText}>{product.badge}</Text>
        </View>
      ) : null}
      <Text style={productCardStyles.name} numberOfLines={2}>{product.name}</Text>
      <View style={productCardStyles.priceRow}>
        <Text style={productCardStyles.price}>₹{product.price.toLocaleString('en-IN')}</Text>
        {discountPct > 0 && (
          <Text style={productCardStyles.discount}>{discountPct}% off</Text>
        )}
      </View>
      <View style={productCardStyles.ratingRow}>
        <Text style={productCardStyles.rating}>⭐ {product.rating}</Text>
        <Text style={productCardStyles.reviews}>({product.reviews})</Text>
      </View>
      <TouchableOpacity
        style={productCardStyles.buyBtn}
        activeOpacity={0.8}
        onPress={() => Linking.openURL(product.url)}
      >
        <Text style={productCardStyles.buyBtnText}>Buy Now →</Text>
      </TouchableOpacity>
    </View>
  );
}

const productCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    margin: 4,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3e8ff',
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(236, 72, 153, 0.07)',
  },
  emojiBox: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: '#fdf2f8',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emoji: { fontSize: 40 },
  badge: {
    backgroundColor: 'rgba(236,72,153,0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeText: { fontSize: 10, color: '#ec4899', fontWeight: '700' },
  name: { fontSize: 12, fontWeight: '600', color: '#1a1a2e', marginBottom: 6, lineHeight: 17 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  discount: { fontSize: 11, color: '#22c55e', fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  rating: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  reviews: { fontSize: 11, color: '#9ca3af' },
  buyBtn: { backgroundColor: '#fdf2f8', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#f9a8d4', alignItems: 'center' },
  buyBtnText: { fontSize: 12, fontWeight: '700', color: '#ec4899' },
});

// ─── Journey Item ──────────────────────────────────────────────────────────────

function JourneyItem({ event, isLast }: { event: { date: Date; title: string; emoji: string; detail: string }; isLast: boolean }) {
  const dateStr = event.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const isPast = event.date < new Date();

  return (
    <View style={journeyStyles.row}>
      <View style={journeyStyles.timelineCol}>
        <View style={[journeyStyles.dot, isPast ? journeyStyles.dotPast : journeyStyles.dotFuture]} />
        {!isLast && <View style={journeyStyles.line} />}
      </View>
      <View style={journeyStyles.content}>
        <Text style={journeyStyles.emoji}>{event.emoji}</Text>
        <View style={journeyStyles.info}>
          <Text style={journeyStyles.title}>{event.title}</Text>
          <Text style={journeyStyles.date}>{dateStr}</Text>
          <Text style={journeyStyles.detail}>{event.detail}</Text>
        </View>
      </View>
    </View>
  );
}

const journeyStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  timelineCol: { alignItems: 'center', width: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 6 },
  dotPast: { backgroundColor: '#22c55e' },
  dotFuture: { backgroundColor: '#e5e7eb', borderWidth: 2, borderColor: '#d1d5db' },
  line: { width: 2, flex: 1, backgroundColor: '#f3e8ff', marginVertical: 2 },
  content: { flex: 1, flexDirection: 'row', gap: 10, paddingBottom: 20 },
  emoji: { fontSize: 22, marginTop: 2 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  date: { fontSize: 12, color: '#ec4899', fontWeight: '600', marginBottom: 4 },
  detail: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
});

// ─── Article Modal ─────────────────────────────────────────────────────────────

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [subTab, setSubTab] = useState<SubTab>('read');
  const [productCategory, setProductCategory] = useState('All');
  const [sortMode, setSortMode] = useState<SortMode>('Featured');
  const [showSortModal, setShowSortModal] = useState(false);

  const articles = useFilteredArticles();
  const { activeKid, ageLabel } = useActiveKid();
  const vaccines = useVaccineSchedule();
  const { savedAnswers, unsaveAnswer } = useChatStore();

  // Filter & sort products
  const filteredProducts = useMemo(() => {
    let list = productCategory === 'All' ? PRODUCTS : PRODUCTS.filter((p) => p.category === productCategory);
    if (sortMode === 'Price ↑') list = [...list].sort((a, b) => a.price - b.price);
    else if (sortMode === 'Price ↓') list = [...list].sort((a, b) => b.price - a.price);
    else if (sortMode === 'Top Rated') list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [productCategory, sortMode]);

  // Curated milestone vaccine IDs: Birth, 6wk, 10wk, 14wk, 9mo, 15mo, 16-18mo, 4-6yr
  const MILESTONE_IDS = ['v01', 'v02', 'v03', 'v04', 'v06', 'v08', 'v09', 'v11'];

  // Build journey events
  const journeyEvents = useMemo(() => {
    if (!activeKid || !activeKid.dob) return [];
    const dob = new Date(activeKid.dob);
    const events: { date: Date; title: string; emoji: string; detail: string }[] = [
      {
        date: dob,
        title: activeKid.isExpecting ? 'Expected Due Date' : `${activeKid.name}'s Birthday`,
        emoji: activeKid.isExpecting ? '🤰' : '👶',
        detail: activeKid.isExpecting
          ? 'The big day is almost here!'
          : `Welcome to the world, ${activeKid.name}!`,
      },
    ];

    const seenDates = new Set<string>();
    vaccines
      .filter((v) => MILESTONE_IDS.includes(v.id) && v.dueDate)
      .forEach((v) => {
        const key = v.dueDate!.toISOString().split('T')[0];
        if (seenDates.has(key)) return;
        seenDates.add(key);
        events.push({
          date: v.dueDate!,
          title: v.ageLabel,
          emoji: '💉',
          detail: v.name,
        });
      });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activeKid, vaccines]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Library 📚</Text>
      </View>

      <SubTabSelector active={subTab} onChange={setSubTab} />

      {/* ── READ ── */}
      {subTab === 'read' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Personalisation banner */}
          <LinearGradient
            colors={['rgba(236,72,153,0.12)', 'rgba(139,92,246,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.personalisationBanner}
          >
            <Ionicons name="sparkles" size={16} color="#ec4899" />
            <Text style={styles.personalisationText}>
              {activeKid && !activeKid.isExpecting
                ? `Showing content for ${activeKid.name} · ${ageLabel}`
                : 'Showing content for all ages'}
            </Text>
          </LinearGradient>

          {/* Articles */}
          <Text style={styles.sectionTitle}>Articles</Text>
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}

          {/* Books */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Recommended Books</Text>
          {BOOKS.map((b) => (
            <BookCard key={b.title} book={b} />
          ))}
        </ScrollView>
      )}

      {/* ── PRODUCTS ── */}
      {subTab === 'products' && (
        <View style={styles.flex}>
          {/* Category filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            {PRODUCT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, cat === productCategory && styles.catChipActive]}
                onPress={() => setProductCategory(cat)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.catChipText,
                    cat === productCategory && styles.catChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Sort button */}
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setShowSortModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="funnel-outline" size={14} color="#8b5cf6" />
              <Text style={styles.sortBtnText}>{sortMode}</Text>
            </TouchableOpacity>
          </ScrollView>

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={[styles.productsGrid, { paddingBottom: insets.bottom + 24 }]}
            renderItem={({ item }) => <ProductCard product={item} />}
            showsVerticalScrollIndicator={false}
          />

          {/* Sort modal */}
          <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
            <TouchableOpacity
              style={styles.sortModalOverlay}
              onPress={() => setShowSortModal(false)}
              activeOpacity={1}
            >
              <View style={styles.sortSheet}>
                <Text style={styles.sortTitle}>Sort by</Text>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={styles.sortOption}
                    onPress={() => { setSortMode(opt); setShowSortModal(false); }}
                  >
                    <Text
                      style={[styles.sortOptionText, opt === sortMode && styles.sortOptionTextActive]}
                    >
                      {opt}
                    </Text>
                    {opt === sortMode && (
                      <Ionicons name="checkmark" size={18} color="#ec4899" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}

      {/* ── SAVED ── */}
      {subTab === 'saved' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
        >
          {savedAnswers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔖</Text>
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyText}>
                Tap the{' '}
                <Text style={styles.emptyHighlight}>🔖 Save</Text>
                {' '}button on any chat response to bookmark it here.
              </Text>
            </View>
          ) : (
            savedAnswers.map((answer) => {
              const savedDate = typeof answer.savedAt === 'string'
                ? new Date(answer.savedAt)
                : answer.savedAt;
              const formattedDate = savedDate instanceof Date && !isNaN(savedDate.getTime())
                ? savedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';

              return (
                <Card key={answer.id} style={styles.savedCard} shadow="sm">
                  <View style={styles.savedCardHeader}>
                    <TagPill label={answer.tag?.tag ?? '💬 General'} color={answer.tag?.color ?? '#9ca3af'} />
                    <View style={styles.savedCardRight}>
                      <Text style={styles.savedDate}>{formattedDate}</Text>
                      <TouchableOpacity
                        onPress={() => unsaveAnswer(answer.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#9ca3af" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.savedContent} numberOfLines={6}>{answer.content}</Text>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── JOURNEY ── */}
      {subTab === 'journey' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
        >
          {journeyEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🗓️</Text>
              <Text style={styles.emptyTitle}>Your journey awaits</Text>
              <Text style={styles.emptyText}>
                Add your child's details in the Family tab to see your personalised timeline.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {activeKid?.name ? `${activeKid.name}'s Journey` : 'Your Journey'}
              </Text>
              {journeyEvents.map((event, i) => (
                <JourneyItem
                  key={`${event.title}-${i}`}
                  event={event}
                  isLast={i === journeyEvents.length - 1}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf6ff' },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '0px 2px 8px rgba(139, 92, 246, 0.06)',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  personalisationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  personalisationText: { fontSize: 13, color: '#ec4899', fontWeight: '600', flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  categoriesRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
  },
  catChip: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  catChipActive: { backgroundColor: 'rgba(236,72,153,0.1)', borderColor: '#ec4899' },
  catChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  catChipTextActive: { color: '#ec4899', fontWeight: '700' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  sortBtnText: { fontSize: 12, color: '#8b5cf6', fontWeight: '700' },
  productsGrid: { paddingHorizontal: 12, paddingTop: 12 },
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.15)',
  },
  sortTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 14 },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
  },
  sortOptionText: { fontSize: 14, color: '#6b7280' },
  sortOptionTextActive: { color: '#ec4899', fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  emptyHighlight: { color: '#ec4899', fontWeight: '700' },
  savedCard: { marginBottom: 12 },
  savedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  savedCardRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedDate: { fontSize: 11, color: '#9ca3af' },
  savedContent: { fontSize: 14, color: '#374151', lineHeight: 22 },
});
