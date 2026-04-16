import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DynamicBook {
  id: string;
  title: string;
  author: string;
  description: string;
  rating: number;
  reviews: number;
  imageUrl?: string;
  topic: string;
  url: string;
  sampleUrl?: string;
  ageMin: number;  // months; -9 = pregnancy, 999 = always
  ageMax: number;
  addedAt: string;
  googleBooksId?: string;
}

interface BookState {
  books: DynamicBook[];
  addBook: (book: Omit<DynamicBook, 'id' | 'addedAt'>) => string;
  removeBook: (id: string) => void;
  updateBook: (id: string, updates: Partial<Omit<DynamicBook, 'id' | 'addedAt'>>) => void;
}

export const useBookStore = create<BookState>()(
  persist(
    (set) => ({
      books: [],

      addBook: (book) => {
        const id = `dyn-${Date.now()}`;
        set((s) => ({
          books: [
            { ...book, id, addedAt: new Date().toISOString() },
            ...s.books,
          ],
        }));
        return id;
      },

      removeBook: (id) =>
        set((s) => ({ books: s.books.filter((b) => b.id !== id) })),

      updateBook: (id, updates) =>
        set((s) => ({
          books: s.books.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        })),
    }),
    {
      name: 'maamitra-books',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
