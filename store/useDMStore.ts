import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useProfileStore } from './useProfileStore';
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage as sendDM,
  markConversationRead,
  getUnreadDMCount,
  conversationId,
  subscribeConversations,
  subscribeMessages,
  type DMConversation,
  type DMMessage,
} from '../services/messages';
import type { Unsubscribe } from 'firebase/firestore';

interface DMState {
  conversations: DMConversation[];
  activeMessages: DMMessage[];
  activeConvId: string | null;
  unreadTotal: number;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;

  loadConversations: () => Promise<void>;
  loadMessages: (otherUid: string) => Promise<void>;
  sendMessage: (
    otherUid: string,
    otherName: string,
    otherPhoto: string,
    text: string,
    imageUrl?: string,
  ) => Promise<void>;
  markRead: (otherUid: string) => Promise<void>;
  loadUnreadCount: () => Promise<void>;

  /** Open a real-time listener on all conversations for this user.
   *  Powers the live unread-message badge on every tab that shows it.
   *  Idempotent per uid. */
  subscribeConversations: (uid: string) => () => void;
  /** Listen to messages in a specific thread live. Returns a teardown. */
  subscribeActiveThread: (otherUid: string) => () => void;
  unsubscribeAll: () => void;

  reset: () => void;
}

let _convUnsub: Unsubscribe | null = null;
let _convUid: string | null = null;
let _activeUnsub: Unsubscribe | null = null;
let _activeConvId: string | null = null;

function stopConvSub() {
  try { _convUnsub?.(); } catch {}
  _convUnsub = null;
  _convUid = null;
}
function stopActiveSub() {
  try { _activeUnsub?.(); } catch {}
  _activeUnsub = null;
  _activeConvId = null;
}

const initialState = {
  conversations: [] as DMConversation[],
  activeMessages: [] as DMMessage[],
  activeConvId: null as string | null,
  unreadTotal: 0,
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSending: false,
};

export const useDMStore = create<DMState>((set, get) => ({
  ...initialState,

  loadConversations: async () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    set({ isLoadingConversations: true });
    try {
      const conversations = await getConversations(uid);
      const unreadTotal = conversations.filter((c) => c.unreadBy.includes(uid)).length;
      set({ conversations, unreadTotal });
    } catch (error) {
      console.error('loadConversations error:', error);
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (otherUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    const convId = conversationId(uid, otherUid);
    set({ isLoadingMessages: true, activeConvId: convId });
    try {
      const { messages } = await getMessages(convId);
      // Reverse so oldest is first (FlatList inverted will flip them)
      set({ activeMessages: messages.reverse() });
    } catch (error) {
      console.error('loadMessages error:', error);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (
    otherUid: string,
    otherName: string,
    otherPhoto: string,
    text: string,
    imageUrl?: string,
  ) => {
    const uid = useAuthStore.getState().user?.uid;
    const myName = useProfileStore.getState().motherName || 'User';
    const myPhoto = useProfileStore.getState().photoUrl || '';
    if (!uid) return;

    set({ isSending: true });
    try {
      const convId = await getOrCreateConversation(uid, myName, myPhoto, otherUid, otherName, otherPhoto);
      const msg = await sendDM(convId, uid, myName, myPhoto, text, otherUid, imageUrl);

      if (msg) {
        set((state) => ({
          activeMessages: [...state.activeMessages, msg],
          activeConvId: convId,
        }));
      }

      // Update conversation list locally
      set((state) => {
        const existing = state.conversations.find((c) => c.id === convId);
        if (existing) {
          return {
            conversations: state.conversations.map((c) =>
              c.id === convId
                ? { ...c, lastMessage: text, lastMessageTime: new Date(), lastMessageSenderUid: uid }
                : c
            ),
          };
        }
        // New conversation — add to top
        return {
          conversations: [{
            id: convId,
            participants: [uid, otherUid].sort(),
            participantNames: { [uid]: myName, [otherUid]: otherName },
            participantPhotos: { [uid]: myPhoto, [otherUid]: otherPhoto },
            lastMessage: text,
            lastMessageTime: new Date(),
            lastMessageSenderUid: uid,
            unreadBy: [otherUid],
            createdAt: new Date(),
          }, ...state.conversations],
        };
      });
    } catch (error) {
      console.error('sendMessage error:', error);
    } finally {
      set({ isSending: false });
    }
  },

  markRead: async (otherUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;

    const convId = conversationId(uid, otherUid);
    try {
      await markConversationRead(convId, uid);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === convId
            ? { ...c, unreadBy: c.unreadBy.filter((u) => u !== uid) }
            : c
        ),
        unreadTotal: Math.max(0, state.unreadTotal - 1),
      }));
    } catch (error) {
      console.error('markRead error:', error);
    }
  },

  loadUnreadCount: async () => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return;
    try {
      const count = await getUnreadDMCount(uid);
      set({ unreadTotal: count });
    } catch (error) {
      console.error('loadUnreadCount error:', error);
    }
  },

  subscribeConversations: (uid: string) => {
    if (_convUid === uid && _convUnsub) {
      return () => stopConvSub();
    }
    stopConvSub();
    const unsub = subscribeConversations(uid, (conversations, unreadTotal) => {
      set({ conversations, unreadTotal });
    });
    _convUnsub = unsub ?? null;
    _convUid = uid;
    return () => stopConvSub();
  },

  subscribeActiveThread: (otherUid: string) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) return () => {};
    const convId = conversationId(uid, otherUid);
    if (_activeConvId === convId && _activeUnsub) {
      return () => stopActiveSub();
    }
    stopActiveSub();
    set({ activeConvId: convId });
    const unsub = subscribeMessages(convId, (messages) => {
      // Service returns newest-first (desc). Store keeps oldest-first so
      // the FlatList renders naturally top-to-bottom.
      set({ activeMessages: [...messages].reverse() });
    });
    _activeUnsub = unsub ?? null;
    _activeConvId = convId;
    return () => stopActiveSub();
  },

  unsubscribeAll: () => {
    stopConvSub();
    stopActiveSub();
  },

  reset: () => {
    // Tear down listeners so the next user's session doesn't leak streams.
    stopConvSub();
    stopActiveSub();
    set(initialState);
  },
}));
