import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFilteredArticles } from '../../hooks/useFilteredContent';
import { useActiveKid } from '../../hooks/useActiveKid';
import { useProfileStore, calculateAgeInMonths } from '../../store/useProfileStore';
import { useChatStore } from '../../store/useChatStore';
import { useBookStore, DynamicBook } from '../../store/useBookStore';
import { useArticleStore, DynamicArticle } from '../../store/useArticleStore';
import { useProductStore, DynamicProduct } from '../../store/useProductStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminEmail } from '../../lib/admin';
import { PRODUCTS, Product } from '../../data/products';
import { Article } from '../../data/articles';
import { MILESTONES } from '../../data/milestones';
import { VACCINE_SCHEDULE } from '../../data/vaccines';
import Card from '../../components/ui/Card';
import TagPill from '../../components/ui/TagPill';
import { TabIcon, AppIcon } from '../../components/ui/AppIcon';
import { Illustration } from '../../components/ui/Illustration';
import { Fonts } from '../../constants/theme';
import { Colors } from '../../constants/theme';

type SubTab = 'read' | 'books' | 'products' | 'saved' | 'journey';
type SortMode = 'Featured' | 'Price ↑' | 'Price ↓' | 'Top Rated';

const PRODUCT_CATEGORIES = ['All', 'Feeding', 'Skincare', 'Sleep', 'Development', 'Mother', 'Toddler'];
const SORT_OPTIONS: SortMode[] = ['Featured', 'Price ↑', 'Price ↓', 'Top Rated'];

interface Book {
  id: string;
  emoji: string;
  title: string;
  author: string;
  rating: number;
  reviews: number;
  topic: string;
  brief: string;
  badge?: string;
  coverColors: [string, string];
  url: string;
  sampleUrl?: string;
  imageUrl?: string;   // real cover from Google Books (dynamic books)
  ageMin: number;  // months; -9 = pregnancy
  ageMax: number;  // months; 999 = always relevant
}

/** Adapts a DynamicBook from the store to the unified Book display format */
function dynamicToBook(d: DynamicBook): Book {
  return {
    id: d.id,
    emoji: '📗',
    title: d.title,
    author: d.author,
    rating: d.rating,
    reviews: d.reviews,
    topic: d.topic,
    brief: d.description,
    coverColors: [Colors.primary, Colors.primary],
    url: d.url,
    sampleUrl: d.sampleUrl,
    imageUrl: d.imageUrl,
    ageMin: d.ageMin,
    ageMax: d.ageMax,
  };
}

/** Adapts a DynamicArticle from the store to the Article display format */
function dynamicToArticle(d: DynamicArticle): Article {
  return {
    id: d.id,
    title: d.title,
    preview: d.preview,
    body: d.body || d.preview,
    topic: d.topic,
    readTime: d.readTime,
    ageMin: d.ageMin,
    ageMax: d.ageMax,
    emoji: d.emoji,
    tag: d.tag,
    url: d.url,
    imageUrl: d.imageUrl,
  };
}

/** Adapts a DynamicProduct from the store to the Product display format */
function dynamicToProduct(d: DynamicProduct): Product {
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    price: d.price,
    originalPrice: d.originalPrice,
    rating: d.rating,
    reviews: d.reviews,
    badge: d.badge ?? '',
    emoji: d.emoji,
    description: d.description,
    url: d.url,
    imageUrl: d.imageUrl,
    ageMinMonths: (d as any).ageMinMonths ?? 0,
    ageMaxMonths: (d as any).ageMaxMonths ?? 999,
  };
}

const BOOKS: Book[] = [
  {
    id: 'b01',
    emoji: '🤰',
    title: "What to Expect When You're Expecting",
    author: 'Heidi Murkoff',
    rating: 4.7,
    reviews: 14200,
    topic: 'Pregnancy',
    brief: 'The world\'s bestselling pregnancy guide — week-by-week breakdowns, symptoms, nutrition, and birth prep trusted by millions of Indian mothers.',
    badge: 'Bestseller',
    coverColors: [Colors.primary, '#f472b6'],
    url: 'https://www.amazon.in/dp/0761187480',
    sampleUrl: 'https://books.google.com/books?id=WhatToExpect',
    ageMin: -9,
    ageMax: 0,
  },
  {
    id: 'b02',
    emoji: '🤱',
    title: 'The Womanly Art of Breastfeeding',
    author: 'La Leche League International',
    rating: 4.7,
    reviews: 8900,
    topic: 'Breastfeeding',
    brief: 'The gold standard breastfeeding guide — latch, supply, pumping, and returning to work, written with warmth and evidence-based care.',
    badge: 'IAP Recommended',
    coverColors: [Colors.primary, '#a78bfa'],
    url: 'https://www.amazon.in/dp/0345518446',
    sampleUrl: 'https://www.llli.org/breastfeeding-info/',
    ageMin: -1,
    ageMax: 24,
  },
  {
    id: 'b03',
    emoji: '👶',
    title: 'The Baby Book',
    author: 'Dr. William & Martha Sears',
    rating: 4.6,
    reviews: 11300,
    topic: 'Newborn Care',
    brief: 'Comprehensive attachment parenting guide covering feeding, sleep, development, and health in the first two years. A classic for new parents.',
    badge: "Editor's Pick",
    coverColors: ['#f59e0b', '#fbbf24'],
    url: 'https://www.amazon.in/dp/0316779415',
    sampleUrl: 'https://books.google.com/books?id=BabyBook',
    ageMin: 0,
    ageMax: 24,
  },
  {
    id: 'b04',
    emoji: '🍛',
    title: 'Indian Baby Food & Recipes',
    author: 'Tarla Dalal',
    rating: 4.8,
    reviews: 6700,
    topic: 'Nutrition',
    brief: '200+ easy Indian recipes for babies and toddlers — dal khichdi, ragi porridge, sabzi purees — from weaning to family meals. A must-have.',
    badge: 'Top Rated',
    coverColors: ['#22c55e', '#4ade80'],
    url: 'https://www.amazon.in/s?k=Indian+Baby+Food+Tarla+Dalal',
    ageMin: 4,
    ageMax: 36,
  },
  {
    id: 'b05',
    emoji: '🧘',
    title: 'Yoga for Pregnancy and Birth',
    author: 'Uma Dinsmore-Tuli',
    rating: 4.5,
    reviews: 3200,
    topic: 'Yoga & Wellness',
    brief: 'Gentle yoga sequences designed for every trimester and postpartum recovery — breathing, relaxation, and poses that support your changing body.',
    coverColors: ['#a855f7', '#c084fc'],
    url: 'https://www.amazon.in/s?k=Yoga+Pregnancy+Birth+Uma',
    ageMin: -9,
    ageMax: 3,
  },
  {
    id: 'b06',
    emoji: '🌸',
    title: 'Nurturing the Soul of Your Family',
    author: 'Renée Peterson Trudeau',
    rating: 4.3,
    reviews: 2100,
    topic: 'Self-Care',
    brief: 'A powerful guide for overwhelmed mothers on reclaiming balance, setting boundaries, and practising self-care without guilt.',
    coverColors: [Colors.primary, Colors.primary],
    url: 'https://www.amazon.in/s?k=Nurturing+Soul+Family+Trudeau',
    ageMin: 0,
    ageMax: 999,
  },
  {
    id: 'b07',
    emoji: '😴',
    title: 'The No-Cry Sleep Solution',
    author: 'Elizabeth Pantley',
    rating: 4.4,
    reviews: 9800,
    topic: 'Sleep',
    brief: 'Gentle, proven strategies to help your baby sleep longer without hours of crying — tailored for co-sleeping families and Indian households.',
    badge: 'Popular',
    coverColors: ['#3b82f6', '#60a5fa'],
    url: 'https://www.amazon.in/s?k=No+Cry+Sleep+Solution+Pantley',
    ageMin: 0,
    ageMax: 18,
  },
  {
    id: 'b08',
    emoji: '🧠',
    title: 'The Whole-Brain Child',
    author: 'Dr. Daniel J. Siegel',
    rating: 4.7,
    reviews: 13500,
    topic: 'Development',
    brief: '12 strategies to nurture your child\'s developing mind — helps parents understand tantrums, emotions, and behaviour through neuroscience.',
    badge: 'Bestseller',
    coverColors: ['#6366f1', '#818cf8'],
    url: 'https://www.amazon.in/dp/0553386697',
    sampleUrl: 'https://books.google.com/books?id=WholeBrainChild',
    ageMin: 12,
    ageMax: 999,
  },
  {
    id: 'b09',
    emoji: '🍼',
    title: 'Heading Home with Your Newborn',
    author: 'Laura A. Jana & Jennifer Shu',
    rating: 4.5,
    reviews: 5600,
    topic: 'Newborn Care',
    brief: 'Practical AAP-backed guidance for the first weeks — feeding, sleep safety, when to call the doctor, and surviving the fourth trimester.',
    coverColors: ['#f97316', '#fb923c'],
    url: 'https://www.amazon.in/s?k=Heading+Home+Newborn+Jana',
    ageMin: -1,
    ageMax: 3,
  },
  {
    id: 'b10',
    emoji: '💪',
    title: 'Strong Mothers, Strong Sons',
    author: 'Dr. Meg Meeker',
    rating: 4.6,
    reviews: 4300,
    topic: 'Parenting',
    brief: 'How mothers shape their sons\' character, confidence, and relationships — warm, research-backed, and deeply relevant for Indian families.',
    coverColors: ['#10b981', '#34d399'],
    url: 'https://www.amazon.in/s?k=Strong+Mothers+Strong+Sons+Meeker',
    ageMin: 0,
    ageMax: 999,
  },
];

// ─── Sub-tab selector ──────────────────────────────────────────────────────────

function SubTabSelector({ active, onChange }: { active: SubTab; onChange: (t: SubTab) => void }) {
  const tabs: { key: SubTab; label: string; icon: string }[] = [
    { key: 'read',     label: 'Articles', icon: 'newspaper-outline' },
    { key: 'books',    label: 'Books',    icon: 'book-outline' },
    { key: 'products', label: 'Products', icon: 'bag-handle-outline' },
    { key: 'saved',    label: 'Saved',    icon: 'bookmark-outline' },
    { key: 'journey',  label: 'Journey',  icon: 'map-outline' },
  ];

  return (
    <View style={subTabStyles.wrapper}>
      <View style={subTabStyles.row}>
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => onChange(t.key)}
              activeOpacity={0.8}
              style={[subTabStyles.btn, isActive ? subTabStyles.btnActive : subTabStyles.btnInactive]}
            >
              {isActive && (
                <LinearGradient
                  colors={[Colors.primary, Colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                />
              )}
              <TabIcon name={t.icon} active={isActive} />
              {isActive && (
                <Text style={subTabStyles.activeBtnText}>{t.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const subTabStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.bgLight,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBF8',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    height: 36,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  btnActive: {
    paddingHorizontal: 14,
    flex: 1,          // active tab stretches to fill remaining space
  },
  btnInactive: {
    width: 36,        // icon-only: fixed square pill
    backgroundColor: '#EDE9F6',
  },
  activeBtnText: { fontFamily: Fonts.sansBold, color: '#ffffff', fontSize: 12.5 },
});

// ─── Article topic → Ionicons icon ───────────────────────────────────────────

function getTopicIcon(topic: string): string {
  const map: Record<string, string> = {
    Feeding:        'cafe-outline',
    Sleep:          'moon-outline',
    Development:    'trending-up-outline',
    Postpartum:     'heart-outline',
    Vaccination:    'shield-checkmark-outline',
    Nutrition:      'leaf-outline',
    'Mental Health':'happy-outline',
    Yoga:           'body-outline',
    'Baby Care':    'happy-outline',
    Pregnancy:      'heart-circle-outline',
    Weaning:        'ice-cream-outline',
    General:        'chatbubble-ellipses-outline',
  };
  return map[topic] ?? 'document-text-outline';
}

// ─── Article topic → gradient colors ─────────────────────────────────────────

function getArticleGradient(topic: string): [string, string] {
  const map: Record<string, [string, string]> = {
    Feeding: [Colors.primary, '#f472b6'],
    Sleep: [Colors.primary, '#a78bfa'],
    Development: ['#f59e0b', '#fbbf24'],
    Postpartum: ['#10b981', '#34d399'],
    Vaccination: ['#3b82f6', '#60a5fa'],
    Nutrition: ['#22c55e', '#4ade80'],
    'Mental Health': ['#6366f1', '#818cf8'],
    Yoga: ['#a855f7', '#c084fc'],
    'Baby Care': ['#f97316', '#fb923c'],
  };
  return map[topic] ?? [Colors.primary, Colors.primary];
}

// ─── Article Card (rich preview) ──────────────────────────────────────────────

function ArticleCard({
  article,
  autoExpand,
  onAutoExpanded,
}: {
  article: Article;
  /** When true on mount or flip, expands the card body. Used for deep-links
      from Home (Recommended reads, Suggested for you). */
  autoExpand?: boolean;
  onAutoExpanded?: () => void;
}) {
  const [expanded, setExpanded] = useState(!!autoExpand);
  const [imgError, setImgError] = useState(false);
  const [colors] = useState<[string, string]>(() => getArticleGradient(article.topic));
  const showRealImg = !!(article.imageUrl && !imgError);

  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
      onAutoExpanded?.();
    }
  }, [autoExpand]);

  return (
    <View style={articleStyles.card}>
      {/* ── Cover image area ── */}
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.85}>
        {showRealImg ? (
          <View style={articleStyles.cover}>
            <Image
              source={{ uri: article.imageUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
            {/* overlay so badges remain readable */}
            <View style={articleStyles.imgOverlay} />
            <View style={articleStyles.tagBadge}>
              <Text style={articleStyles.tagBadgeText}>{article.tag}</Text>
            </View>
            <View style={articleStyles.readTimeBadge}>
              <AppIcon name="object.history" size={11} color="#374151" />
              <Text style={articleStyles.readTimeText}>{article.readTime}</Text>
            </View>
          </View>
        ) : (
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={articleStyles.cover}>
            {/* Tag badge top-left */}
            <View style={articleStyles.tagBadge}>
              <Text style={articleStyles.tagBadgeText}>{article.tag}</Text>
            </View>
            {/* Big icon centered */}
            <View style={articleStyles.coverIconWrap}>
              <Ionicons name={getTopicIcon(article.topic) as any} size={36} color="#374151" />
            </View>
            {/* Read time bottom-right */}
            <View style={articleStyles.readTimeBadge}>
              <AppIcon name="object.history" size={11} color="#374151" />
              <Text style={articleStyles.readTimeText}>{article.readTime}</Text>
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>

      {/* ── Body ── */}
      <View style={articleStyles.body}>
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
          <Text style={articleStyles.title} numberOfLines={expanded ? undefined : 2}>{article.title}</Text>
          {!expanded && (
            <Text style={articleStyles.preview} numberOfLines={2}>{article.preview}</Text>
          )}
        </TouchableOpacity>

        {expanded && (
          <Text style={[articleStyles.bodyText, Platform.OS === 'web' ? { wordBreak: 'break-word' } as any : {}]}>
            {article.body}
          </Text>
        )}

        {/* ── Actions ── */}
        <View style={articleStyles.actions}>
          <TouchableOpacity
            onPress={() => setExpanded((v) => !v)}
            style={articleStyles.readBtn}
            activeOpacity={0.75}
          >
            <AppIcon name={expanded ? 'action.collapse' : 'object.book'} size={14} color={Colors.primary} />
            <Text style={articleStyles.readBtnText}>{expanded ? 'Show less' : 'Read inside'}</Text>
          </TouchableOpacity>

          {article.url && (
            <TouchableOpacity
              onPress={() => Linking.openURL(article.url!)}
              style={articleStyles.openBtn}
              activeOpacity={0.75}
            >
              <Text style={articleStyles.openBtnText}>Open article</Text>
              <AppIcon name="object.open-external" size={13} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const articleStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '0px 3px 8px rgba(139, 92, 246, 0.10)',
  } as any,
  cover: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  tagBadge: {
    position: 'absolute',
    top: 10,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  coverIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readTimeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  readTimeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 21,
    marginBottom: 4,
  },
  preview: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  bodyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.primaryAlpha08,
  },
  readBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(28, 16, 51, 0.048)',
  },
  openBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
});

// ─── Book Card ─────────────────────────────────────────────────────────────────

function BookCover({ book }: { book: Book }) {
  const [imgErr, setImgErr] = useState(false);

  if (book.imageUrl && !imgErr) {
    return (
      <View style={bookStyles.cover}>
        <Image
          source={{ uri: book.imageUrl }}
          style={bookStyles.coverRealImg}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
        {book.badge && (
          <View style={bookStyles.coverBadge}>
            <Text style={bookStyles.coverBadgeText}>{book.badge}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={book.coverColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={bookStyles.cover}
    >
      {book.badge && (
        <View style={bookStyles.coverBadge}>
          <Text style={bookStyles.coverBadgeText}>{book.badge}</Text>
        </View>
      )}
      <View style={bookStyles.coverIconWrap}>
        <AppIcon name="object.book" size={32} color="#374151" />
      </View>
    </LinearGradient>
  );
}

function BookCard({ book, highlighted }: { book: Book; highlighted?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const reviewsFormatted = book.reviews >= 1000
    ? `${(book.reviews / 1000).toFixed(1)}k`
    : book.reviews > 0 ? `${book.reviews}` : '';

  return (
    <View style={[bookStyles.card, highlighted && bookStyles.cardHighlighted]}>
      {highlighted && (
        <View style={bookStyles.forYouBadge}>
          <AppIcon name="object.sparkles" size={11} />
          <Text style={bookStyles.forYouText}>Recommended for you</Text>
        </View>
      )}

      <View style={bookStyles.row}>
        {/* Portrait book cover — real image or gradient */}
        <BookCover book={book} />

        {/* Content */}
        <View style={bookStyles.content}>
          <Text style={bookStyles.title} numberOfLines={2}>{book.title}</Text>
          <Text style={bookStyles.author}>{book.author}</Text>

          {/* Rating row */}
          {book.rating > 0 && (
            <View style={bookStyles.ratingRow}>
              <Text style={bookStyles.stars}>{'★'.repeat(Math.min(5, Math.round(book.rating)))}</Text>
              <Text style={bookStyles.ratingNum}>{book.rating.toFixed(1)}</Text>
              {reviewsFormatted !== '' && (
                <Text style={bookStyles.reviews}>({reviewsFormatted})</Text>
              )}
            </View>
          )}

          <TagPill label={book.topic} color={Colors.primary} style={bookStyles.topicPill} />
        </View>
      </View>

      {/* Brief */}
      <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.8}>
        <Text style={bookStyles.brief} numberOfLines={expanded ? undefined : 2}>
          {book.brief}
        </Text>
        {!expanded && (
          <Text style={bookStyles.briefMore}>Read more…</Text>
        )}
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={bookStyles.actions}>
        {book.sampleUrl && (
          <TouchableOpacity
            style={bookStyles.sampleBtn}
            activeOpacity={0.8}
            onPress={() => Linking.openURL(book.sampleUrl!)}
          >
            <AppIcon name="object.book" size={13} />
            <Text style={bookStyles.sampleBtnText}>Read sample</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[bookStyles.buyBtn, !book.sampleUrl && bookStyles.buyBtnFull]}
          activeOpacity={0.8}
          onPress={() => Linking.openURL(book.url)}
        >
          <AppIcon name="object.cart" size={13} color="#ffffff" />
          <Text style={bookStyles.buyBtnText}>Buy on Amazon</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const bookStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '0px 3px 8px rgba(139, 92, 246, 0.09)',
    gap: 12,
  } as any,
  cardHighlighted: {
    borderWidth: 1.5,
    borderColor: 'rgba(28, 16, 51, 0.15)',
    backgroundColor: '#fffbfe',
  },
  forYouBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(28, 16, 51, 0.048)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  forYouText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cover: {
    width: 80,
    height: 112,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  } as any,
  coverRealImg: {
    width: 80,
    height: 112,
    borderRadius: 8,
  },
  coverBadge: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  coverBadgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  coverIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a2e',
    lineHeight: 20,
  },
  author: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  stars: {
    color: '#f59e0b',
    fontSize: 11,
    letterSpacing: -0.5,
  },
  ratingNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  reviews: {
    fontSize: 11,
    color: '#9ca3af',
  },
  topicPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  brief: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  briefMore: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  sampleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.primaryAlpha08,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  sampleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  buyBtnFull: {
    flex: 1,
  },
  buyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});

// ─── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const discountPct = Math.max(0, Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100));
  const [imgError, setImgError] = useState(false);
  const showRealImg = !!(product.imageUrl && !imgError);
  return (
    <View style={productCardStyles.card}>
      <View style={productCardStyles.emojiBox}>
        {showRealImg ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={productCardStyles.productImg}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <AppIcon name="object.bag" size={32} />
        )}
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
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 12,
    margin: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(28, 16, 51, 0.042)',
  },
  emojiBox: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: 'rgba(28, 16, 51, 0.036)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  emoji: { fontSize: 40 }, // kept for type compat, not rendered
  productImg: { width: '100%', height: '100%' },
  badge: {
    backgroundColor: 'rgba(28, 16, 51, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  name: { fontSize: 12, fontWeight: '600', color: '#1a1a2e', marginBottom: 6, lineHeight: 17 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  discount: { fontSize: 11, color: '#22c55e', fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  rating: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  reviews: { fontSize: 11, color: '#9ca3af' },
  buyBtn: { backgroundColor: 'rgba(28, 16, 51, 0.036)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#f9a8d4', alignItems: 'center' },
  buyBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
});

// ─── Journey Item ──────────────────────────────────────────────────────────────

type JourneyEvent = { date: Date; title: string; emoji: string; detail: string; type: 'birth' | 'milestone' | 'vaccine' | 'pregnancy'; vaccineId?: string };

const JOURNEY_ICONS: Record<JourneyEvent['type'], string> = {
  birth:      'heart',
  milestone:  'star',
  vaccine:    'shield-checkmark-outline',
  pregnancy:  'flower-outline',
};

function JourneyItem({ event, isLast }: { event: JourneyEvent; isLast: boolean }) {
  const today = new Date();
  const dateStr = event.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const isPast = event.date < today && event.date.toDateString() !== today.toDateString();
  const isToday = event.date.toDateString() === today.toDateString();

  const { completedVaccines: completedVaccinesAll } = useProfileStore();
  const { activeKid } = useActiveKid();

  // For vaccine events, check if actually administered
  let dotColor: string;
  let statusLabel: string;
  let statusColor: string;
  let statusBg: string;

  if (event.type === 'vaccine' && event.vaccineId) {
    const kidVaccines = completedVaccinesAll[activeKid?.id ?? ''] ?? {};
    const isDone = !!kidVaccines[event.vaccineId]?.done;
    if (isDone) {
      dotColor = '#22c55e';
      statusLabel = 'Given ✓';
      statusColor = '#16a34a';
      statusBg = '#dcfce7';
    } else if (isToday) {
      dotColor = Colors.primary;
      statusLabel = 'Due Today 🔔';
      statusColor = Colors.primary;
      statusBg = 'rgba(28, 16, 51, 0.06)';
    } else if (isPast) {
      dotColor = '#f97316';
      statusLabel = 'Overdue ⚠️';
      statusColor = '#ea580c';
      statusBg = '#fff7ed';
    } else {
      dotColor = '#e5e7eb';
      statusLabel = 'Upcoming';
      statusColor = '#9ca3af';
      statusBg = '#f3f4f6';
    }
  } else {
    // Birth / milestone / pregnancy events — date-based status
    const isCompleted = isPast || isToday;
    dotColor = isCompleted ? '#22c55e' : isToday ? Colors.primary : '#e5e7eb';
    statusLabel = isPast ? 'Done ✓' : isToday ? 'Today 🎉' : 'Upcoming';
    statusColor = isPast ? '#16a34a' : isToday ? Colors.primary : '#9ca3af';
    statusBg = isPast ? '#dcfce7' : isToday ? 'rgba(28, 16, 51, 0.06)' : '#f3f4f6';
  }

  const borderColor = dotColor === '#e5e7eb' ? '#d1d5db' : dotColor;

  return (
    <View style={journeyStyles.row}>
      <View style={journeyStyles.timelineCol}>
        <View style={[journeyStyles.dot, { backgroundColor: dotColor, borderColor }]} />
        {!isLast && <View style={journeyStyles.line} />}
      </View>
      <View style={journeyStyles.card}>
        <View style={journeyStyles.cardHeader}>
          <View style={[journeyStyles.iconBox, { backgroundColor: dotColor === '#22c55e' ? 'rgba(34,197,94,0.1)' : dotColor === '#e5e7eb' ? 'rgba(28, 16, 51, 0.042)' : `${dotColor}18` }]}>
            <Ionicons name={JOURNEY_ICONS[event.type] as any} size={16} color={dotColor === '#e5e7eb' ? Colors.primary : dotColor} />
          </View>
          <View style={journeyStyles.headerText}>
            <Text style={journeyStyles.title}>{event.title}</Text>
            <Text style={journeyStyles.date}>{dateStr}</Text>
          </View>
          <View style={[journeyStyles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[journeyStyles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {event.detail ? <Text style={journeyStyles.detail}>{event.detail}</Text> : null}
      </View>
    </View>
  );
}

const journeyStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  timelineCol: { alignItems: 'center', width: 18, paddingTop: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  line: { width: 2, flex: 1, backgroundColor: '#f3e8ff', marginVertical: 2 },
  card: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDE9F6',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
    boxShadow: '0px 1px 6px rgba(139, 92, 246, 0.06)',
  } as any,
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  date: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  detail: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
});

// ─── Article Modal ─────────────────────────────────────────────────────────────

// Admin detection now lives in lib/admin.ts — shared with the admin
// dashboard and firestore rules so the allow-list stays in one place.

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Deep-links from Home's Quick Jump + Recommended Reads:
  //   ?tab=read|books|products|saved|journey  — pick a sub-tab
  //   ?articleId=aXX                          — auto-expand that article
  //                                            (implies tab=read)
  //   ?topic=Feeding                          — seed the articles topic filter
  const params = useLocalSearchParams<{ tab?: string; articleId?: string; topic?: string }>();
  const initialSubTab: SubTab =
    params?.tab === 'books' || params?.tab === 'products' ||
    params?.tab === 'saved' || params?.tab === 'journey'
      ? (params.tab as SubTab)
      : params?.articleId
      ? 'read'
      : 'read';
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);
  const [productCategory, setProductCategory] = useState('All');
  const [sortMode, setSortMode] = useState<SortMode>('Featured');
  const [showSortModal, setShowSortModal] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleTopicFilter, setArticleTopicFilter] = useState(
    typeof params?.topic === 'string' ? params.topic : 'All',
  );

  // Track the deep-linked article id so the matching ArticleCard can
  // auto-expand and the ScrollView / FlatList can scroll to it.
  const [pendingArticleId, setPendingArticleId] = useState<string | null>(
    typeof params?.articleId === 'string' ? params.articleId : null,
  );
  // Clear after consumption so switching sub-tabs doesn't re-trigger expand.
  const consumePendingArticle = () => setPendingArticleId(null);

  // Re-apply params if they change after mount (navigation without unmount).
  useEffect(() => {
    if (params?.tab === 'books' || params?.tab === 'products' ||
        params?.tab === 'saved' || params?.tab === 'journey' ||
        params?.tab === 'read') {
      setSubTab(params.tab as SubTab);
    }
    if (typeof params?.articleId === 'string' && params.articleId) {
      setPendingArticleId(params.articleId);
      setSubTab('read');
    }
    if (typeof params?.topic === 'string' && params.topic) {
      setArticleTopicFilter(params.topic);
      setSubTab('read');
    }
  }, [params?.tab, params?.articleId, params?.topic]);

  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminEmail(user?.email);

  const profile = useProfileStore((s) => s.profile);

  const { books: dynamicBooks } = useBookStore();
  const { articles: dynamicArticles } = useArticleStore();
  const { products: dynamicProducts } = useProductStore();

  const allStaticArticles = useFilteredArticles();

  const { activeKid, ageLabel } = useActiveKid();

  // Merge dynamic articles (age-filtered) with static ones
  const allArticles = useMemo((): Article[] => {
    const ageMonths = activeKid?.isExpecting
      ? -9
      : activeKid
        ? calculateAgeInMonths(activeKid.dob)
        : null;
    const filtered = dynamicArticles
      .filter((d) => ageMonths === null || (ageMonths >= d.ageMin && ageMonths <= d.ageMax))
      .map(dynamicToArticle);
    return [...filtered, ...allStaticArticles];
  }, [dynamicArticles, allStaticArticles, activeKid]);

  // Apply search + topic filter on top of age-filtered articles
  const articles = useMemo(() => {
    let list = allArticles;
    if (articleTopicFilter !== 'All') {
      list = list.filter((a) => a.topic === articleTopicFilter || a.tag === articleTopicFilter);
    }
    if (articleSearch.trim()) {
      const q = articleSearch.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.preview.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allArticles, articleSearch, articleTopicFilter]);

  // Unique topics from all age-filtered articles for filter chips
  const articleTopics = useMemo(() => {
    const topics = Array.from(new Set(allArticles.map((a) => a.topic)));
    return ['All', ...topics];
  }, [allArticles]);

  // When no active kid, limit chips to neutral topics only
  const displayTopics = useMemo(() => {
    if (!activeKid) return ['All', 'General', 'Mental Health'];
    return articleTopics;
  }, [activeKid, articleTopics]);
  const { savedAnswers, unsaveAnswer } = useChatStore();

  // Merge static + dynamic books, personalise by age relevance
  const { personalizedBooks, topBookIds } = useMemo(() => {
    const dynAsBooks = dynamicBooks.map(dynamicToBook);
    const allBooks = [...dynAsBooks, ...BOOKS]; // dynamic books appear first

    const ageMonths = activeKid?.isExpecting
      ? -9
      : activeKid
        ? calculateAgeInMonths(activeKid.dob)
        : null;

    if (ageMonths === null) {
      return { personalizedBooks: allBooks, topBookIds: new Set<string>() };
    }

    const stageBoost = (b: Book): number => {
      if (!profile) return 0;
      const stage = profile.stage;
      const title = b.title?.toLowerCase() ?? '';
      const desc = b.brief?.toLowerCase() ?? '';
      const text = title + ' ' + desc;
      if (stage === 'pregnant' && (text.includes('pregnan') || text.includes('birth') || text.includes('labour'))) return -5;
      if (stage === 'newborn' && (text.includes('newborn') || text.includes('infant') || text.includes('breastfeed'))) return -5;
      if (stage !== 'pregnant' && ageMonths >= 12 && (text.includes('toddler') || text.includes('1 year'))) return -5;
      return 0;
    };

    const scored = allBooks.map((b) => {
      const inRange = ageMonths >= b.ageMin && ageMonths <= b.ageMax;
      const dist = inRange
        ? 0
        : Math.min(Math.abs(ageMonths - b.ageMin), Math.abs(ageMonths - b.ageMax));
      return { book: b, inRange, dist };
    });

    scored.sort((a, b) => {
      const stageDiff = stageBoost(a.book) - stageBoost(b.book);
      if (stageDiff !== 0) return stageDiff;
      if (a.inRange && !b.inRange) return -1;
      if (!a.inRange && b.inRange) return 1;
      return a.dist - b.dist;
    });

    const top = new Set(scored.slice(0, 3).map((s) => s.book.id));
    return { personalizedBooks: scored.map((s) => s.book), topBookIds: top };
  }, [activeKid, dynamicBooks, profile]);

  // Filter & sort products with age-based personalisation
  const { filteredProducts, recommendedCount } = useMemo(() => {
    const allProducts: Product[] = [...dynamicProducts.map(dynamicToProduct), ...PRODUCTS];
    let list = productCategory === 'All' ? allProducts : allProducts.filter((p) => p.category === productCategory);

    if (sortMode === 'Price ↑') {
      list = [...list].sort((a, b) => a.price - b.price);
      return { filteredProducts: list, recommendedCount: 0 };
    }
    if (sortMode === 'Price ↓') {
      list = [...list].sort((a, b) => b.price - a.price);
      return { filteredProducts: list, recommendedCount: 0 };
    }
    if (sortMode === 'Top Rated') {
      list = [...list].sort((a, b) => b.rating - a.rating);
      return { filteredProducts: list, recommendedCount: 0 };
    }

    // Featured: sort age-relevant products first
    const ageMonths = activeKid?.isExpecting
      ? -9
      : activeKid
        ? calculateAgeInMonths(activeKid.dob)
        : null;
    if (ageMonths === null) {
      return { filteredProducts: list, recommendedCount: 0 };
    }
    const recommended = list.filter((p) => ageMonths >= p.ageMinMonths && ageMonths <= p.ageMaxMonths);
    const others = list.filter((p) => !(ageMonths >= p.ageMinMonths && ageMonths <= p.ageMaxMonths));
    recommended.sort((a, b) => b.rating - a.rating);
    others.sort((a, b) => b.rating - a.rating);
    return { filteredProducts: [...recommended, ...others], recommendedCount: recommended.length };
  }, [productCategory, sortMode, dynamicProducts, activeKid]);

  // Key vaccine milestones to show in journey (curated, with friendly labels).
  // Each id points at the first vaccine of that age group in VACCINE_SCHEDULE
  // so the date we compute matches the group header in the vaccine tracker.
  const JOURNEY_VACCINES: { id: string; label: string; detail: string }[] = [
    { id: 'iap-bcg', label: 'Birth Vaccines', detail: 'BCG, OPV-0 & Hepatitis B — first protection right from the start' },
    { id: 'iap-dtp-1', label: '6 Weeks Vaccines', detail: 'DTP, IPV, Hib, Hep B, Rotavirus & PCV — primary series begins' },
    { id: 'iap-dtp-2', label: '10 Weeks Vaccines', detail: 'Second round of DTP, IPV, Hib, Hep B, Rotavirus & PCV' },
    { id: 'iap-dtp-3', label: '14 Weeks Vaccines', detail: 'Completing the primary series' },
    { id: 'iap-mmr-1', label: '9 Month Vaccines', detail: 'MMR — measles, mumps & rubella protection' },
    { id: 'iap-mmr-2', label: '15 Month Vaccines', detail: 'MMR-2, Varicella & PCV booster' },
  ];

  // Pregnancy timeline milestones (relative to EDD)
  const PREGNANCY_EVENTS: { daysBeforeEDD: number; emoji: string; title: string; detail: string }[] = [
    { daysBeforeEDD: 224, emoji: '💓', title: '8 Weeks — Heartbeat!', detail: "Baby's heartbeat is now detectable by ultrasound — a moment you'll never forget" },
    { daysBeforeEDD: 196, emoji: '🌟', title: '12 Weeks — First Trimester Done', detail: 'Major organs are formed and the risk reduces significantly. Time for a little celebration!' },
    { daysBeforeEDD: 140, emoji: '🩺', title: '20 Weeks — Halfway There', detail: 'Anatomy scan week! Baby is about the size of a banana and kicks are getting stronger' },
    { daysBeforeEDD: 84,  emoji: '👂', title: '28 Weeks — Third Trimester', detail: "Baby can now hear your voice, respond to light, and has a good sleep cycle. Talk to them!" },
    { daysBeforeEDD: 28,  emoji: '🧘', title: '36 Weeks — Almost There', detail: "Baby is likely head-down and lungs are nearly ready. Start your hospital bag if you haven't!" },
    { daysBeforeEDD: 0,   emoji: '🤰', title: 'Expected Due Date', detail: "The big day! Every birth is unique and beautiful. You've grown a whole human — you're amazing 💕" },
  ];

  // Build journey events
  const journeyEvents = useMemo((): JourneyEvent[] => {
    if (!activeKid || !activeKid.dob) return [];
    const dob = new Date(activeKid.dob);
    const events: JourneyEvent[] = [];

    if (activeKid.isExpecting) {
      // Pregnancy journey — dob IS the expected due date
      PREGNANCY_EVENTS.forEach(({ daysBeforeEDD, emoji, title, detail }) => {
        const date = new Date(dob.getTime() - daysBeforeEDD * 24 * 60 * 60 * 1000);
        events.push({ date, title, emoji, detail, type: 'pregnancy' });
      });
    } else {
      // Postnatal journey — dob is the real birth date

      // 1. Birthday
      events.push({
        date: dob,
        title: `${activeKid.name}'s Birthday 🎂`,
        emoji: '👶',
        detail: `Welcome to the world, ${activeKid.name}! Your incredible journey together begins.`,
        type: 'birth',
      });

      // 2. Developmental milestones from data
      MILESTONES.forEach((m) => {
        const date = new Date(dob.getTime() + m.ageMonths * 30.44 * 24 * 60 * 60 * 1000);
        // First sentence of description only — keep it light
        const shortDesc = m.description.split('.')[0] + '.';
        events.push({ date, title: m.title, emoji: m.emoji, detail: shortDesc, type: 'milestone' });
      });

      // 3. Key vaccine milestones — compute dates directly from VACCINE_SCHEDULE
      const vaccineMap = Object.fromEntries(VACCINE_SCHEDULE.map((v) => [v.id, v]));
      JOURNEY_VACCINES.forEach(({ id, label, detail }) => {
        const v = vaccineMap[id];
        if (!v) return;
        const date = new Date(dob.getTime() + v.daysFromBirth * 24 * 60 * 60 * 1000);
        events.push({ date, title: label, emoji: '💉', detail, type: 'vaccine', vaccineId: id });
      });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activeKid]);

  return (
    <View style={styles.container}>
      {/* ── Dark Gradient Header ── */}
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.headerTitle}>Library</Text>
            {activeKid ? (
              <Text style={styles.headerSub}>Curated for {activeKid.name}</Text>
            ) : (
              <Text style={styles.headerSub}>Books, articles &amp; guides</Text>
            )}
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push('/admin')}
              style={styles.adminBtn}
              activeOpacity={0.75}
            >
              <AppIcon name="status.shield" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <SubTabSelector active={subTab} onChange={setSubTab} />

      {/* ── READ ── */}
      {subTab === 'read' && (
        <View style={styles.flex}>
          {/* Search bar */}
          <View style={styles.searchWrap}>
            <AppIcon name="nav.search" size={16} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={articleSearch}
              onChangeText={setArticleSearch}
              placeholder="Search articles…"
              placeholderTextColor="#9ca3af"
            />
            {articleSearch.length > 0 && (
              <TouchableOpacity onPress={() => setArticleSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppIcon name="nav.close-circle" size={16} />
              </TouchableOpacity>
            )}
          </View>

          {/* Topic filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.topicFilterScroll}
            contentContainerStyle={styles.topicFilterRow}
          >
            {displayTopics.map((topic) => (
              <TouchableOpacity
                key={topic}
                onPress={() => setArticleTopicFilter(topic)}
                activeOpacity={0.75}
                style={[styles.topicChip, topic === articleTopicFilter && styles.topicChipActive]}
              >
                <Text style={[styles.topicChipText, topic === articleTopicFilter && styles.topicChipTextActive]}>
                  {topic}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Personalisation banner */}
            <LinearGradient
              colors={['rgba(28, 16, 51, 0.06)', Colors.primaryAlpha05]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.personalisationBanner}
            >
              <AppIcon name="object.sparkles" size={16} />
              <Text style={styles.personalisationText}>
                {activeKid && !activeKid.isExpecting
                  ? `Showing content for ${activeKid.name} · ${ageLabel}`
                  : 'Showing content for all ages'}
              </Text>
            </LinearGradient>

            {/* Articles */}
            <Text style={styles.sectionTitle}>
              Articles {articles.length !== allArticles.length ? `(${articles.length})` : ''}
            </Text>
            {articles.length === 0 ? (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchEmoji}>🔍</Text>
                <Text style={styles.emptySearchText}>No articles found for "{articleSearch}"</Text>
                <TouchableOpacity onPress={() => { setArticleSearch(''); setArticleTopicFilter('All'); }}>
                  <Text style={styles.emptySearchReset}>Clear filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  autoExpand={pendingArticleId === a.id}
                  onAutoExpanded={consumePendingArticle}
                />
              ))
            )}

          </ScrollView>
        </View>
      )}

      {/* ── BOOKS ── */}
      {subTab === 'books' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {activeKid && (
            <View style={styles.bookSectionHeader}>
              <AppIcon name="object.sparkles" size={13} />
              <Text style={styles.bookPersonalBadgeText}>
                {activeKid.isExpecting ? 'Curated for your pregnancy' : `Curated for ${activeKid.name} · ${ageLabel}`}
              </Text>
            </View>
          )}
          {personalizedBooks.map((b) => (
            <BookCard key={b.id} book={b} highlighted={topBookIds.has(b.id)} />
          ))}
        </ScrollView>
      )}

      {/* ── PRODUCTS ── */}
      {subTab === 'products' && (
        <View style={styles.flex}>
          {/* Category filter — fixed at top, outside FlatList */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScrollView}
            contentContainerStyle={styles.categoriesRow}
          >
            {PRODUCT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, cat === productCategory && styles.catChipActive]}
                onPress={() => setProductCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.catChipText, cat === productCategory && styles.catChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
            {/* Sort button */}
            <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortModal(true)} activeOpacity={0.75}>
              <AppIcon name="object.funnel" size={14} color={Colors.primary} />
              <Text style={styles.sortBtnText}>{sortMode}</Text>
            </TouchableOpacity>
          </ScrollView>

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.productRow}
            contentContainerStyle={[styles.productsGrid, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              activeKid ? (
                <LinearGradient
                  colors={['rgba(28, 16, 51, 0.06)', Colors.primaryAlpha05]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.personalisationBanner}
                >
                  <AppIcon name="object.sparkles" size={16} />
                  <Text style={styles.personalisationText}>
                    {activeKid.isExpecting
                      ? `${recommendedCount} picks for your pregnancy`
                      : sortMode === 'Featured' && recommendedCount > 0
                        ? `${recommendedCount} picks for ${activeKid.name} · ${ageLabel}`
                        : `Showing products for ${activeKid.name} · ${ageLabel}`}
                  </Text>
                </LinearGradient>
              ) : null
            }
            renderItem={({ item, index }) => {
              const showDivider =
                recommendedCount > 0 &&
                sortMode === 'Featured' &&
                index === recommendedCount &&
                index % 2 === 0;
              return (
                <View style={{ flex: 1 }}>
                  {showDivider && (
                    <View style={styles.productSectionDivider}>
                      <View style={styles.productSectionDividerLine} />
                      <Text style={styles.productSectionDividerText}>More Products</Text>
                      <View style={styles.productSectionDividerLine} />
                    </View>
                  )}
                  <ProductCard product={item} />
                </View>
              );
            }}
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
                      <AppIcon name="status.check" size={18} color={Colors.primary} />
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
              <Illustration name="emptyLibrary" style={styles.emptyIllus} contentFit="contain" />
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
                        <AppIcon name="object.trash" size={18} role="muted" />
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
                {activeKid?.isExpecting
                  ? 'Your Pregnancy Journey'
                  : activeKid?.name
                  ? `${activeKid.name}'s Journey`
                  : 'Your Journey'}
              </Text>
              {/* Legend */}
              {!activeKid?.isExpecting && (
                <View style={journeyStyles.legend}>
                  <View style={journeyStyles.legendItem}>
                    <View style={[journeyStyles.legendDot, { backgroundColor: '#22c55e' }]} />
                    <Text style={journeyStyles.legendText}>Achieved</Text>
                  </View>
                  <View style={journeyStyles.legendItem}>
                    <View style={[journeyStyles.legendDot, { backgroundColor: '#e5e7eb', borderWidth: 1.5, borderColor: '#d1d5db' }]} />
                    <Text style={journeyStyles.legendText}>Upcoming</Text>
                  </View>
                  <View style={journeyStyles.legendItem}>
                    <Text style={journeyStyles.legendText}>👶 Birth  🌱 Dev  💉 Vaccine</Text>
                  </View>
                </View>
              )}
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
  container: { flex: 1, backgroundColor: Colors.bgLight },
  flex: { flex: 1 },
  // Dark header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF5',
  },
  glowTopRight: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'transparent', top: -60, right: -40,
  },
  glowBottomLeft: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'transparent', bottom: -40, left: -20,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 26, color: '#1C1033', letterSpacing: -0.3 },
  headerSub: { fontFamily: Fonts.sansRegular, fontSize: 12, color: '#6b7280', marginTop: 3 },
  adminBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  // Article search + filter
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { fontFamily: Fonts.sansRegular, flex: 1, fontSize: 14, color: '#1C1033' },
  topicFilterScroll: {
    flexShrink: 0,
    flexGrow: 0,
  },
  topicFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    alignItems: 'center',
  },
  topicChip: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
  },
  topicChipActive: {
    backgroundColor: Colors.primaryAlpha08,
    borderColor: Colors.primary,
  },
  topicChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#9CA3AF' },
  topicChipTextActive: { fontFamily: Fonts.sansBold, color: Colors.primary },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptySearchEmoji: { fontSize: 36 },
  emptySearchText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  emptySearchReset: { fontFamily: Fonts.sansBold, fontSize: 13, color: Colors.primary, marginTop: 4 },

  personalisationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  personalisationText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.primary, flex: 1 },
  sectionTitle: { fontFamily: Fonts.sansBold, fontSize: 18, color: '#1C1033', marginBottom: 12 },
  bookSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryAlpha05, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  bookPersonalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookPersonalBadgeText: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: Colors.primary, flex: 1 },
  categoriesScrollView: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: Colors.bgLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9F6',
  },
  categoriesRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    alignItems: 'center',
  },
  catChip: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5,
    borderColor: '#EDE9F6',
  },
  catChipActive: { backgroundColor: 'rgba(28, 16, 51, 0.048)', borderColor: Colors.primary },
  catChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#9CA3AF' },
  catChipTextActive: { fontFamily: Fonts.sansBold, color: Colors.primary },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryAlpha05,
    borderWidth: 1.5,
    borderColor: Colors.primaryAlpha12,
  },
  sortBtnText: { fontFamily: Fonts.sansBold, fontSize: 12, color: Colors.primary },
  productsGrid: { paddingHorizontal: 8, paddingTop: 8 },
  productRow: { gap: 8, paddingHorizontal: 8, marginBottom: 8 },
  productSectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  productSectionDividerLine: { flex: 1, height: 1, backgroundColor: '#EDE9F6' },
  productSectionDividerText: { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: '#C4B5D4', letterSpacing: 0.5 },
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortSheet: {
    backgroundColor: Colors.bgLight,
    borderRadius: 20,
    padding: 20,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.15)',
  } as any,
  sortTitle: { fontFamily: Fonts.sansBold, fontSize: 15, color: '#1C1033', marginBottom: 14 },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9F6',
  },
  sortOptionText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF' },
  sortOptionTextActive: { fontFamily: Fonts.sansBold, color: Colors.primary },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 56, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyIllus: { width: 220, height: 180, marginBottom: 12 },
  emptyTitle: { fontFamily: Fonts.sansBold, fontSize: 18, color: '#1C1033', marginBottom: 8 },
  emptyText: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  emptyHighlight: { fontFamily: Fonts.sansBold, color: Colors.primary },
  savedCard: { marginBottom: 12 },
  savedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  savedCardRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedDate: { fontFamily: Fonts.sansRegular, fontSize: 11, color: '#C4B5D4' },
  savedContent: { fontFamily: Fonts.sansRegular, fontSize: 14, color: '#374151', lineHeight: 22 },
});
