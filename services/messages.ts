/**
 * Direct Messaging Firestore service.
 *
 * Collections:
 *   conversations/{conversationId}                    — conversation metadata
 *   conversations/{conversationId}/messages/{msgId}   — individual messages
 *
 * Conversation IDs are deterministic: sorted UIDs joined with '_'
 * so the same pair of users always maps to a single conversation.
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { createNotification, firestoreDate } from './social';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DMConversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageSenderUid: string;
  unreadBy: string[];          // UIDs that haven't read the latest message
  createdAt: Date;
}

export interface DMMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  createdAt: Date;
  read: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deterministic conversation ID from two UIDs */
export function conversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

// ─── Conversations ───────────────────────────────────────────────────────────

/** Get or create a conversation between two users */
export async function getOrCreateConversation(
  myUid: string,
  myName: string,
  myPhoto: string,
  otherUid: string,
  otherName: string,
  otherPhoto: string,
): Promise<string> {
  if (!db) return '';
  const convId = conversationId(myUid, otherUid);
  const ref = doc(db, 'conversations', convId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [myUid, otherUid].sort(),
      participantNames: { [myUid]: myName, [otherUid]: otherName },
      participantPhotos: { [myUid]: myPhoto || '', [otherUid]: otherPhoto || '' },
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      lastMessageSenderUid: '',
      unreadBy: [],
      createdAt: serverTimestamp(),
    });
  }
  return convId;
}

/** List all conversations for a user, most recent first */
export async function getConversations(myUid: string): Promise<DMConversation[]> {
  if (!db) return [];
  try {
    // Try with ordering first (requires composite index).
    // Fall back to unordered query if index isn't ready yet.
    let snap;
    try {
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', myUid),
        orderBy('lastMessageTime', 'desc'),
      );
      snap = await getDocs(q);
    } catch {
      // Composite index not ready — use simpler query and sort client-side
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', myUid),
      );
      snap = await getDocs(q);
    }

    const convos = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        participants: data.participants ?? [],
        participantNames: data.participantNames ?? {},
        participantPhotos: data.participantPhotos ?? {},
        lastMessage: data.lastMessage ?? '',
        lastMessageTime: firestoreDate(data.lastMessageTime),
        lastMessageSenderUid: data.lastMessageSenderUid ?? '',
        unreadBy: data.unreadBy ?? [],
        createdAt: firestoreDate(data.createdAt),
      } as DMConversation;
    });

    // Client-side sort (always correct, even if server sorted)
    convos.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
    return convos;
  } catch (error) {
    console.error('getConversations error:', error);
    return [];
  }
}

// ─── Messages ────────────────────────────────────────────────────────────────

/** Fetch messages for a conversation, newest first, with optional pagination */
export async function getMessages(
  convId: string,
  limitN = 50,
  afterDoc?: DocumentSnapshot | null,
): Promise<{ messages: DMMessage[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) return { messages: [], lastDoc: null };
  try {
    const col = collection(db, 'conversations', convId, 'messages');
    const q = afterDoc
      ? query(col, orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(limitN))
      : query(col, orderBy('createdAt', 'desc'), limit(limitN));

    const snap = await getDocs(q);
    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    const messages = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        senderUid: data.senderUid ?? '',
        senderName: data.senderName ?? '',
        senderPhoto: data.senderPhoto,
        text: data.text ?? '',
        createdAt: firestoreDate(data.createdAt),
        read: data.read ?? false,
      } as DMMessage;
    });

    return { messages, lastDoc };
  } catch (error) {
    console.error('getMessages error:', error);
    return { messages: [], lastDoc: null };
  }
}

/** Send a message in a conversation */
export async function sendMessage(
  convId: string,
  senderUid: string,
  senderName: string,
  senderPhoto: string,
  text: string,
  otherUid: string,
): Promise<DMMessage | null> {
  if (!db) return null;
  try {
    // Add message to subcollection
    const msgRef = await addDoc(collection(db, 'conversations', convId, 'messages'), {
      senderUid,
      senderName,
      senderPhoto: senderPhoto || '',
      text,
      read: false,
      createdAt: serverTimestamp(),
    });

    // Update conversation metadata
    await updateDoc(doc(db, 'conversations', convId), {
      lastMessage: text.length > 80 ? text.slice(0, 80) + '...' : text,
      lastMessageTime: serverTimestamp(),
      lastMessageSenderUid: senderUid,
      unreadBy: [otherUid],
    });

    // Send notification (fire-and-forget)
    createNotification(otherUid, {
      type: 'message',
      fromUid: senderUid,
      fromName: senderName,
      fromPhotoUrl: senderPhoto,
    });

    return {
      id: msgRef.id,
      senderUid,
      senderName,
      senderPhoto,
      text,
      createdAt: new Date(),
      read: false,
    };
  } catch (error) {
    console.error('sendMessage error:', error);
    return null;
  }
}

/** Mark a conversation as read by a user */
export async function markConversationRead(convId: string, myUid: string): Promise<void> {
  if (!db) return;
  try {
    const convRef = doc(db, 'conversations', convId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const unreadBy: string[] = data.unreadBy ?? [];
    if (unreadBy.includes(myUid)) {
      await updateDoc(convRef, {
        unreadBy: unreadBy.filter((uid) => uid !== myUid),
      });
    }
  } catch (error) {
    console.error('markConversationRead error:', error);
  }
}

/** Count conversations with unread messages for a user */
export async function getUnreadDMCount(myUid: string): Promise<number> {
  if (!db) return 0;
  try {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', myUid),
      where('unreadBy', 'array-contains', myUid),
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    console.error('getUnreadDMCount error:', error);
    return 0;
  }
}
