import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Questions sent to the AI today, per account, in local time. Resets at midnight.
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface AiQuotaState {
  day: string;
  counts: Record<string, number>;
  usedToday: (uid: string) => number;
  record: (uid: string) => void;
}

export const useAiQuotaStore = create<AiQuotaState>()(
  persist(
    (set, get) => ({
      day: todayKey(),
      counts: {},
      usedToday: (uid) => (get().day === todayKey() ? get().counts[uid] ?? 0 : 0),
      record: (uid) =>
        set((s) => {
          const today = todayKey();
          const counts = s.day === today ? s.counts : {};
          return { day: today, counts: { ...counts, [uid]: (counts[uid] ?? 0) + 1 } };
        }),
    }),
    {
      name: 'maamitra-ai-quota',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ day: s.day, counts: s.counts }),
    },
  ),
);
