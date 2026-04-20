/**
 * Firebase Storage service for image uploads.
 *
 * Paths:
 *   posts/{uid}/{timestamp}.jpg   — community post images
 *   avatars/{uid}.jpg             — profile photos
 */

import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a canvas data URL (base64) to a Blob for upload. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
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

  const blob = typeof data === 'string' ? dataUrlToBlob(data) : data;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

/** Upload a community post image. Returns the download URL. */
export async function uploadPostImage(uid: string, dataUrl: string): Promise<string> {
  const path = `posts/${uid}/${Date.now()}.jpg`;
  return uploadImage(path, dataUrl);
}

/** Upload a profile avatar. Returns the download URL. */
export async function uploadAvatar(uid: string, dataUrl: string): Promise<string> {
  const path = `avatars/${uid}.jpg`;
  return uploadImage(path, dataUrl);
}

/** Upload a DM image attachment. Path uses convId + a timestamp so each
 *  conversation's images are grouped, and name collisions are avoided. */
export async function uploadDMImage(
  convId: string,
  uid: string,
  dataUrl: string,
): Promise<string> {
  const path = `dm-images/${convId}/${uid}_${Date.now()}.jpg`;
  return uploadImage(path, dataUrl);
}
