import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DynamicProduct {
  id: string;
  name: string;
  emoji: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  badge?: string;
  description: string;
  category: string;
  url: string;
  imageUrl?: string;
  addedAt: string;
}

interface ProductState {
  products: DynamicProduct[];
  addProduct: (p: Omit<DynamicProduct, 'id' | 'addedAt'>) => string;
  removeProduct: (id: string) => void;
  updateProduct: (id: string, updates: Partial<Omit<DynamicProduct, 'id' | 'addedAt'>>) => void;
}

export const useProductStore = create<ProductState>()(
  persist(
    (set) => ({
      products: [],

      addProduct: (p) => {
        const id = `prod-${Date.now()}`;
        set((s) => ({
          products: [{ ...p, id, addedAt: new Date().toISOString() }, ...s.products],
        }));
        return id;
      },

      removeProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      updateProduct: (id, updates) =>
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
    }),
    {
      name: 'maamitra-products',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
