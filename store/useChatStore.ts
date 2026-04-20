import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sendMessage as callClaude,
  detectIsEmergency,
  getTopicTag,
  ChatContext,
} from '../services/claude';
import { saveChatThread, deleteChatThread, loadChatThreads } from '../services/firebase';

// Lazy-accessed to avoid circular dependency (useAuthStore imports useChatStore)
const getAuthUid = (): string | undefined => {
  try {
    return require('./useAuthStore').useAuthStore.getState().user?.uid;
  } catch {
    return undefined;
  }
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isEmergency?: boolean;
  tag?: { tag: string; color: string };
  saved?: boolean;
  /**
   * Data URL (data:image/jpeg;base64,…) of an image the user attached.
   * Sent to Claude as a vision-enabled multimodal content part. Not
   * persisted to Firestore — images stay in-thread for the session to
   * avoid ballooning the doc size. Re-sent with each turn so the model
   * keeps seeing them.
   */
  imageDataUrl?: string;
  imageMimeType?: string; // e.g. 'image/jpeg'
}

export interface SavedAnswer {
  id: string;
  content: string;
  tag: { tag: string; color: string };
  savedAt: Date;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastMessageAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeThread(title = 'New chat'): ChatThread {
  const now = new Date();
  return {
    id: genId('thread'),
    title,
    messages: [],
    createdAt: now,
    lastMessageAt: now,
  };
}

/** Derive a short title from the first user message */
function titleFromText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 40 ? trimmed.slice(0, 40) + '…' : trimmed;
}

/** Fire-and-forget sync a thread to Firestore for the current user */
function syncThreadToFirestore(thread: ChatThread): void {
  const uid = getAuthUid();
  if (!uid) return;
  saveChatThread(uid, thread).catch(() => {});
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ChatState {
  // Threads
  threads: ChatThread[];
  activeThreadId: string | null;

  // UI / shared
  isTyping: boolean;
  allergies: string[] | null;
  savedAnswers: SavedAnswer[];

  /**
   * Preferred language for voice input AND spoken replies. BCP-47 tag
   * (e.g. 'en-IN', 'hi-IN', 'ta-IN'). The AI itself always mirrors the
   * user's text script — this is only for voice features.
   */
  voiceLanguage: string;
  setVoiceLanguage: (code: string) => void;

  // Computed
  getActiveThread: () => ChatThread | null;
  getActiveMessages: () => ChatMessage[];

  // Thread actions
  createThread: (title?: string) => string;
  switchThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  renameThread: (threadId: string, title: string) => void;

  // Message actions
  sendMessage: (
    text: string,
    context: ChatContext,
    attachment?: { dataUrl: string; mimeType: string },
  ) => Promise<void>;
  saveAnswer: (messageId: string) => void;
  unsaveAnswer: (messageId: string) => void;
  setAllergies: (allergies: string[]) => void;
  clearChat: () => void;           // clears active thread's messages only
  resetAll: () => void;             // wipes everything (called on signOut)

  // Firestore sync
  loadThreadsFromFirestore: () => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      threads: [],
      activeThreadId: null,
      isTyping: false,
      allergies: null,
      savedAnswers: [],
      voiceLanguage: 'en-IN',
      setVoiceLanguage: (code: string) => set({ voiceLanguage: code }),

      getActiveThread: () => {
        const { threads, activeThreadId } = get();
        return threads.find((t) => t.id === activeThreadId) ?? null;
      },

      getActiveMessages: () => {
        return get().getActiveThread()?.messages ?? [];
      },

      createThread: (title = 'New chat') => {
        const thread = makeThread(title);
        set((state) => ({
          threads: [thread, ...state.threads],
          activeThreadId: thread.id,
        }));
        return thread.id;
      },

      switchThread: (threadId: string) => {
        const exists = get().threads.some((t) => t.id === threadId);
        if (exists) set({ activeThreadId: threadId });
      },

      deleteThread: (threadId: string) => {
        set((state) => {
          const remaining = state.threads.filter((t) => t.id !== threadId);
          const newActive = state.activeThreadId === threadId
            ? (remaining[0]?.id ?? null)
            : state.activeThreadId;
          return { threads: remaining, activeThreadId: newActive };
        });
        // Fire-and-forget Firestore delete
        const uid = getAuthUid();
        if (uid) deleteChatThread(uid, threadId).catch(() => {});
      },

      renameThread: (threadId: string, title: string) => {
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === threadId ? { ...t, title: title.trim() || 'New chat' } : t
          ),
        }));
        const updated = get().threads.find((t) => t.id === threadId);
        if (updated) syncThreadToFirestore(updated);
      },

      sendMessage: async (
        text: string,
        context: ChatContext,
        attachment?: { dataUrl: string; mimeType: string },
      ) => {
        // Ensure we have an active thread
        let { activeThreadId, threads } = get();
        let thread = threads.find((t) => t.id === activeThreadId);

        if (!thread) {
          const newId = get().createThread(titleFromText(text));
          thread = get().threads.find((t) => t.id === newId)!;
          activeThreadId = newId;
        }

        const userMessage: ChatMessage = {
          id: genId('msg'),
          role: 'user',
          content: text,
          timestamp: new Date(),
          isEmergency: detectIsEmergency(text),
          imageDataUrl: attachment?.dataUrl,
          imageMimeType: attachment?.mimeType,
        };

        // If this is the first user message in a thread still called "New chat",
        // auto-title from the first user message.
        const isFirstUserMsg = thread.messages.length === 0 || thread.title === 'New chat';
        const newTitle = isFirstUserMsg ? titleFromText(text) : thread.title;

        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === activeThreadId
              ? {
                  ...t,
                  title: newTitle,
                  messages: [...t.messages, userMessage],
                  lastMessageAt: new Date(),
                }
              : t
          ),
          isTyping: true,
        }));

        // Build message history for the API (active thread's messages only).
        // Attachment fields are passed through as sidecars; services/claude.ts
        // converts them into the Anthropic multimodal content shape.
        const messagesForApi = [...(get().getActiveMessages() ?? [])].map((m) => ({
          role: m.role,
          content: m.content,
          imageDataUrl: m.imageDataUrl,
          imageMimeType: m.imageMimeType,
        }));

        try {
          const responseText = await callClaude(messagesForApi, context);

          const tag = getTopicTag(text, responseText);
          const isEmergency = detectIsEmergency(text) || detectIsEmergency(responseText);

          const assistantMessage: ChatMessage = {
            id: genId('msg'),
            role: 'assistant',
            content: responseText,
            timestamp: new Date(),
            isEmergency,
            tag,
            saved: false,
          };

          set((state) => ({
            threads: state.threads.map((t) =>
              t.id === activeThreadId
                ? {
                    ...t,
                    messages: [...t.messages, assistantMessage],
                    lastMessageAt: new Date(),
                  }
                : t
            ),
            isTyping: false,
          }));

          // Sync the completed thread to Firestore (fire-and-forget)
          const updated = get().threads.find((t) => t.id === activeThreadId);
          if (updated) syncThreadToFirestore(updated);
        } catch (error) {
          console.error('sendMessage error:', error);
          set({ isTyping: false });
        }
      },

      saveAnswer: (messageId: string) => {
        const activeMessages = get().getActiveMessages();
        const message = activeMessages.find((m) => m.id === messageId);
        if (!message || message.role !== 'assistant') return;

        const { savedAnswers, activeThreadId } = get();
        const alreadySaved = savedAnswers.some((a) => a.id === messageId);
        if (alreadySaved) return;

        const savedAnswer: SavedAnswer = {
          id: message.id,
          content: message.content,
          tag: message.tag ?? { tag: '💬 General', color: '#9ca3af' },
          savedAt: new Date(),
        };

        set((state) => ({
          savedAnswers: [...state.savedAnswers, savedAnswer],
          threads: state.threads.map((t) =>
            t.id === activeThreadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === messageId ? { ...m, saved: true } : m
                  ),
                }
              : t
          ),
        }));
      },

      unsaveAnswer: (messageId: string) => {
        const { activeThreadId } = get();
        set((state) => ({
          savedAnswers: state.savedAnswers.filter((a) => a.id !== messageId),
          threads: state.threads.map((t) =>
            t.id === activeThreadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === messageId ? { ...m, saved: false } : m
                  ),
                }
              : t
          ),
        }));
      },

      setAllergies: (allergies: string[]) => set({ allergies }),

      clearChat: () => {
        // Clear messages in the active thread only
        const { activeThreadId } = get();
        if (!activeThreadId) return;
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === activeThreadId ? { ...t, messages: [], title: 'New chat' } : t
          ),
        }));
      },

      resetAll: () => {
        set({
          threads: [],
          activeThreadId: null,
          isTyping: false,
          allergies: null,
          savedAnswers: [],
        });
      },

      loadThreadsFromFirestore: async () => {
        const uid = getAuthUid();
        if (!uid) return;
        try {
          const remote = await loadChatThreads(uid);
          if (remote.length === 0) return;

          set((state) => {
            // Merge: remote threads take precedence (they have full history),
            // but keep any local-only threads not yet synced
            const remoteIds = new Set(remote.map((t) => t.id));
            const localOnly = state.threads.filter((t) => !remoteIds.has(t.id));
            const merged = [...remote, ...localOnly].sort(
              (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
            );
            return {
              threads: merged,
              activeThreadId: state.activeThreadId ?? merged[0]?.id ?? null,
            };
          });
        } catch (error) {
          console.error('loadThreadsFromFirestore error:', error);
        }
      },
    }),
    {
      name: 'maamitra-chat',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        threads: state.threads.slice(0, 20).map((t) => ({
          ...t,
          messages: t.messages.slice(-50), // cap per-thread at 50 messages locally
        })),
        activeThreadId: state.activeThreadId,
        allergies: state.allergies,
        savedAnswers: state.savedAnswers,
      }),
      // Migration: legacy flat `messages[]` state → wrap into a default thread
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        if (persisted.threads && Array.isArray(persisted.threads)) {
          // Already in new format — rehydrate dates
          persisted.threads = persisted.threads.map((t: any) => ({
            ...t,
            createdAt: new Date(t.createdAt),
            lastMessageAt: new Date(t.lastMessageAt),
            messages: (t.messages ?? []).map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          }));
          return persisted;
        }
        // Legacy format — wrap existing messages into a default thread
        const legacyMessages = Array.isArray(persisted.messages) ? persisted.messages : [];
        if (legacyMessages.length === 0) {
          return { ...persisted, threads: [], activeThreadId: null };
        }
        const now = new Date();
        const legacyThread: ChatThread = {
          id: genId('thread'),
          title: 'Previous chat',
          messages: legacyMessages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
          createdAt: now,
          lastMessageAt: now,
        };
        return {
          ...persisted,
          threads: [legacyThread],
          activeThreadId: legacyThread.id,
        };
      },
      version: 2,
    }
  )
);
