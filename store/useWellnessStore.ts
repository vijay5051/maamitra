import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MoodEntry {
  date: string; // YYYY-MM-DD
  score: 1 | 2 | 3 | 4 | 5;
  emoji: string;
  label: string;
}

export const MOOD_DATA: Array<{ score: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }> = [
  { score: 5, emoji: '😊', label: 'Great' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 2, emoji: '😔', label: 'Low' },
  { score: 1, emoji: '😢', label: 'Tough' },
];

export const MOOD_RESPONSES: Record<number, string> = {
  5: "You're glowing today! ✨ Your positive energy is beautiful — keep nurturing yourself.",
  4: "Glad you're feeling good! 🙂 Small wins count — you're doing wonderfully.",
  3: "Some days are just okay, and that's perfectly fine. 💛 Be gentle with yourself today.",
  2: "I hear you. It's okay to have tough moments. 💙 You're stronger than you think.",
  1: "Sending you the biggest virtual hug. 🤗 Please reach out to someone you trust today — you don't have to face this alone.",
};

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDates(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  // Start from Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
}

interface WellnessState {
  moodHistory: MoodEntry[];
  healthConditions: string[] | null;
  todayMood: MoodEntry | null;

  logMood: (score: 1 | 2 | 3 | 4 | 5) => void;
  setHealthConditions: (conditions: string[]) => void;
  getTodayMood: () => MoodEntry | null;
  getWeekHistory: () => Array<MoodEntry | null>;
}

export const useWellnessStore = create<WellnessState>()(
  persist(
    (set, get) => ({
      moodHistory: [],
      healthConditions: null,
      todayMood: null,

      logMood: (score: 1 | 2 | 3 | 4 | 5) => {
        const moodInfo = MOOD_DATA.find((m) => m.score === score)!;
        const entry: MoodEntry = {
          date: getTodayDateString(),
          score,
          emoji: moodInfo.emoji,
          label: moodInfo.label,
        };

        set((state) => {
          // Replace today's entry if it already exists, then keep last 7 days
          const filtered = state.moodHistory.filter((m) => m.date !== entry.date);
          const updated = [...filtered, entry].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
          return { moodHistory: updated, todayMood: entry };
        });
      },

      setHealthConditions: (conditions: string[]) => set({ healthConditions: conditions }),

      getTodayMood: () => {
        const today = getTodayDateString();
        const { moodHistory } = get();
        return moodHistory.find((m) => m.date === today) ?? null;
      },

      getWeekHistory: () => {
        const { moodHistory } = get();
        const weekDates = getWeekDates();
        return weekDates.map((date) => moodHistory.find((m) => m.date === date) ?? null);
      },
    }),
    {
      name: 'maamitra-wellness',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
