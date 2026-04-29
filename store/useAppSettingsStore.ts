import { create } from 'zustand';
import { getAppSettings, updateAppSettings, DEFAULT_APP_SETTINGS } from '../services/firebase';

export interface AppSettings {
  featureFlags: Record<string, boolean>;
  /** Optional rollout map: feature key → percentage (0–100). When present
   *  alongside featureFlags, the client gates the feature only for users
   *  whose hashed-uid % 100 < rollout[key]. Null/undefined = full rollout. */
  flagRollouts?: Record<string, number>;
  theme: { primary: string; secondary: string };
  tabs: Array<{ key: string; label: string; icon: string; visible: boolean }>;
  notificationTexts: Record<string, string>;
  /** In-app banner — null/absent = no banner. See /admin/banner. */
  banner?: {
    title: string;
    body: string;
    cta?: { label: string; href: string };
    tone?: 'info' | 'warn' | 'celebrate';
    publishedAt: string;
    expiresAt?: string;
  } | null;
}

interface AppSettingsState {
  settings: AppSettings;
  isLoading: boolean;
  lastFetched: number | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  isTabVisible: (key: string) => boolean;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS as AppSettings,
  isLoading: false,
  lastFetched: null,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const fetched = await getAppSettings();
      set({
        settings: fetched as AppSettings,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      console.error('fetchSettings error:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    try {
      const { settings } = get();
      const merged: AppSettings = { ...settings, ...partial };
      await updateAppSettings(merged as any);
      set({ settings: merged });
    } catch (error) {
      console.error('updateSettings error:', error);
      throw error;
    }
  },

  isTabVisible: (key: string) => {
    const { settings } = get();
    const tab = settings.tabs.find((t) => t.key === key);
    return tab?.visible ?? true;
  },
}));
