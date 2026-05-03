/**
 * Privacy-preserving AI chat usage counters.
 *
 * We deliberately do NOT store thread bodies in Firestore. Threads stay in
 * the user's local zustand-persisted store on the device. Firestore only
 * keeps anonymous-ish counters so the admin /chat-usage screen can spot
 * abuse (heavy daily intensity) without ever seeing message text.
 *
 * Schema: chat_usage/{uid}
 *   totalMessages : number   // user + assistant
 *   userMessages  : number   // just user-driven
 *   threadCount   : number   // incremented once per createThread()
 *   lastActivity  : Timestamp
 *   daily         : { 'YYYY-MM-DD': number }   // total messages bucketed by local day
 *
 * Writes are owner-only; reads are owner OR admin (firestore.rules).
 */
import { doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function recordChatMessage(uid: string, role: 'user' | 'assistant'): Promise<void> {
  if (!db || !uid) return;
  const update: Record<string, any> = {
    totalMessages: increment(1),
    lastActivity: serverTimestamp(),
    [`daily.${todayKey()}`]: increment(1),
  };
  if (role === 'user') update.userMessages = increment(1);
  try {
    await setDoc(doc(db, 'chat_usage', uid), update, { merge: true });
  } catch (err) {
    console.error('[chatUsage] recordChatMessage failed:', err);
  }
}

export async function recordThreadStart(uid: string): Promise<void> {
  if (!db || !uid) return;
  try {
    await setDoc(
      doc(db, 'chat_usage', uid),
      { threadCount: increment(1), lastActivity: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error('[chatUsage] recordThreadStart failed:', err);
  }
}
