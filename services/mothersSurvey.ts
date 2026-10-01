// Mothers survey — Firestore read/write for the public /mothers-survey page.
//
// Responses are written WITHOUT sign-in (see the mothers_survey_responses
// block in firestore.rules, which pins the document shape) and are readable
// by admins only.

import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { MOTHERS_SURVEY_VERSION, SurveyAnswers } from '../data/mothersSurvey';
import { db } from './firebase';

const COLLECTION = 'mothers_survey_responses';

export interface MothersSurveySubmission {
  answers: SurveyAnswers;
  /** Optional free text — "anything else you'd like to share". */
  comment?: string;
  /** Optional contact details, stored only when the mother ticks consent. */
  name?: string;
  phone?: string;
  contactConsent?: boolean;
  /** Campaign tag from the link, e.g. /mothers-survey?src=whatsapp. */
  source?: string;
  platform?: string;
}

export interface MothersSurveyResponse extends MothersSurveySubmission {
  id: string;
  version: number;
  createdAt: string; // ISO
}

export async function submitMothersSurvey(payload: MothersSurveySubmission): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const doc: Record<string, unknown> = {
    version: MOTHERS_SURVEY_VERSION,
    answers: payload.answers,
    createdAt: serverTimestamp(),
  };
  const comment = payload.comment?.trim();
  if (comment) doc.comment = comment.slice(0, 1000);
  if (payload.contactConsent) {
    const name = payload.name?.trim();
    const phone = payload.phone?.trim();
    if (name) doc.name = name.slice(0, 60);
    if (phone) doc.phone = phone.slice(0, 20);
    if (name || phone) doc.contactConsent = true;
  }
  const source = payload.source?.trim();
  if (source) doc.source = source.slice(0, 80);
  if (payload.platform) doc.platform = payload.platform.slice(0, 20);
  await addDoc(collection(db, COLLECTION), doc);
}

export async function getMothersSurveyResponses(): Promise<MothersSurveyResponse[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    const ts = data.createdAt;
    return {
      id: d.id,
      ...data,
      answers: data.answers ?? {},
      createdAt: ts?.toDate ? ts.toDate().toISOString() : '',
    } as MothersSurveyResponse;
  });
}
