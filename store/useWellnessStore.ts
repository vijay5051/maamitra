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

function fmtDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return 7 YYYY-MM-DD strings starting from Monday of the week containing `anchor`. */
function getWeekDatesFor(anchor: Date): string[] {
  const dayOfWeek = anchor.getDay(); // 0 = Sunday
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((dayOfWeek + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return fmtDate(d);
  });
}

function getWeekDates(): string[] {
  return getWeekDatesFor(new Date());
}

interface WellnessState {
  moodHistory: MoodEntry[];
  healthConditions: string[] | null;
  todayMood: MoodEntry | null;

  logMood: (score: 1 | 2 | 3 | 4 | 5) => void;
  setHealthConditions: (conditions: string[]) => void;
  getTodayMood: () => MoodEntry | null;
  getWeekHistory: () => Array<MoodEntry | null>;
  /** Week view anchored at any date (for ←/→ navigation in the chart). */
  getWeekHistoryFor: (anchor: Date) => Array<MoodEntry | null>;
  /** Dense month view (every day of the month) for calendar grid. */
  getMonthHistoryFor: (year: number, monthIndex: number) => Array<{ date: string; entry: MoodEntry | null }>;
  resetWellness: () => void;
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
          // Replace today's entry if it already exists, then keep a full year
          // of history so navigating backwards through the chart never loses
          // past days.
          const filtered = state.moodHistory.filter((m) => m.date !== entry.date);
          const updated = [...filtered, entry].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 366);
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

      getWeekHistoryFor: (anchor: Date) => {
        const { moodHistory } = get();
        const weekDates = getWeekDatesFor(anchor);
        return weekDates.map((date) => moodHistory.find((m) => m.date === date) ?? null);
      },

      getMonthHistoryFor: (year: number, monthIndex: number) => {
        const { moodHistory } = get();
        const first = new Date(year, monthIndex, 1);
        const last = new Date(year, monthIndex + 1, 0); // day 0 of next month = last day of current
        const out: Array<{ date: string; entry: MoodEntry | null }> = [];
        for (let day = 1; day <= last.getDate(); day++) {
          const d = new Date(year, monthIndex, day);
          const key = fmtDate(d);
          out.push({ date: key, entry: moodHistory.find((m) => m.date === key) ?? null });
        }
        return out;
      },

      resetWellness: () => set({ moodHistory: [], healthConditions: null, todayMood: null }),
    }),
    {
      name: 'maamitra-wellness',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
