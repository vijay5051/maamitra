/**
 * Firebase Storage service for image uploads.
 *
 * Paths:
 *   posts/{uid}/{timestamp}.jpg   — community post images
 *   avatars/{uid}.jpg             — profile photos
 *   kid-avatars/{uid}/{kidId}.jpg — child profile photos
 */

import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Match HTTPS download URLs Firebase issues so we can derive the storage
// path back from a stored imageUri. Posts/comments/DMs persist the
// download URL, not the original path; this lets cleanup functions
// delete the underlying blob on doc-delete.
const STORAGE_DOWNLOAD_URL = /^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/;

/** Best-effort delete of a Firebase Storage object given its download URL.
 *  Used by deletePost / DM purge flows to stop orphaned blobs from
 *  accumulating after the parent doc is removed. Returns silently on
 *  any failure: the parent delete is the primary user-visible action,
 *  blob cleanup is housekeeping. */
export async function deleteStoredImage(downloadUrlOrPath: string): Promise<void> {
  if (!storage || !downloadUrlOrPath) return;
  try {
    let path: string;
    const m = downloadUrlOrPath.match(STORAGE_DOWNLOAD_URL);
    if (m) {
      path = decodeURIComponent(m[1]);
    } else if (!downloadUrlOrPath.startsWith('http')) {
      // Already a raw storage path.
      path = downloadUrlOrPath;
    } else {
      return;
    }
    await deleteObject(ref(storage, path));
  } catch (err: any) {
    // object-not-found is the normal case for already-cleaned blobs.
    if (err?.code !== 'storage/object-not-found') {
      console.warn('deleteStoredImage failed', downloadUrlOrPath, err?.code ?? err);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a data URL (base64) to a Blob for upload.
 *
 * On web we have a global `atob`. On React Native (especially Android
 * Hermes) `atob` is unreliable / missing — using it threw a silent
 * ReferenceError, which made the whole kid-photo save flow fail with
 * "Could not save changes". Use fetch() for native: it natively
 * resolves data: URLs into Blobs without needing base64 globals.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  // Fast path: fetch() understands data: URLs on every supported runtime
  // (RN iOS, RN Android Hermes, modern browsers). It also avoids the
  // O(n) JS loop our manual decoder used.
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch (fetchErr) {
    // Last-ditch fallback for environments where fetch barfs on data:.
    // Only runs if globalThis.atob exists (web).
    if (typeof (globalThis as any).atob !== 'function') throw fetchErr;
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = (globalThis as any).atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload an image (data URL or Blob) to Firebase Storage and return its
 * permanent download URL.
 *
 * @param path  Storage path, e.g. `posts/{uid}/1713200000000.jpg`
 * @param data  Either a base64 data URL string or a Blob
 * @returns     Public HTTPS download URL
 */
export async function uploadImage(path: string, data: string | Blob): Promise<string> {
  if (!storage) throw new Error('Firebase Storage not configured');

  const blob = typeof data === 'string' ? await dataUrlToBlob(data) : data;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

// Same-millisecond uploads from one user used to collide on `Date.now()`
// alone, silently overwriting one image with the next. Suffix with a
// short random tag to make collisions astronomically unlikely.
function uniqueName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Upload a community post image. Returns the download URL. */
export async function uploadPostImage(uid: string, dataUrl: string): Promise<string> {
  const path = `posts/${uid}/${uniqueName()}.jpg`;
  return uploadImage(path, dataUrl);
}

/** Upload a profile avatar. Returns the download URL. */
export async function uploadAvatar(uid: string, dataUrl: string): Promise<string> {
  const path = `avatars/${uid}.jpg`;
  return uploadImage(path, dataUrl);
}

/** Upload a child's profile photo. Returns the download URL. */
export async function uploadKidAvatar(uid: string, kidId: string, dataUrl: string): Promise<string> {
  const path = `kid-avatars/${uid}/${kidId}.jpg`;
  return uploadImage(path, dataUrl);
}

/** Upload a DM image attachment. Path uses convId + a timestamp so each
 *  conversation's images are grouped, and name collisions are avoided. */
export async function uploadDMImage(
  convId: string,
  uid: string,
  dataUrl: string,
): Promise<string> {
  const path = `dm-images/${convId}/${uid}_${uniqueName()}.jpg`;
  return uploadImage(path, dataUrl);
}
