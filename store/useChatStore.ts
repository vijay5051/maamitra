import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sendMessage as callClaude,
  detectIsEmergency,
  detectIsFood,
  detectIsYoga,
  getTopicTag,
  ChatContext,
} from '../services/claude';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isEmergency?: boolean;
  tag?: { tag: string; color: string };
  saved?: boolean;
}

export interface SavedAnswer {
  id: string;
  content: string;
  tag: { tag: string; color: string };
  savedAt: Date;
}

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  allergies: string[] | null;
  savedAnswers: SavedAnswer[];

  sendMessage: (text: string, context: ChatContext) => Promise<void>;
  saveAnswer: (messageId: string) => void;
  unsaveAnswer: (messageId: string) => void;
  setAllergies: (allergies: string[]) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isTyping: false,
      allergies: null,
      savedAnswers: [],

      sendMessage: async (text: string, context: ChatContext) => {
        const userMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'user',
          content: text,
          timestamp: new Date(),
          isEmergency: detectIsEmergency(text),
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          isTyping: true,
        }));

        // Build message history for the API (exclude system-only fields)
        const { messages } = get();
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const responseText = await callClaude(apiMessages, context);

        const tag = getTopicTag(text, responseText);
        const isEmergency = detectIsEmergency(text) || detectIsEmergency(responseText);

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
          isEmergency,
          tag,
          saved: false,
        };

        set((state) => ({
          messages: [...state.messages, assistantMessage],
          isTyping: false,
        }));
      },

      saveAnswer: (messageId: string) => {
        const { messages, savedAnswers } = get();
        const message = messages.find((m) => m.id === messageId);
        if (!message || message.role !== 'assistant') return;

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
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, saved: true } : m
          ),
        }));
      },

      unsaveAnswer: (messageId: string) => {
        set((state) => ({
          savedAnswers: state.savedAnswers.filter((a) => a.id !== messageId),
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, saved: false } : m
          ),
        }));
      },

      setAllergies: (allergies: string[]) => set({ allergies }),

      clearChat: () => set({ messages: [] }),
    }),
    {
      name: 'maamitra-chat',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        messages: state.messages.slice(-50), // keep last 50 messages
        allergies: state.allergies,
        savedAnswers: state.savedAnswers,
      }),
    }
  )
);
