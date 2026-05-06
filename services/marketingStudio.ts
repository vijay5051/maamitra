/**
 * marketingStudio — client wrappers for the Studio v2 (Phase 2) callables.
 *
 * Both functions wrap Firebase callable invocations and return the raw
 * server response shape unchanged. Callers should pipe errors through
 * `friendlyError()` before showing to the user.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

import { app } from './firebase';

interface StudioVariant {
  variantId: string;
  url: string;
  storagePath: string;
}

export interface GenerateStudioVariantsInput {
  prompt: string;
  /** Single mode: 1–4 picker variants. Carousel mode: 3–5 slides. */
  variantCount?: 1 | 2 | 3 | 4 | 5;
  model?: 'dalle' | 'imagen' | 'flux';
  aspectRatio?: '1:1' | '9:16' | '16:9';
  /** When 'carousel', each slide gets a position-aware prompt prefix
   *  ("slide 1 of N (cover)", etc.) and the result becomes the carousel
   *  slides directly — no picking. */
  mode?: 'single' | 'carousel';
}

export type GenerateStudioVariantsResult =
  | { ok: true; variants: StudioVariant[]; costInr: number; failedCount: number }
  | { ok: false; code: string; message: string };

export async function generateStudioVariants(
  input: GenerateStudioVariantsInput,
): Promise<GenerateStudioVariantsResult> {
  if (!app) return { ok: false, code: 'no-firebase', message: 'Not connected.' };
  const fn = httpsCallable<GenerateStudioVariantsInput, GenerateStudioVariantsResult>(
    getFunctions(app),
    'generateStudioVariants',
    { timeout: 180000 },
  );
  try {
    const r = await fn(input);
    return r.data;
  } catch (e: any) {
    return { ok: false, code: e?.code ?? 'callable-failed', message: e?.message ?? String(e) };
  }
}

export interface CreateStudioDraftInput {
  prompt: string;
  /** Single-image flow — pass these. */
  imageUrl?: string;
  imageStoragePath?: string;
  /** Carousel flow — pass these instead. Length 2–10. */
  assets?: { url: string; storagePath: string }[];
  caption?: string;
  scheduledAt?: string | null;
}

export type CreateStudioDraftResult =
  | { ok: true; draftId: string; caption: string }
  | { ok: false; code: string; message: string };

export async function createStudioDraft(
  input: CreateStudioDraftInput,
): Promise<CreateStudioDraftResult> {
  if (!app) return { ok: false, code: 'no-firebase', message: 'Not connected.' };
  const fn = httpsCallable<CreateStudioDraftInput, CreateStudioDraftResult>(
    getFunctions(app),
    'createStudioDraft',
  );
  try {
    const r = await fn(input);
    return r.data;
  } catch (e: any) {
    return { ok: false, code: e?.code ?? 'callable-failed', message: e?.message ?? String(e) };
  }
}

export interface EditStudioImageInput {
  imageStoragePath: string;
  prompt: string;
  quality?: 'medium' | 'high';
  /** Phase 4 item 5 — optional brush mask. Transparent pixels mark the
   *  region to repaint. data:image/png;base64,... */
  maskDataUrl?: string;
}

export type EditStudioImageResult =
  | { ok: true; variantId: string; url: string; storagePath: string; costInr: number }
  | { ok: false; code: string; message: string };

export async function editStudioImage(
  input: EditStudioImageInput,
): Promise<EditStudioImageResult> {
  if (!app) return { ok: false, code: 'no-firebase', message: 'Not connected.' };
  const fn = httpsCallable<EditStudioImageInput, EditStudioImageResult>(
    getFunctions(app),
    'editStudioImage',
    { timeout: 180000 },
  );
  try {
    const r = await fn(input);
    return r.data;
  } catch (e: any) {
    return { ok: false, code: e?.code ?? 'callable-failed', message: e?.message ?? String(e) };
  }
}

export interface UploadStudioImageInput {
  /** data:<mime>;base64,<…> URL — built by FileReader.readAsDataURL on web. */
  dataUrl: string;
}

export type UploadStudioImageResult =
  | { ok: true; variantId: string; url: string; storagePath: string }
  | { ok: false; code: string; message: string };

export async function uploadStudioImage(
  input: UploadStudioImageInput,
): Promise<UploadStudioImageResult> {
  if (!app) return { ok: false, code: 'no-firebase', message: 'Not connected.' };
  const fn = httpsCallable<UploadStudioImageInput, UploadStudioImageResult>(
    getFunctions(app),
    'uploadStudioImage',
  );
  try {
    const r = await fn(input);
    return r.data;
  } catch (e: any) {
    return { ok: false, code: e?.code ?? 'callable-failed', message: e?.message ?? String(e) };
  }
}

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ComposeStudioLogoInput {
  imageStoragePath: string;
  position?: LogoPosition;
  logoSize?: number;
}

export type ComposeStudioLogoResult =
  | { ok: true; variantId: string; url: string; storagePath: string }
  | { ok: false; code: string; message: string };

export async function composeStudioLogo(
  input: ComposeStudioLogoInput,
): Promise<ComposeStudioLogoResult> {
  if (!app) return { ok: false, code: 'no-firebase', message: 'Not connected.' };
  const fn = httpsCallable<ComposeStudioLogoInput, ComposeStudioLogoResult>(
    getFunctions(app),
    'composeStudioLogo',
    { timeout: 120000 },
  );
  try {
    const r = await fn(input);
    return r.data;
  } catch (e: any) {
    return { ok: false, code: e?.code ?? 'callable-failed', message: e?.message ?? String(e) };
  }
}
