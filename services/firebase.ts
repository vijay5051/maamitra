import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  reload,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };

// ─── Default App Settings ─────────────────────────────────────────────────────

export const DEFAULT_APP_SETTINGS = {
  featureFlags: {
    community: true,
    library: true,
    wellness: true,
    health: true,
    family: true,
  },
  theme: {
    primary: '#ec4899',
    secondary: '#8b5cf6',
  },
  tabs: [
    { key: 'chat', label: 'Chat', icon: 'chatbubble', visible: true },
    { key: 'family', label: 'Family', icon: 'people', visible: true },
    { key: 'health', label: 'Health', icon: 'medical', visible: true },
    { key: 'wellness', label: 'Wellness', icon: 'leaf', visible: true },
    { key: 'community', label: 'Community', icon: 'heart-circle', visible: true },
    { key: 'library', label: 'Library', icon: 'library', visible: true },
  ],
  notificationTexts: {
    welcome: 'Welcome to MaaMitra! 🤱',
    vaccineReminder: 'Vaccine due soon for your baby 💉',
    moodReminder: 'How are you feeling today? 💙',
  },
};

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function saveUserProfile(uid: string, data: Record<string, any>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('saveUserProfile error:', error);
  }
}

export async function getUserProfile(uid: string): Promise<Record<string, any> | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('getUserProfile error:', error);
    return null;
  }
}

// ─── Google Sign-In ───────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<{ uid: string; name: string; email: string } | null> {
  if (!auth) return null;
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const name = user.displayName ?? 'Mom';
    const email = user.email ?? '';
    // Save profile if new user
    await saveUserProfile(user.uid, { name, email, provider: 'google', createdAt: new Date().toISOString() });
    return { uid: user.uid, name, email };
  } catch (error: any) {
    // popup-closed-by-user or cancelled — not a real error
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.error('signInWithGoogle error:', error);
    throw error;
  }
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail(): Promise<void> {
  if (!auth?.currentUser) return;
  await sendEmailVerification(auth.currentUser);
}

export async function checkEmailVerified(): Promise<boolean> {
  if (!auth?.currentUser) return false;
  await reload(auth.currentUser);
  return auth.currentUser.emailVerified;
}

// ─── User Account Management ──────────────────────────────────────────────────

export async function deleteUserAccount(uid: string): Promise<void> {
  // Delete Firestore user document
  if (db) {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      console.error('deleteUserAccount (firestore) error:', error);
    }
  }
  // Delete Firebase Auth user
  if (auth?.currentUser) {
    try {
      await deleteUser(auth.currentUser);
    } catch (error) {
      console.error('deleteUserAccount (auth) error:', error);
      throw error;
    }
  }
}

// ─── Mood ─────────────────────────────────────────────────────────────────────

export async function saveMood(uid: string, date: string, score: number): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'moods', uid, 'entries', date), { score, date, savedAt: serverTimestamp() });
  } catch (error) {
    console.error('saveMood error:', error);
  }
}

export async function getMoodHistory(uid: string): Promise<Array<{ date: string; score: number }>> {
  if (!db) return [];
  try {
    const colRef = collection(db, 'moods', uid, 'entries');
    const q = query(colRef, orderBy('date', 'desc'), limit(7));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as { date: string; score: number });
  } catch (error) {
    console.error('getMoodHistory error:', error);
    return [];
  }
}

// ─── Community Posts ──────────────────────────────────────────────────────────

export interface CommunityPostPayload {
  authorName: string;
  authorInitial: string;
  badge: string;
  topic: string;
  text: string;
  imageEmoji?: string;
  imageCaption?: string;
}

export async function saveCommunityPost(post: CommunityPostPayload): Promise<void> {
  if (!db) return;
  try {
    await addDoc(collection(db, 'community_posts'), {
      ...post,
      reactions: {},
      comments: [],
      approved: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('saveCommunityPost error:', error);
  }
}

export async function getCommunityPosts(): Promise<any[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'community_posts'),
      where('approved', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getCommunityPosts error:', error);
    return [];
  }
}

export async function toggleReaction(postId: string, emoji: string, uid: string): Promise<void> {
  if (!db) return;
  try {
    const postRef = doc(db, 'community_posts', postId);
    const snap = await getDoc(postRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const reactions: Record<string, number> = data.reactions || {};
    const userReactions: string[] = data.userReactions || [];

    if (userReactions.includes(emoji)) {
      reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
      const newUserReactions = userReactions.filter(e => e !== emoji);
      await updateDoc(postRef, { reactions, userReactions: newUserReactions });
    } else {
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      await updateDoc(postRef, { reactions, userReactions: [...userReactions, emoji] });
    }
  } catch (error) {
    console.error('toggleReaction error:', error);
  }
}

export async function addComment(postId: string, comment: {
  id: string;
  authorName: string;
  authorInitial: string;
  text: string;
  createdAt: Date;
}): Promise<void> {
  if (!db) return;
  try {
    const postRef = doc(db, 'community_posts', postId);
    const snap = await getDoc(postRef);
    if (!snap.exists()) return;

    const existing = snap.data().comments || [];
    await updateDoc(postRef, {
      comments: [...existing, { ...comment, createdAt: Timestamp.fromDate(comment.createdAt) }],
    });
  } catch (error) {
    console.error('addComment error:', error);
  }
}

// ─── Saved Answers ────────────────────────────────────────────────────────────

export async function saveAnswer(uid: string, answer: {
  id: string;
  content: string;
  tag: { tag: string; color: string };
  savedAt: Date;
}): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'saved_answers', uid, 'items', answer.id), {
      ...answer,
      savedAt: Timestamp.fromDate(answer.savedAt),
    });
  } catch (error) {
    console.error('saveAnswer error:', error);
  }
}

export async function getSavedAnswers(uid: string): Promise<any[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, 'saved_answers', uid, 'items'), orderBy('savedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getSavedAnswers error:', error);
    return [];
  }
}

export async function deleteSavedAnswer(uid: string, itemId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'saved_answers', uid, 'items', itemId));
  } catch (error) {
    console.error('deleteSavedAnswer error:', error);
  }
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export async function getAppSettings(): Promise<typeof DEFAULT_APP_SETTINGS> {
  if (!db) return DEFAULT_APP_SETTINGS;
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'config'));
    if (snap.exists()) return snap.data() as typeof DEFAULT_APP_SETTINGS;
    return DEFAULT_APP_SETTINGS;
  } catch (error) {
    console.error('getAppSettings error:', error);
    return DEFAULT_APP_SETTINGS;
  }
}

export async function updateAppSettings(settings: Partial<typeof DEFAULT_APP_SETTINGS>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'app_settings', 'config'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('updateAppSettings error:', error);
  }
}

// ─── Content (Articles, Products, Yoga, Schemes) ──────────────────────────────

export async function getContent(type: string): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, type));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error(`getContent(${type}) error:`, error);
    return [];
  }
}

export async function updateContent(type: string, id: string, data: Record<string, any>): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, type, id), { ...data, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error(`updateContent(${type}, ${id}) error:`, error);
  }
}

export async function createContent(type: string, data: Record<string, any>): Promise<string | null> {
  if (!db) return null;
  try {
    const ref = await addDoc(collection(db, type), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  } catch (error) {
    console.error(`createContent(${type}) error:`, error);
    return null;
  }
}

export async function deleteContent(type: string, id: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, type, id));
  } catch (error) {
    console.error(`deleteContent(${type}, ${id}) error:`, error);
  }
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<{ totalUsers: number; totalPosts: number; postsToday: number }> {
  if (!db) return { totalUsers: 0, totalPosts: 0, postsToday: 0 };
  try {
    const [usersSnap, postsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'community_posts')),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(todayStart);

    const todayQuery = query(
      collection(db, 'community_posts'),
      where('createdAt', '>=', todayTimestamp)
    );
    const todaySnap = await getDocs(todayQuery);

    return {
      totalUsers: usersSnap.size,
      totalPosts: postsSnap.size,
      postsToday: todaySnap.size,
    };
  } catch (error) {
    console.error('getAdminStats error:', error);
    return { totalUsers: 0, totalPosts: 0, postsToday: 0 };
  }
}
