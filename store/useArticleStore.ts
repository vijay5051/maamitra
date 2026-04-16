import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DynamicArticle {
  id: string;
  title: string;
  preview: string;
  body: string;
  topic: string;
  readTime: string;
  ageMin: number;
  ageMax: number;
  emoji: string;
  tag: string;
  url?: string;
  imageUrl?: string;
  addedAt: string;
}

interface ArticleState {
  articles: DynamicArticle[];
  addArticle: (a: Omit<DynamicArticle, 'id' | 'addedAt'>) => string;
  removeArticle: (id: string) => void;
  updateArticle: (id: string, updates: Partial<Omit<DynamicArticle, 'id' | 'addedAt'>>) => void;
}

export const useArticleStore = create<ArticleState>()(
  persist(
    (set) => ({
      articles: [],

      addArticle: (a) => {
        const id = `art-${Date.now()}`;
        set((s) => ({
          articles: [{ ...a, id, addedAt: new Date().toISOString() }, ...s.articles],
        }));
        return id;
      },

      removeArticle: (id) =>
        set((s) => ({ articles: s.articles.filter((a) => a.id !== id) })),

      updateArticle: (id, updates) =>
        set((s) => ({
          articles: s.articles.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
    }),
    {
      name: 'maamitra-articles',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
