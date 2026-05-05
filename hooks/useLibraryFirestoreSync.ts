// Live Firestore → Zustand hydrator for the Library tab.
//
// On mount, opens onSnapshot subscriptions to articles/books/products where
// status is 'published' (the firestore rules already block draft + archived
// reads to non-admins). Each snapshot wholesale-replaces the matching store's
// in-memory list, so AI-generated content lands instantly.
//
// The Zustand stores stay persisted to AsyncStorage so the offline cache
// still works between app launches — the subscription overwrites that cache
// the moment a connection comes back.
//
// Mounted from app/(tabs)/library.tsx so the cost (3 onSnapshot listeners)
// is paid only when the user is on the Library tab.

import { useEffect } from 'react';

import { db } from '../services/firebase';
import { useArticleStore, DynamicArticle } from '../store/useArticleStore';
import { useBookStore, DynamicBook } from '../store/useBookStore';
import { useProductStore, DynamicProduct } from '../store/useProductStore';

export function useLibraryFirestoreSync(): void {
  const setArticles = useArticleStore((s) => s.setArticles);
  const setBooks = useBookStore((s) => s.setBooks);
  const setProducts = useProductStore((s) => s.setProducts);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;

    let unsubArticles: (() => void) | null = null;
    let unsubBooks: (() => void) | null = null;
    let unsubProducts: (() => void) | null = null;

    (async () => {
      const { collection, onSnapshot, query, where } = await import('firebase/firestore');
      if (cancelled || !db) return;

      // ── Articles ────────────────────────────────────────────────────────
      try {
        unsubArticles = onSnapshot(
          query(collection(db, 'articles'), where('status', '==', 'published')),
          (snap) => {
            const rows: DynamicArticle[] = snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                title: typeof data.title === 'string' ? data.title : '',
                preview: typeof data.preview === 'string' ? data.preview : '',
                body: typeof data.body === 'string' ? data.body : '',
                topic: typeof data.topic === 'string' ? data.topic : 'General',
                readTime: typeof data.readTime === 'string' ? data.readTime : '5 min read',
                ageMin: typeof data.ageMin === 'number' ? data.ageMin : 0,
                ageMax: typeof data.ageMax === 'number' ? data.ageMax : 999,
                emoji: typeof data.emoji === 'string' && data.emoji ? data.emoji : '📰',
                tag: typeof data.tag === 'string' ? data.tag : '',
                url: typeof data.url === 'string' ? data.url : undefined,
                imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
                addedAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
              };
            }).filter((r) => r.title && r.preview);
            setArticles(rows);
          },
          (err) => console.warn('[libraryFirestoreSync] articles', err),
        );
      } catch (e) {
        console.warn('[libraryFirestoreSync] articles subscribe failed', e);
      }

      // ── Books ───────────────────────────────────────────────────────────
      try {
        unsubBooks = onSnapshot(
          query(collection(db, 'books'), where('status', '==', 'published')),
          (snap) => {
            const rows: DynamicBook[] = snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                title: typeof data.title === 'string' ? data.title : '',
                author: typeof data.author === 'string' ? data.author : 'Unknown Author',
                description: typeof data.description === 'string' ? data.description : '',
                rating: typeof data.rating === 'number' ? data.rating : 0,
                reviews: typeof data.reviews === 'number' ? data.reviews : 0,
                imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
                topic: typeof data.topic === 'string' ? data.topic : 'General',
                url: typeof data.url === 'string' ? data.url : '',
                sampleUrl: typeof data.sampleUrl === 'string' ? data.sampleUrl : undefined,
                ageMin: typeof data.ageMin === 'number' ? data.ageMin : 0,
                ageMax: typeof data.ageMax === 'number' ? data.ageMax : 999,
                addedAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
                googleBooksId: typeof data.googleBooksId === 'string' ? data.googleBooksId : undefined,
              };
            }).filter((r) => r.title && r.url);
            setBooks(rows);
          },
          (err) => console.warn('[libraryFirestoreSync] books', err),
        );
      } catch (e) {
        console.warn('[libraryFirestoreSync] books subscribe failed', e);
      }

      // ── Products ────────────────────────────────────────────────────────
      try {
        unsubProducts = onSnapshot(
          query(collection(db, 'products'), where('status', '==', 'published')),
          (snap) => {
            const rows: DynamicProduct[] = snap.docs.map((d) => {
              const data = d.data() as any;
              const ageMinMonths = typeof data.ageMinMonths === 'number' ? data.ageMinMonths : -9;
              const ageMaxMonths = typeof data.ageMaxMonths === 'number' ? data.ageMaxMonths : 999;
              const product: DynamicProduct & { ageMinMonths?: number; ageMaxMonths?: number } = {
                id: d.id,
                name: typeof data.name === 'string' ? data.name : '',
                emoji: typeof data.emoji === 'string' && data.emoji ? data.emoji : '🛍️',
                price: typeof data.price === 'number' ? data.price : 0,
                originalPrice: typeof data.originalPrice === 'number' ? data.originalPrice : 0,
                rating: typeof data.rating === 'number' ? data.rating : 0,
                reviews: typeof data.reviews === 'number' ? data.reviews : 0,
                badge: typeof data.badge === 'string' ? data.badge : undefined,
                description: typeof data.description === 'string' ? data.description : '',
                category: typeof data.category === 'string' ? data.category : 'Mother',
                url: typeof data.url === 'string' ? data.url : '',
                imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
                addedAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
                ageMinMonths,
                ageMaxMonths,
              };
              return product;
            }).filter((r) => r.name && r.url);
            setProducts(rows);
          },
          (err) => console.warn('[libraryFirestoreSync] products', err),
        );
      } catch (e) {
        console.warn('[libraryFirestoreSync] products subscribe failed', e);
      }
    })();

    return () => {
      cancelled = true;
      unsubArticles?.();
      unsubBooks?.();
      unsubProducts?.();
    };
  }, [setArticles, setBooks, setProducts]);
}
