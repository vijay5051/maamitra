import { Platform } from 'react-native';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  AppCheck,
} from 'firebase/app-check';
import {
  getAuth,
  Auth,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  UserCredential,
  sendEmailVerification,
  reload,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  unlink,
  ConfirmationResult,
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
let appCheck: AppCheck | null = null;

if (isFirebaseConfigured()) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  // App Check (web only for now — native requires React Native Firebase).
  // Blocks Firestore/Storage/Auth traffic from un-attested clients once
  // "Enforce" is turned on in the Firebase Console.
  //   1. Firebase Console → App Check → Web app → register with reCAPTCHA v3
  //   2. Copy the site key → set EXPO_PUBLIC_RECAPTCHA_SITE_KEY in .env
  //   3. (Dev only) set EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN=true to allow local
  //      dev; paste the debug token the console prints into Firebase → App
  //      Check → Apps → Debug tokens.
  const siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
  if (Platform.OS === 'web' && siteKey && typeof window !== 'undefined') {
    if (process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN === 'true') {
      (globalThis as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      console.warn('App Check init failed:', error);
    }
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage, appCheck };

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
  teethTracking?: Record<string, Record<string, any>>; // Per-kid teething: { kidId: { toothId: ToothEntry } }
  foodTracking?: Record<string, Record<string, any>>;  // Per-kid 3-day-rule food log: { kidId: { foodId: FoodEntry } }
  hasSeenIntro?: boolean;                   // Home first-run popup dismissed once
  phone?: string;                           // E.164-ish mobile number, e.g. "+919876543210"
  phoneVerified?: boolean;                  // True if the number was OTP-verified
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
      teethTracking: d.teethTracking ?? {},
      foodTracking: d.foodTracking ?? {},
      hasSeenIntro: d.hasSeenIntro === true,
      phone: d.phone ?? '',
      phoneVerified: d.phoneVerified === true,
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

/** Persist per-kid teething tracker (health tab → Teeth sub-tab). */
export async function syncTeethTracking(uid: string, byKid: Record<string, Record<string, any>>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { teethTracking: byKid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('syncTeethTracking error:', error);
  }
}

/** Persist per-kid 3-day-rule food tracker (health tab → Foods sub-tab). */
export async function syncFoodTracking(uid: string, byKid: Record<string, Record<string, any>>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { foodTracking: byKid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('syncFoodTracking error:', error);
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
//
// IMPORTANT: iOS Safari (and increasingly Chrome) only allows a popup to open
// inside the SAME synchronous task as the user gesture. The old flow —
//   click → async handler → await signInWithGoogle() → await signInWithPopup
// — put enough awaits between the click and the popup call that the browser
// treated the popup as unsolicited and blocked it.
//
// The fix: caller builds the provider and calls `signInWithPopup` itself,
// synchronously, from the click handler. We expose the primitives and a
// `finaliseGoogleSignIn(result)` helper that runs AFTER the popup resolves.

export { signInWithPopup, signInWithRedirect, GoogleAuthProvider };

/** Build a preconfigured Google provider. Safe to call synchronously. */
export function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  // Force account chooser every time — avoids silent sign-in into a stale
  // account the user forgot they were signed into.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Run AFTER a successful signInWithPopup / getRedirectResult. Writes the
 * minimal user profile doc and returns the normalised identity.
 */
export async function finaliseGoogleSignIn(
  credential: UserCredential
): Promise<{ uid: string; name: string; email: string }> {
  const user = credential.user;
  const name = user.displayName ?? 'Mom';
  const email = user.email ?? '';
  await saveUserProfile(user.uid, {
    name,
    email,
    provider: 'google',
    createdAt: new Date().toISOString(),
  });
  return { uid: user.uid, name, email };
}

/**
 * Call once on app boot. If the user just came back from a redirect sign-in,
 * resolves their credential. Never throws.
 */
export async function getGoogleRedirectResult(): Promise<{ uid: string; name: string; email: string } | null> {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    return await finaliseGoogleSignIn(result);
  } catch (error) {
    console.error('getGoogleRedirectResult error:', error);
    return null;
  }
}

// ─── Phone OTP (web) ─────────────────────────────────────────────────────────
//
// Firebase phone auth requires reCAPTCHA on web. We build an INVISIBLE
// verifier against a DOM element the phone screen renders. The flow:
//   1. phone screen mounts <View nativeID="recaptcha-container" />
//   2. on "Send OTP", we call sendPhoneOtp(e164) — which creates (once) a
//      RecaptchaVerifier bound to that div and triggers linkWithPhoneNumber
//      on the CURRENTLY SIGNED-IN user (Google / email). Linking means the
//      phone becomes a second credential on the same account — the user
//      doesn't get "signed out" of their Google identity.
//   3. Firebase sends the SMS. We stash the ConfirmationResult.
//   4. on "Verify", caller invokes confirmation.confirm(code). Success
//      populates auth.currentUser.phoneNumber.
//
// Native platforms return throw ISS_UNSUPPORTED — the UI falls back to
// saving the number without OTP verification.

export const PHONE_OTP_CONTAINER_ID = 'recaptcha-container';
export const PHONE_OTP_UNSUPPORTED = 'phone-otp/unsupported-platform';

let _recaptchaVerifier: RecaptchaVerifier | null = null;

/** Reset between attempts so a new reCAPTCHA token is generated. */
export function resetPhoneRecaptcha(): void {
  if (_recaptchaVerifier) {
    try { _recaptchaVerifier.clear(); } catch {}
    _recaptchaVerifier = null;
  }
}

/**
 * Send an OTP SMS to {e164Phone}. Returns a ConfirmationResult the caller
 * must hold on to and pass back to {verifyPhoneOtp}. Throws if the user
 * isn't signed in, the platform is native, or Firebase rejects.
 *
 * Works for BOTH first-time add and change-phone flows — if the user
 * already has a phone credential linked, it's unlinked first so the new
 * number can be linked cleanly without 'auth/provider-already-linked'.
 */
export async function sendPhoneOtp(e164Phone: string): Promise<ConfirmationResult> {
  if (Platform.OS !== 'web') {
    const err: any = new Error('Phone OTP is only supported on web in this build.');
    err.code = PHONE_OTP_UNSUPPORTED;
    throw err;
  }
  if (!auth) throw new Error('Auth not configured');
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in before verifying your phone.');

  // If this user already has a phone credential linked (change-phone flow),
  // unlink it first so linkWithPhoneNumber below can proceed. Failure to
  // unlink isn't fatal — linkWithPhoneNumber will surface a clearer error
  // if there's really a problem.
  const hasPhone = user.providerData.some((p) => p.providerId === 'phone');
  if (hasPhone) {
    try {
      await unlink(user, 'phone');
    } catch (e) {
      console.warn('unlink existing phone failed:', e);
    }
  }

  // Reuse the verifier across attempts — recreating it on every send leaks
  // reCAPTCHA widgets into the DOM and starts rate-limiting.
  if (!_recaptchaVerifier) {
    _recaptchaVerifier = new RecaptchaVerifier(auth, PHONE_OTP_CONTAINER_ID, {
      size: 'invisible',
    });
  }

  // linkWithPhoneNumber attaches the phone credential to the currently
  // signed-in user (Google/email). signInWithPhoneNumber would REPLACE the
  // auth session, which we don't want.
  return await linkWithPhoneNumber(user, e164Phone, _recaptchaVerifier);
}

/** Confirm the 6-digit code. Throws on invalid code / expired / too many tries. */
export async function verifyPhoneOtp(
  confirmation: ConfirmationResult,
  code: string
): Promise<void> {
  await confirmation.confirm(code);
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
