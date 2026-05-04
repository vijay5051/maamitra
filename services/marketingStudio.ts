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
  variantCount?: 1 | 2 | 3 | 4;
  model?: 'imagen' | 'flux';
  aspectRatio?: '1:1' | '9:16' | '16:9';
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
  imageUrl: string;
  imageStoragePath: string;
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
  );
  try {
    const r = await fn(input);
    return r.data;
  } catch (e: any) {
    return { ok: false, code: e?.code ?? 'callable-failed', message: e?.message ?? String(e) };
  }
}
