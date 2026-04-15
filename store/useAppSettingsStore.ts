import { create } from 'zustand';
import { getAppSettings, updateAppSettings, DEFAULT_APP_SETTINGS } from '../services/firebase';

export interface AppSettings {
  featureFlags: Record<string, boolean>;
  theme: { primary: string; secondary: string };
  tabs: Array<{ key: string; label: string; icon: string; visible: boolean }>;
  notificationTexts: Record<string, string>;
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
