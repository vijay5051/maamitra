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
import { getStorage, FirebaseStorage } from 'firebase/storage';

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
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured()) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };

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

// ─── Full Profile Sync ─────────────────────────────────────────────────────────

export interface FullProfileData {
  motherName: string;
  profile: Record<string, any> | null;
  kids: any[];
  completedVaccines: Record<string, any>;
  onboardingComplete: boolean;
  parentGender?: string;
  bio?: string;
  expertise?: string[];
  photoUrl?: string;
  visibilitySettings?: any;
  // Extended real-time fields
  healthTracking?: Record<string, string>;  // My Health checklist: { itemId: isoDate }
  moodHistory?: any[];                      // Wellness mood log (capped at 30)
  healthConditions?: string[] | null;       // Wellness health conditions
  allergies?: string[] | null;              // Chat allergy selections
}

export async function saveFullProfile(uid: string, data: FullProfileData): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), {
      motherName: data.motherName,
      profile: data.profile ?? null,
      kids: data.kids,
      completedVaccines: data.completedVaccines,
      onboardingComplete: data.onboardingComplete,
      parentGender: data.parentGender ?? '',
      bio: data.bio ?? '',
      expertise: data.expertise ?? [],
      photoUrl: data.photoUrl ?? '',
      visibilitySettings: data.visibilitySettings ?? null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('saveFullProfile error:', error);
  }
}

export async function loadFullProfile(uid: string): Promise<FullProfileData | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null; // truly no account
    const d = snap.data();
    return {
      motherName: d.motherName ?? '',
      profile: d.profile ?? null,
      kids: d.kids ?? [],
      completedVaccines: d.completedVaccines ?? {},
      onboardingComplete: d.onboardingComplete === true,
      parentGender: d.parentGender ?? '',
      bio: d.bio ?? '',
      expertise: d.expertise ?? [],
      photoUrl: d.photoUrl ?? '',
      visibilitySettings: d.visibilitySettings ?? null,
      healthTracking: d.healthTracking ?? {},
      moodHistory: d.moodHistory ?? [],
      healthConditions: Array.isArray(d.healthConditions) && d.healthConditions.length > 0 ? d.healthConditions : null,
      allergies: d.allergies ?? null,
    };
  } catch (error) {
    console.error('loadFullProfile error:', error);
    return null;
  }
}

export async function syncCompletedVaccines(uid: string, completedVaccines: Record<string, any>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { completedVaccines, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('syncCompletedVaccines error:', error);
  }
}

/** Persist My Health checklist completions (health tab) */
export async function syncHealthTracking(uid: string, data: Record<string, string>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { healthTracking: data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('syncHealthTracking error:', error);
  }
}

/** Persist mood history + health conditions (wellness tab) */
export async function syncWellnessData(uid: string, moodHistory: any[], healthConditions: string[] | null): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), {
      moodHistory,
      healthConditions: healthConditions ?? [],
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('syncWellnessData error:', error);
  }
}

/** Persist allergy selections (chat tab) */
export async function syncAllergies(uid: string, allergies: string[]): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { allergies, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('syncAllergies error:', error);
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
  authorUid?: string;
  authorName: string;
  authorInitial: string;
  badge: string;
  topic: string;
  text: string;
  imageEmoji?: string;
  imageCaption?: string;
}

// ─── Support tickets ────────────────────────────────────────────────
// Writes user-submitted contact-form messages to Firestore so the team
// can triage them. Also used as the sole backing store for Help &
// Support (no third-party helpdesk yet). maamitra@gmail.com is the
// fallback for users who prefer direct email.

export interface SupportTicketPayload {
  uid: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  appVersion?: string;
  platform?: string;
}

export async function submitSupportTicket(ticket: SupportTicketPayload): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  await addDoc(collection(db, 'supportTickets'), {
    ...ticket,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export async function saveCommunityPost(post: CommunityPostPayload): Promise<void> {
  if (!db) return;
  try {
    await addDoc(collection(db, 'community_posts'), {
      ...post,
      reactions: {},
      comments: [],
      approved: true,
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

// ─── Chat Threads (multi-thread AI chat history) ──────────────────────────────

export async function saveChatThread(uid: string, thread: {
  id: string;
  title: string;
  messages: any[];
  createdAt: Date;
  lastMessageAt: Date;
}): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'chats', uid, 'threads', thread.id), {
      id: thread.id,
      title: thread.title,
      messages: thread.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? Timestamp.fromDate(m.timestamp) : m.timestamp,
      })),
      createdAt: Timestamp.fromDate(thread.createdAt),
      lastMessageAt: Timestamp.fromDate(thread.lastMessageAt),
    }, { merge: true });
  } catch (error) {
    console.error('saveChatThread error:', error);
  }
}

export async function loadChatThreads(uid: string, limitN = 20): Promise<any[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'chats', uid, 'threads'),
      orderBy('lastMessageAt', 'desc'),
      limit(limitN),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const tsToDate = (v: any): Date => {
        if (!v) return new Date();
        if (v instanceof Date) return v;
        if (typeof v.toDate === 'function') return v.toDate();
        return new Date(v);
      };
      return {
        id: d.id,
        title: data.title ?? 'Chat',
        messages: (data.messages ?? []).map((m: any) => ({
          ...m,
          timestamp: tsToDate(m.timestamp),
        })),
        createdAt: tsToDate(data.createdAt),
        lastMessageAt: tsToDate(data.lastMessageAt),
      };
    });
  } catch (error) {
    console.error('loadChatThreads error:', error);
    return [];
  }
}

export async function deleteChatThread(uid: string, threadId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'chats', uid, 'threads', threadId));
  } catch (error) {
    console.error('deleteChatThread error:', error);
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

/** Upsert a document at a known ID (used for vaccine overrides over static data) */
export async function setContentById(type: string, id: string, data: Record<string, any>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, type, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error(`setContentById(${type}, ${id}) error:`, error);
  }
}

// ─── Admin: User Management ───────────────────────────────────────────────────

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  onboardingComplete: boolean;
  kidsCount: number;
  state: string;
  photoUrl?: string;
}

export async function getUsers(): Promise<AdminUser[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        name: data.name ?? data.motherName ?? 'Unknown',
        email: data.email ?? '',
        createdAt: data.createdAt ?? '',
        onboardingComplete: data.onboardingComplete ?? false,
        kidsCount: Array.isArray(data.kids) ? data.kids.length : 0,
        state: data.profile?.state ?? '',
        photoUrl: data.photoUrl ?? undefined,
      };
    });
  } catch (error) {
    console.error('getUsers error:', error);
    return [];
  }
}

export async function deleteUserData(uid: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    console.error('deleteUserData error:', error);
  }
}

export async function approveCommunityPost(postId: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'community_posts', postId), { approved: true });
  } catch (error) {
    console.error('approveCommunityPost error:', error);
  }
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'community_posts', postId));
  } catch (error) {
    console.error('deleteCommunityPost error:', error);
  }
}

export async function getAllCommunityPosts(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('getAllCommunityPosts error:', error);
    return [];
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
