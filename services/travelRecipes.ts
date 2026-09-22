// Fetches travel recipes from Firestore `travel_recipes` collection.
// Falls back to the local seed catalogue when offline or the collection is empty.
import { db } from './firebase';
import { collection, getDocs, query, where, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { auth } from './firebase';
import { TRAVEL_RECIPES, TravelRecipe } from '../data/travelRecipes';

// ─── Recipe catalogue (Firestore + local fallback) ────────────────────────────

export async function fetchTravelRecipes(): Promise<TravelRecipe[]> {
  if (!db) return TRAVEL_RECIPES;
  try {
    const snap = await getDocs(
      query(collection(db, 'travel_recipes'), where('status', '==', 'published')),
    );
    if (snap.empty) return TRAVEL_RECIPES;
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TravelRecipe));
  } catch {
    return TRAVEL_RECIPES;
  }
}

// ─── User bookmarks ───────────────────────────────────────────────────────────

export interface TravelBookmark {
  recipeId: string;
  savedAt: string; // ISO
  testedAtHome: boolean;
}

function userPackRef() {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) return null;
  return doc(db, 'users', uid, 'travel_pack', 'bookmarks');
}

export async function syncTravelBookmarks(
  bookmarks: Record<string, TravelBookmark>,
): Promise<void> {
  const ref = userPackRef();
  if (!ref) return;
  try {
    await setDoc(ref, { bookmarks, updatedAt: new Date().toISOString() }, { merge: true });
  } catch {
    // sync failure is non-blocking
  }
}

export async function loadTravelBookmarks(): Promise<Record<string, TravelBookmark>> {
  const ref = userPackRef();
  if (!ref) return {};
  try {
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data()?.bookmarks ?? {}) : {};
  } catch {
    return {};
  }
}
