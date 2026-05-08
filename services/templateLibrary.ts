// Reusable Studio template-image library.
//
// Admin-managed Firestore collection `template_images` paired with Storage
// objects under `template-images/<docId>.<ext>`. Studio's TemplateImagePicker
// subscribes to this collection so admins can grow/edit/delete the library
// without a deploy. The 67 starter PNGs in public/template-images/ are
// imported one-shot via `importStaticTemplate` from the admin templates page.

import {
  addDoc,
  collection,
  deleteDoc as fsDeleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { logAdminAction } from './audit';
import { app, db, storage } from './firebase';

const COL = 'template_images';
const CAT_COL = 'template_categories';
const STORAGE_PREFIX = 'template-images';

export interface TemplateImageDoc {
  id: string;
  label: string;
  category: string;
  storagePath: string;
  url: string;
  bytes: number;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  /** Original filename when imported from the static seed manifest. */
  legacyFileName: string | null;
}

function tsToIso(ts: unknown): string | null {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === 'string') return ts;
  return null;
}

function rowToDoc(snap: { id: string; data: () => DocumentData }): TemplateImageDoc {
  const d = snap.data();
  return {
    id: snap.id,
    label: typeof d.label === 'string' ? d.label : 'Untitled',
    category: typeof d.category === 'string' ? d.category : 'Uncategorised',
    storagePath: typeof d.storagePath === 'string' ? d.storagePath : '',
    url: typeof d.url === 'string' ? d.url : '',
    bytes: typeof d.bytes === 'number' ? d.bytes : 0,
    width: typeof d.width === 'number' ? d.width : null,
    height: typeof d.height === 'number' ? d.height : null,
    uploadedBy: typeof d.uploadedBy === 'string' ? d.uploadedBy : null,
    uploadedAt: tsToIso(d.uploadedAt),
    legacyFileName: typeof d.legacyFileName === 'string' ? d.legacyFileName : null,
  };
}

export function subscribeTemplateImages(cb: (rows: TemplateImageDoc[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, COL), orderBy('uploadedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(rowToDoc)),
    (err) => {
      console.warn('[templateLibrary] subscribe failed', err);
      cb([]);
    },
  );
}

function extFromMime(mime: string | undefined): string {
  if (!mime) return 'png';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('avif')) return 'avif';
  if (mime.includes('heic')) return 'heic';
  if (mime.includes('heif')) return 'heif';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

interface UploadOpts {
  label: string;
  category: string;
  legacyFileName?: string;
  width?: number;
  height?: number;
}

/** Upload a blob, create the matching Firestore doc, return the live row. */
export async function uploadTemplateImage(
  actor: { uid: string; email: string | null | undefined },
  blob: Blob,
  opts: UploadOpts,
): Promise<TemplateImageDoc> {
  if (!db || !storage) throw new Error('Firebase not configured');
  if (!blob.size) throw new Error('image-empty');
  if (blob.size > 8 * 1024 * 1024) throw new Error('too-large');

  const ext = extFromMime(blob.type);
  // Two-step: addDoc to mint the id, then upload Storage at template-images/<id>.<ext>.
  // Doing it this way keeps storagePath deterministic and lets the delete callable
  // derive the path from the doc id.
  const docRef = await addDoc(collection(db, COL), {
    label: opts.label.trim() || 'Untitled',
    category: opts.category.trim() || 'Uncategorised',
    storagePath: '',
    url: '',
    bytes: blob.size,
    width: opts.width ?? null,
    height: opts.height ?? null,
    uploadedBy: actor.email ?? actor.uid,
    uploadedAt: serverTimestamp(),
    legacyFileName: opts.legacyFileName ?? null,
  });
  const storagePath = `${STORAGE_PREFIX}/${docRef.id}.${ext}`;
  const storageRef = ref(storage, storagePath);
  try {
    await uploadBytes(storageRef, blob, { contentType: blob.type || `image/${ext}` });
    const url = await getDownloadURL(storageRef);
    await updateDoc(docRef, { storagePath, url });
    await logAdminAction(actor, 'marketing.template.upload', { docId: docRef.id }, { label: opts.label, category: opts.category });
    return {
      id: docRef.id,
      label: opts.label.trim() || 'Untitled',
      category: opts.category.trim() || 'Uncategorised',
      storagePath,
      url,
      bytes: blob.size,
      width: opts.width ?? null,
      height: opts.height ?? null,
      uploadedBy: actor.email ?? actor.uid,
      uploadedAt: new Date().toISOString(),
      legacyFileName: opts.legacyFileName ?? null,
    };
  } catch (e) {
    // Roll back the doc so the library doesn't show a row pointing to nothing.
    try { await fsDeleteDoc(docRef); } catch { /* ignore */ }
    throw e;
  }
}

interface UpdateOpts {
  label?: string;
  category?: string;
}

export async function updateTemplateImage(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  patch: UpdateOpts,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  const update: Record<string, unknown> = {};
  if (typeof patch.label === 'string') update.label = patch.label.trim() || 'Untitled';
  if (typeof patch.category === 'string') update.category = patch.category.trim() || 'Uncategorised';
  if (Object.keys(update).length === 0) return;
  await updateDoc(doc(db, COL, id), update);
  await logAdminAction(actor, 'marketing.template.update', { docId: id }, update);
}

/** Delete the Firestore doc + its Storage object. Best-effort on the
 *  Storage side — orphan blobs cost pennies and `object-not-found` is
 *  the normal case if the upload step never completed. */
export async function deleteTemplateImage(
  actor: { uid: string; email: string | null | undefined },
  row: TemplateImageDoc,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await fsDeleteDoc(doc(db, COL, row.id));
  if (storage && row.storagePath) {
    try {
      await deleteObject(ref(storage, row.storagePath));
    } catch (err: any) {
      if (err?.code !== 'storage/object-not-found') {
        console.warn('[templateLibrary] storage delete failed', row.storagePath, err?.code ?? err);
      }
    }
  }
  await logAdminAction(actor, 'marketing.template.delete', { docId: row.id }, { label: row.label });
}

/** Read a library image's bytes via the admin-only proxy callable.
 *
 *  Going direct against firebasestorage.googleapis.com works for `<Image>`
 *  rendering but trips CORS for `fetch()` — the bucket isn't configured to
 *  allow arbitrary browser origins. Routing through the function lets the
 *  picker hand a Blob to its destination upload flow without changing
 *  bucket-level config. */
export async function getTemplateImageBlob(id: string): Promise<Blob> {
  if (!app) throw new Error('Firebase app not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const call = httpsCallable<
    { id: string },
    { ok: true; dataUrl: string; bytes: number; contentType: string } | { ok: false; code: string; message: string }
  >(functions, 'getTemplateImage');
  const result = await call({ id });
  if (!result.data.ok) throw new Error(result.data.message || 'Could not read template.');
  // Browsers + RN both resolve `data:` URLs through fetch into Blob.
  const res = await fetch(result.data.dataUrl);
  return await res.blob();
}

/** One-shot import: fetch a static `/template-images/<file>` URL into the
 *  Firestore-backed library. Idempotent at the call site (caller checks
 *  `existingByFileName`). Returns the new doc. */
export async function importStaticTemplate(
  actor: { uid: string; email: string | null | undefined },
  asset: { fileName: string; label: string; sourceUrl: string },
  category: string,
): Promise<TemplateImageDoc> {
  const res = await fetch(asset.sourceUrl);
  if (!res.ok) throw new Error(`fetch-failed-${res.status}`);
  const blob = await res.blob();
  return uploadTemplateImage(actor, blob, {
    label: asset.label,
    category,
    legacyFileName: asset.fileName,
  });
}

// ── Categories ─────────────────────────────────────────────────────────────
//
// First-class category catalogue. Image rows still store their category as a
// plain string for back-compat — this collection is purely the catalogue of
// admin-defined buckets. The page's display set is union(explicit, implicit
// from image rows) so an empty explicit category still shows up.

export interface TemplateCategoryDoc {
  id: string;
  label: string;
  createdBy: string | null;
  createdAt: string | null;
}

function rowToCategory(snap: { id: string; data: () => DocumentData }): TemplateCategoryDoc {
  const d = snap.data();
  return {
    id: snap.id,
    label: typeof d.label === 'string' ? d.label : 'Untitled',
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : null,
    createdAt: tsToIso(d.createdAt),
  };
}

export function subscribeTemplateCategories(cb: (rows: TemplateCategoryDoc[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, CAT_COL), orderBy('label', 'asc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(rowToCategory)),
    (err) => {
      console.warn('[templateLibrary] category subscribe failed', err);
      cb([]);
    },
  );
}

export async function createTemplateCategory(
  actor: { uid: string; email: string | null | undefined },
  label: string,
): Promise<TemplateCategoryDoc> {
  if (!db) throw new Error('Firestore not ready');
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Category name is required.');
  if (trimmed.length > 60) throw new Error('Category name is too long (max 60 chars).');
  const docRef = await addDoc(collection(db, CAT_COL), {
    label: trimmed,
    createdBy: actor.email ?? actor.uid,
    createdAt: serverTimestamp(),
  });
  await logAdminAction(actor, 'marketing.template.category.create', { docId: docRef.id }, { label: trimmed });
  return {
    id: docRef.id,
    label: trimmed,
    createdBy: actor.email ?? actor.uid,
    createdAt: new Date().toISOString(),
  };
}

export async function deleteTemplateCategory(
  actor: { uid: string; email: string | null | undefined },
  id: string,
  label: string,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await fsDeleteDoc(doc(db, CAT_COL, id));
  await logAdminAction(actor, 'marketing.template.category.delete', { docId: id }, { label });
}
